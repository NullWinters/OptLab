/* 实验页笔记：挂载 UI、Markdown、行为记录、生成笔记 */
(function (global) {
    'use strict';

    function isLoggedIn() {
        return (typeof getStoredToken === 'function') && !!getStoredToken();
    }

    async function apiSafe(fn) {
        if (!isLoggedIn()) return null;
        try {
            return await fn();
        } catch (e) {
            console.debug('[Notes]', e);
            return null;
        }
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtTime(d) {
        return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) {
            return String(n).padStart(2, '0');
        }).join(':');
    }

    function _sanitizeFilename(name) {
        var s = String(name || '实验笔记').trim();
        s = s.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ');
        if (!s) s = '实验笔记';
        return s.slice(0, 80);
    }

    /* Markdown + LaTeX：先占位公式再 marked，再还原 */
    function _renderMarkdownFallback(src) {
        function escHtml(x) {
            return String(x || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        function splitPipeRow(line) {
            var t = String(line || '').trim();
            if (t.startsWith('|')) t = t.slice(1);
            if (t.endsWith('|')) t = t.slice(0, -1);
            return t.split('|').map(function (c) {
                return escHtml(c.trim());
            });
        }

        function isTableRow(line) {
            return /^\s*\|.+\|\s*$/.test(String(line || ''));
        }

        function isSeparatorRow(line) {
            return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(String(line || ''));
        }

        var lines = String(src || '').split('\n');
        var out = [];
        var i = 0;

        while (i < lines.length) {
            var line = lines[i] || '';
            var trimmed = line.trim();

            if (!trimmed) {
                i++;
                continue;
            }

            if (trimmed.indexOf('<div class="exp-note-section-header">') === 0) {
                out.push(trimmed);
                i++;
                continue;
            }

            if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
                var headers = splitPipeRow(lines[i]);
                i += 2;
                var bodyRows = [];
                while (i < lines.length && isTableRow(lines[i])) {
                    bodyRows.push(splitPipeRow(lines[i]));
                    i++;
                }
                var th = headers.map(function (h) {
                    return '<th>' + h + '</th>';
                }).join('');
                var trs = bodyRows.map(function (r) {
                    return '<tr>' + r.map(function (c) {
                        return '<td>' + c + '</td>';
                    }).join('') + '</tr>';
                }).join('');
                out.push('<div class="exp-note-table-wrap"><table><thead><tr>' + th + '</tr></thead><tbody>' + trs + '</tbody></table></div>');
                continue;
            }

            var para = [escHtml(line)];
            i++;
            while (i < lines.length) {
                var next = lines[i] || '';
                var nextTrim = next.trim();
                if (!nextTrim || nextTrim.indexOf('<div class="exp-note-section-header">') === 0 || (isTableRow(next) && i + 1 < lines.length && isSeparatorRow(lines[i + 1]))) {
                    break;
                }
                para.push(escHtml(next));
                i++;
            }
            out.push('<p>' + para.join('<br>') + '</p>');
        }

        return out.join('');
    }

    function renderMd(text) {
        if (!text) return '';
        var latexStore = [];

        function storeTex(raw) {
            var idx = latexStore.length;
            latexStore.push(raw);
            return '\x00TEX' + idx + '\x00';
        }

        var s = text;
        // 块级 $$ ... $$
        s = s.replace(/\$\$([\s\S]+?)\$\$/g, function (m) {
            return storeTex(m);
        });
        // 行内 $ ... $
        s = s.replace(/\$([^$\n]+?)\$/g, function (m) {
            return storeTex(m);
        });
        // \( ... \)
        s = s.replace(/\\\(([\s\S]+?)\\\)/g, function (m) {
            return storeTex(m);
        });
        // \[ ... \]
        s = s.replace(/\\\[([\s\S]+?)\\]/g, function (m) {
            return storeTex(m);
        });
        // 将 【章节标题】 转为带样式的 div
        s = s.replace(/^(【[^】]+】)\s*$/gm, function (_, h) {
            return '<div class="exp-note-section-header">' + h + '</div>';
        });
        // Markdown 解析
        var html;
        if (typeof marked !== 'undefined' && marked.parse) {
            if (!renderMd._configured) {
                marked.setOptions({breaks: true, gfm: true});
                renderMd._configured = true;
            }
            html = marked.parse(s);
        } else {
            html = _renderMarkdownFallback(s);
        }
        // 还原 LaTeX
        html = html.replace(/\x00TEX(\d+)\x00/g, function (_, i) {
            return latexStore[parseInt(i, 10)] || '';
        });
        return html;
    }

    function renderTitleHtml(text) {
        if (!text) return '';
        var latexStore = [];

        function storeTex(raw) {
            var idx = latexStore.length;
            latexStore.push(raw);
            return '\x00TEX' + idx + '\x00';
        }

        var s = String(text);
        s = s.replace(/\$\$([\s\S]+?)\$\$/g, function (m) {
            return storeTex(m);
        });
        s = s.replace(/\$([^$\n]+?)\$/g, function (m) {
            return storeTex(m);
        });
        s = s.replace(/\\\(([\s\S]+?)\\\)/g, function (m) {
            return storeTex(m);
        });
        s = esc(s);
        return s.replace(/\x00TEX(\d+)\x00/g, function (_, i) {
            return latexStore[parseInt(i, 10)] || '';
        });
    }

    function retypeset() {
        var els = [];
        for (var i = 0; i < arguments.length; i++) {
            if (arguments[i]) els.push(arguments[i]);
        }
        if (!els.length) return;
        if (window.MathJax) {
            if (typeof MathJax.typesetPromise === 'function') {
                MathJax.typesetPromise(els).catch(function (err) {
                    console.debug('[Notes] MathJax typeset error:', err);
                });
            } else if (MathJax.Hub) {
                MathJax.Hub.Queue(['Typeset', MathJax.Hub, els[0]]);
            }
        } else {
            var waited = 0;
            var args = els;
            var poll = setInterval(function () {
                waited += 100;
                if (window.MathJax) {
                    clearInterval(poll);
                    retypeset.apply(null, args);
                } else if (waited >= 3000) {
                    clearInterval(poll);
                }
            }, 100);
        }
    }

    function setSt(el, cls, msg) {
        if (!el) return;
        el.className = 'exp-note-status ' + (cls || '');
        el.textContent = msg || '';
    }

    function setGSt(el, cls, msg) {
        if (!el) return;
        el.className = 'exp-notes-global-status ' + (cls || '');
        el.textContent = msg || '';
    }

    function confirmDialog(msg) {
        return new Promise(function (resolve) {
            var ov = document.createElement('div');
            ov.className = 'exp-notes-confirm-overlay';
            ov.innerHTML = '<div class="exp-notes-confirm-box"><p>' + msg + '</p>' +
                '<div class="exp-notes-confirm-actions">' +
                '<button class="exp-notes-confirm-cancel">取消</button>' +
                '<button class="exp-notes-confirm-delete">确认删除</button>' +
                '</div></div>';
            document.body.appendChild(ov);
            ov.querySelector('.exp-notes-confirm-cancel').onclick = function () {
                ov.remove();
                resolve(false);
            };
            ov.querySelector('.exp-notes-confirm-delete').onclick = function () {
                ov.remove();
                resolve(true);
            };
            ov.onclick = function (e) {
                if (e.target === ov) {
                    ov.remove();
                    resolve(false);
                }
            };
        });
    }

    function _noteToMarkdown(note, experimentKey, index) {
        var title = (note.title || '').trim() || ('笔记 ' + index);
        var lines = [];
        lines.push('# ' + title);
        lines.push('');
        lines.push('- 实验：' + (experimentKey || 'unknown'));
        lines.push('- 导出时间：' + new Date().toLocaleString());
        lines.push('');
        lines.push((note.content || '').trim() || '（暂无内容）');
        lines.push('');
        return {title: title, content: lines.join('\n')};
    }

    function _noteToPlainText(note, experimentKey, index) {
        var title = (note.title || '').trim() || ('笔记 ' + index);
        var lines = [];
        lines.push(title);
        lines.push('');
        lines.push('实验：' + (experimentKey || 'unknown'));
        lines.push('导出时间：' + new Date().toLocaleString());
        lines.push('');
        lines.push((note.content || '').trim() || '（暂无内容）');
        lines.push('');
        return {title: title, content: lines.join('\n')};
    }

    function _noteToHtml(note, experimentKey, index) {
        var title = (note.title || '').trim() || ('笔记 ' + index);
        var bodyHtml = renderMd(note.content || '（暂无内容）');
        var html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            + '<meta name="viewport" content="width=device-width, initial-scale=1">'
            + '<title>' + esc(title) + '</title>'
            + '<script>window.MathJax={tex:{inlineMath:[["$","$"],["\\\\(","\\\\)"]],displayMath:[["$$","$$"],["\\\\[","\\\\]"]]}};</script>'
            + '<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>'
            + '<style>body{max-width:920px;margin:28px auto;padding:0 16px;color:#333;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;line-height:1.72}h1{color:#D84315}hr{border:none;border-top:1px solid #eee;margin:16px 0}.meta{color:#777;font-size:14px}pre,code{font-family:Consolas,Monaco,monospace}</style>'
            + '</head><body>'
            + '<h1>' + renderTitleHtml(title) + '</h1>'
            + '<p class="meta">实验：' + esc(experimentKey || 'unknown') + '<br>导出时间：' + esc(new Date().toLocaleString()) + '</p>'
            + '<hr>'
            + bodyHtml
            + '</body></html>';
        return {title: title, content: html};
    }

    function _buildExportPayload(note, experimentKey, index, format) {
        if (format === 'html') return _noteToHtml(note, experimentKey, index);
        if (format === 'txt') return _noteToPlainText(note, experimentKey, index);
        return _noteToMarkdown(note, experimentKey, index);
    }

    function _downloadTextFile(filename, text, mimeType) {
        var blob = new Blob([text], {type: (mimeType || 'text/plain') + ';charset=utf-8'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 0);
    }

    function _pickNotesToExport(notes) {
        return new Promise(function (resolve) {
            var ov = document.createElement('div');
            ov.className = 'exp-notes-confirm-overlay';

            var itemsHtml = notes.map(function (n, idx) {
                var t = (n.title || '').trim() || ('笔记 ' + (idx + 1));
                return '<label class="exp-notes-export-item">'
                    + '<input type="checkbox" class="exp-notes-export-checkbox" value="' + idx + '" checked>'
                    + '<span class="exp-notes-export-title">' + renderTitleHtml(t) + '</span>'
                    + '</label>';
            }).join('');

            ov.innerHTML = '<div class="exp-notes-confirm-box exp-notes-export-box">'
                + '<p><strong>选择要导出的笔记</strong></p>'
                + '<div class="exp-notes-export-format">'
                + '  <label for="_enExportFormat">导出格式：</label>'
                + '  <select id="_enExportFormat" class="exp-notes-export-format-select">'
                + '    <option value="md" selected>Markdown (.md)</option>'
                + '    <option value="html">HTML（支持公式渲染）(.html)</option>'
                + '    <option value="txt">纯文本 (.txt)</option>'
                + '  </select>'
                + '</div>'
                + '<div class="exp-notes-export-list">' + itemsHtml + '</div>'
                + '<div class="exp-notes-confirm-actions">'
                + '  <button class="exp-notes-confirm-cancel" id="_enPickCancel">取消</button>'
                + '  <button class="exp-notes-confirm-cancel" id="_enPickAll">全选</button>'
                + '  <button class="exp-notes-confirm-delete" id="_enPickOk">导出所选</button>'
                + '</div>'
                + '</div>';

            document.body.appendChild(ov);
            retypeset(ov);

            function done(v) {
                ov.remove();
                resolve(v);
            }

            ov.querySelector('#_enPickCancel').onclick = function () {
                done(null);
            };
            ov.querySelector('#_enPickAll').onclick = function () {
                ov.querySelectorAll('.exp-notes-export-checkbox').forEach(function (cb) {
                    cb.checked = true;
                });
            };
            ov.querySelector('#_enPickOk').onclick = function () {
                var sel = [];
                ov.querySelectorAll('.exp-notes-export-checkbox:checked').forEach(function (cb) {
                    sel.push(parseInt(cb.value, 10));
                });
                if (!sel.length) {
                    alert('请至少选择一条笔记再导出。');
                    return;
                }
                var fmt = (ov.querySelector('#_enExportFormat') || {}).value || 'md';
                done({indices: sel, format: fmt});
            };
            ov.onclick = function (e) {
                if (e.target === ov) {
                    done(null);
                }
            };
        });
    }


// ─── 行为追踪器 ────────────────────────────────────────────────
    var _tracker = {
        _events: [],
        _startTime: null,
        _maxEvents: 200,
        start: function () {
            this._startTime = Date.now();
            this._events = [];
        },
        push: function (type, data) {
            if (!this._startTime) return;
            if (this._events.length >= this._maxEvents) {
                this._events.shift();
            }
            this._events.push({t: Math.round((Date.now() - this._startTime) / 1000), type: type, data: data || null});
        },
        export: function () {
            return {
                session_duration_s: this._startTime ? Math.round((Date.now() - this._startTime) / 1000) : 0,
                event_count: this._events.length,
                events: this._events.slice()
            };
        },
        clear: function () {
            this._events = [];
            this._startTime = Date.now();
        }
    };

    function _autoBindTracker() {
        setTimeout(function () {
            var algoBtns = [
                {id: 'golden-section-btn', algo: '黄金分割法'},
                {id: 'fibonacci-btn', algo: '斐波那契数列法'},
                {id: 'bisection-btn', algo: '二分法'},
                {id: 'gd-btn', algo: '梯度下降法'},
                {id: 'newton-btn', algo: '牛顿法'},
                {id: 'secant-btn', algo: '割线法'}
            ];
            algoBtns.forEach(function (b) {
                var el = document.getElementById(b.id);
                if (el) el.addEventListener('click', function () {
                    _tracker.push('algorithm_switch', {algorithm: b.algo});
                }, {capture: true});
            });
            ['play-btn', 'pause-btn', 'step-btn', 'reset-btn'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.addEventListener('click', function () {
                    _tracker.push('control', {action: id.replace('-btn', '')});
                }, {capture: true});
            });
            var funcSel = document.getElementById('function-select');
            if (funcSel) funcSel.addEventListener('change', function () {
                _tracker.push('function_change', {value: funcSel.value});
            }, {capture: true});
            var confirmBtn = document.getElementById('confirm-custom-func');
            if (confirmBtn) confirmBtn.addEventListener('click', function () {
                var inp = document.getElementById('custom-expr-input');
                _tracker.push('custom_function', {expr: inp ? inp.value : ''});
            }, {capture: true});
            var sliders = [
                'initial-a', 'initial-b', 'precision', 'iterations',
                'initial-x0', 'initial-x_prev', 'learning-rate',
                'golden-epsilon', 'fib-n', 'fib-epsilon', 'bis-epsilon',
                'initial-point0-slider', 'initial-point-1-slider'
            ];
            sliders.forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.addEventListener('change', function () {
                    _tracker.push('param_change', {param: id, value: el.value});
                }, {capture: true});
            });
            document.querySelectorAll('.viz-tab').forEach(function (tab) {
                tab.addEventListener('click', function () {
                    _tracker.push('view_switch', {view: tab.dataset.view || tab.textContent.trim()});
                }, {capture: true});
            });
        }, 500);
    }

    var _cfg = {}, _notes = [], _saveTimers = {}, _listEl = null, _gStEl = null;
    var _pendingAiRetry = null;
    var _mountEl = null;

    function _refreshAuthUiState() {
        if (!_mountEl) return;
        var logged = isLoggedIn();
        var hint = _mountEl.querySelector('#_enHint');
        if (hint) hint.style.display = logged ? 'none' : 'inline';

        var saveBtn = _mountEl.querySelector('#_enSave');
        if (saveBtn) saveBtn.textContent = logged ? '保存' : '本地暂存';
    }

    function init(cfg) {
        _cfg = cfg || {};
        if (!_cfg.experimentKey) {
            console.warn('[Notes] experimentKey required');
            return;
        }

        // 自动挂载数据提取函数到 AI 侧栏钩子，实现感知增强
        if (typeof _cfg.getPageData === 'function') {
            window.AI_GET_PAGE_DATA = _cfg.getPageData;
        }
        var mount = document.querySelector(_cfg.mountSelector || '#exp-notes-mount');
        if (!mount) {
            console.warn('[Notes] mount not found');
            return;
        }
        _tracker.start();
        _tracker.push('session_start', {experiment_key: _cfg.experimentKey, url: location.pathname});
        _autoBindTracker();
        _shell(mount);
        _load();
    }

    function _shell(mount) {
        _mountEl = mount;
        const params = (window.location.search || '') + (window.location.hash || '');
        const isDev = /[?&]dev(=|&|$)/.test(params);
        const devBtnHtml = isDev ? '<button class="exp-notes-action-btn secondary" id="_enDevExport" style="background:#455a64;color:white;">导出开发数据</button>' : '';

        mount.innerHTML =
            '<section class="exp-notes-section">' +
            '<div class="exp-notes-header">' +
            '  <div class="exp-notes-header-left">' +
            '    <h2>实验笔记</h2>' +
            '    ' + devBtnHtml +
            '    <span class="exp-notes-login-hint" id="_enHint" style="display:none">（未登录：仅本地填写与导出，无法保存到云端，<a href="/auth/login" class="exp-notes-login-link js-open-login-modal">立即登录</a>）</span>' +
            '  </div>' +
            '  <div class="exp-notes-actions">' +
            '    <button class="exp-notes-action-btn secondary" id="_enSave">保存</button>' +
            '    <button class="exp-notes-action-btn secondary" id="_enExp">导出笔记</button>' +
            '    <button class="exp-notes-action-btn ai" id="_enAI">AI 生成笔记</button>' +
            '  </div>' +
            '</div>' +
            '<p class="exp-notes-global-status" id="_enGSt"></p>' +
            '<div class="exp-notes-list" id="_enList"></div>' +
            '</section>';
        _listEl = mount.querySelector('#_enList');
        _gStEl = mount.querySelector('#_enGSt');

        var saveBtn = mount.querySelector('#_enSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', _saveAll);
        }

        var expBtn = mount.querySelector('#_enExp');
        if (expBtn) expBtn.addEventListener('click', _export);

        var aiBtn = mount.querySelector('#_enAI');
        if (aiBtn) aiBtn.addEventListener('click', function () {
            _aiGen();
        });

        if (isDev) {
            var devBtn = mount.querySelector('#_enDevExport');
            if (devBtn) devBtn.addEventListener('click', _exportDevData);
        }

        _refreshAuthUiState();
    }

    function _renderList() {
        if (!_listEl) return;
        _listEl.innerHTML = '';
        if (!_notes.length) {
            var em = document.createElement('div');
            em.className = 'exp-notes-empty';
            em.innerHTML = '<p>暂无笔记，点击下方按钮开始记录</p>' + '<button class="exp-notes-add-btn">＋ 添加实验笔记</button>';
            em.querySelector('button').addEventListener('click', _addNote);
            _listEl.appendChild(em);
        } else {
            _notes.forEach(function (n) {
                _listEl.appendChild(_card(n));
            });
            var ab = document.createElement('button');
            ab.className = 'exp-notes-add-btn';
            ab.style.marginTop = '4px';
            ab.textContent = '＋ 添加实验笔记';
            ab.addEventListener('click', _addNote);
            _listEl.appendChild(ab);
        }
    }

    function _card(note) {
        var c = document.createElement('div');
        c.className = 'exp-note-card';
        c.innerHTML =
            '<div class="exp-note-card-header">' +
            '  <div class="exp-note-title-wrap">' +
            '    <input class="exp-note-title-input" type="text" placeholder="笔记标题…" value="' + esc(note.title || '') + '">' +
            '    <div class="exp-note-title-render" style="display:none"></div>' +
            '  </div>' +
            '  <button class="exp-note-delete-btn" title="删除">&#10005;</button>' +
            '</div>' +
            '<div class="exp-note-body">' +
            '  <textarea class="exp-note-content-input" placeholder="支持 Markdown 和 LaTeX 公式…" rows="5"></textarea>' +
            '  <div class="exp-note-render-view"></div>' +
            '</div>' +
            '<div class="exp-note-footer">' +
            '  <span class="exp-note-status"></span>' +
            '  <div class="exp-note-footer-actions"><button class="exp-note-toggle-btn">预览</button></div>' +
            '</div>';
        var ti = c.querySelector('.exp-note-title-input'),
            tr = c.querySelector('.exp-note-title-render'),
            ci = c.querySelector('.exp-note-content-input'),
            rv = c.querySelector('.exp-note-render-view'),
            st = c.querySelector('.exp-note-status'),
            tb = c.querySelector('.exp-note-toggle-btn'),
            db = c.querySelector('.exp-note-delete-btn');
        ci.value = note.content || '';
        var prev = false;
        tb.addEventListener('click', function () {
            prev = !prev;
            if (prev) {
                rv.innerHTML = renderMd(ci.value);
                if (tr) {
                    tr.innerHTML = renderTitleHtml(ti.value);
                    tr.style.display = 'block';
                    tr.classList.add('active');
                }
                ti.style.display = 'none';
                retypeset(rv, tr);
                rv.classList.add('active');
                ci.style.display = 'none';
                tb.textContent = '编辑';
            } else {
                rv.classList.remove('active');
                if (tr) {
                    tr.classList.remove('active');
                    tr.style.display = 'none';
                    tr.innerHTML = '';
                }
                ti.style.display = 'block';
                ci.style.display = 'block';
                tb.textContent = '预览';
            }
        });
        rv.addEventListener('click', function () {
            if (prev) tb.click();
        });

        function sched() {
            var k = note.id || note._lid;
            if (_saveTimers[k]) clearTimeout(_saveTimers[k]);
            _saveTimers[k] = setTimeout(function () {
                _saveOne(note, c, st);
            }, 0);
        }

        ti.addEventListener('blur', function () {
            if (ti.value !== note.title) {
                note.title = ti.value;
                sched();
            }
        });
        ci.addEventListener('blur', function () {
            if (ci.value !== note.content) {
                note.content = ci.value;
                sched();
            }
        });
        db.addEventListener('click', async function () {
            var ok = await confirmDialog('确定要删除这条笔记吗？<br><strong>此操作不可撤销。</strong>');
            if (ok) _del(note);
        });
        return c;
    }

    async function _load() {
        if (!isLoggedIn()) {
            _renderList();
            return;
        }
        var d = await apiSafe(function () {
            return apiGet('/notes/' + encodeURIComponent(_cfg.experimentKey));
        });
        _notes = Array.isArray(d) ? d : [];
        _renderList();
    }

    async function _addNote() {
        var n = {
            _lid: 'l' + Date.now(),
            id: null,
            title: '',
            content: '',
            sort_order: _notes.length,
            experiment_key: _cfg.experimentKey
        };
        if (isLoggedIn()) {
            var d = await apiSafe(function () {
                return apiRequest('/notes/' + encodeURIComponent(_cfg.experimentKey), {
                    method: 'POST',
                    body: JSON.stringify({
                        experiment_key: _cfg.experimentKey,
                        title: '',
                        content: '',
                        sort_order: n.sort_order
                    })
                });
            });
            if (d && d.id) {
                n.id = d.id;
                n.created_at = d.created_at;
                n.updated_at = d.updated_at;
            }
        }
        _notes.push(n);
        _renderList();
        var cs = _listEl ? _listEl.querySelectorAll('.exp-note-card') : [];
        if (cs.length) {
            var l = cs[cs.length - 1];
            l.scrollIntoView({behavior: 'smooth', block: 'center'});
            var t = l.querySelector('.exp-note-title-input');
            if (t) setTimeout(function () {
                t.focus();
            }, 200);
        }
    }

    async function _saveOne(note, card, stEl) {
        if (card) {
            var ti = card.querySelector('.exp-note-title-input'), ci = card.querySelector('.exp-note-content-input');
            if (ti) note.title = ti.value;
            if (ci) note.content = ci.value;
        }
        if (!note.id || !isLoggedIn()) {
            setSt(stEl, 'saved', '本地已更新');
            return;
        }
        setSt(stEl, 'saving', '保存中...');
        var d = await apiSafe(function () {
            return apiRequest('/notes/item/' + note.id, {
                method: 'PUT',
                body: JSON.stringify({title: note.title, content: note.content, sort_order: note.sort_order})
            });
        });
        if (d && d.id) {
            note.updated_at = d.updated_at;
            setSt(stEl, 'saved', '已保存 ' + fmtTime(new Date()));
        } else setSt(stEl, 'error', '保存失败');
    }

    async function _saveAll() {
        var logged = isLoggedIn();
        setGSt(_gStEl, 'saving', logged ? '保存中...' : '本地整理中...');
        var cs = _listEl ? _listEl.querySelectorAll('.exp-note-card') : [];
        for (var i = 0; i < _notes.length; i++) await _saveOne(_notes[i], cs[i] || null, cs[i] ? cs[i].querySelector('.exp-note-status') : null);
        setGSt(_gStEl, 'saved', (logged ? '全部已保存 ' : '本地已整理 ') + fmtTime(new Date()));
    }

    async function _del(note) {
        if (note.id && isLoggedIn()) await apiSafe(function () {
            return apiRequest('/notes/item/' + note.id, {method: 'DELETE'});
        });
        _notes = _notes.filter(function (n) {
            return (n.id || n._lid) !== (note.id || note._lid);
        });
        _renderList();
    }

    async function _export() {
        if (!_notes.length) {
            alert('暂无笔记可导出。');
            return;
        }
        await _saveAll();

        var selection = await _pickNotesToExport(_notes);
        if (!selection) return;

        var selectedIdx = selection.indices || [];
        var fmt = selection.format || 'md';
        var ext = fmt === 'html' ? '.html' : (fmt === 'txt' ? '.txt' : '.md');
        var mime = fmt === 'html' ? 'text/html' : (fmt === 'txt' ? 'text/plain' : 'text/markdown');

        selectedIdx.forEach(function (i) {
            var note = _notes[i];
            var payload = _buildExportPayload(note, _cfg.experimentKey, i + 1, fmt);
            var name = _sanitizeFilename((i + 1) + '-' + payload.title) + ext;
            _downloadTextFile(name, payload.content, mime);
        });
    }

    async function _exportDevData() {
        var pd = {};
        if (typeof _cfg.getPageData === 'function') {
            try {
                pd = _cfg.getPageData() || {};
            } catch (e) {
                console.error('[Notes] Error collecting page data:', e);
            }
        }
        // 注入行为轨迹
        pd._behavior = _tracker.export();

        var trainItem = {
            experiment_key: _cfg.experimentKey,
            label: document.title,
            experiment_data: pd
        };

        var jsonStr = JSON.stringify(trainItem, null, 2);
        var name = 'train_' + _cfg.experimentKey + '_' + Date.now() + '.json';
        _downloadTextFile(name, jsonStr, 'application/json');
    }

    function _collectAiPayloadSnapshot() {
        var pd = {};
        if (typeof _cfg.getPageData === 'function') {
            try {
                pd = _cfg.getPageData() || {};
                console.log('[Notes] Page data collected:', pd);
            } catch (e) {
                console.error('[Notes] Error collecting page data:', e);
            }
        }
        pd._behavior = _tracker.export();
        pd.guidebook = (window.AI_CONFIG && window.AI_CONFIG.GUIDEBOOK) || '';
        return pd;
    }

    function _hasNonEmptyIterationLogValue(v) {
        // `iteration_log/iteration_data` 在部分页面可能是数组，也可能是对象（对象的 value 为数组）。
        if (Array.isArray(v)) return v.length > 0;
        if (!v || typeof v !== 'object') return false;
        return Object.values(v).some(function (item) {
            return Array.isArray(item) && item.length > 0;
        });
    }

    function _payloadHasExperimentData(pd) {
        if (!pd || typeof pd !== 'object') return false;

        // 单纯形法：常用的“已求解证据”
        if (typeof pd.iteration_card_count === 'number' && pd.iteration_card_count > 0) return true;
        if (Array.isArray(pd.simplex_tableau_steps) && pd.simplex_tableau_steps.length > 0) return true;
        if (pd.simplex_run_record) return true;

        // 收敛结果：有最终结果通常意味着已产生实验数据
        if (pd.convergence_result) {
            if (Array.isArray(pd.convergence_result)) return pd.convergence_result.length > 0;
            if (typeof pd.convergence_result === 'object') {
                var vals = Object.values(pd.convergence_result);
                return vals.some(function (x) {
                    if (x === null || x === undefined) return false;
                    if (typeof x === 'object') return Object.keys(x || {}).length > 0;
                    return true;
                });
            }
        }

        // 通用：扫描任意层级中“iteration+log”的字段是否含非空数据。
        // 例如：range-search/point-search/smo/kernel-trick 均使用 iteration_log。
        function scan(obj, depth) {
            if (depth < 0 || !obj || typeof obj !== 'object') return false;
            if (Array.isArray(obj)) return false;
            return Object.keys(obj).some(function (k) {
                if (k === '_behavior' || k === 'guidebook') return false;
                var v = obj[k];
                var kLower = String(k).toLowerCase();

                // 只处理关键命名：避免把初始参数当作“实验数据”
                var isIterLogKey = kLower.includes('iteration') && (kLower.includes('log') || kLower.includes('data'));
                if (isIterLogKey) return _hasNonEmptyIterationLogValue(v);

                return scan(v, depth - 1);
            });
        }

        return scan(pd, 4);
    }

    function _payloadHasExperimentDataForCurrentExperiment(pd) {
        // 核技巧：只要“parse_csv/过程日志”并不算实验数据，
        // 需要至少完成一次可视化后 state.points 才会非空（即 sample_count > 0）。
        if (_cfg && _cfg.experimentKey === 'svm-smo.kernel_trick.visualization') {
            var sc = pd ? pd.sample_count : null;
            return Number.isFinite(sc) && sc > 0;
        }

        // 两阶段法：仅初始输入不算实验数据，必须至少有一阶段迭代步骤
        if (_cfg && _cfg.experimentKey === 'linear-programming.two_phase') {
            if (pd && typeof pd.iteration_card_count === 'number' && pd.iteration_card_count > 0) return true;
            if (pd && Array.isArray(pd.phase1_iteration_log) && pd.phase1_iteration_log.length > 0) return true;
            return pd && Array.isArray(pd.phase2_iteration_log) && pd.phase2_iteration_log.length > 0;

        }

        // 区间收缩法性质对比：初始化时每个算法会记录 iter=0 的初始状态，不能算“已运行实验”。
        // 这里要求至少出现一次有效迭代推进（iter > 0），避免误判。
        if (_cfg && _cfg.experimentKey === 'line-search.range_search.comparison') {
            var logs = pd && pd.iteration_log;
            if (!logs || typeof logs !== 'object') return false;
            return Object.values(logs).some(function (arr) {
                if (!Array.isArray(arr) || arr.length === 0) return false;
                return arr.some(function (row) {
                    if (!row || typeof row !== 'object') return false;
                    var iterVal = row.iteration;
                    if (!Number.isFinite(iterVal)) iterVal = row.iter;
                    var iterNum = Number(iterVal);
                    return Number.isFinite(iterNum) && iterNum > 0;
                });
            });
        }

        return _payloadHasExperimentData(pd);
    }

    function _getExperimentDataMissingMessage(experimentKey, pd) {
        if (!experimentKey) return '当前尚无可用的实验数据，无法生成笔记。';

        if (experimentKey === 'linear-programming.simplex') {
            return '当前尚无实验数据，请先运行一次单纯形法求解。';
        }

        if (experimentKey === 'linear-programming.two_phase') {
            return '当前尚无实验数据，请先运行一次两阶段法求解。';
        }

        if (
            experimentKey === 'line-search.range_search.observation' ||
            experimentKey === 'line-search.point_search.observation'
        ) {
            return '当前尚无迭代数据，请先运行一次完整实验。';
        }

        if (experimentKey === 'line-search.range_search.comparison') {
            return '暂无实验数据，请先运行实验';
        }

        if (experimentKey === 'line-search.point_search.comparison') {
            return '当前尚无迭代数据，请先运行一次实验。';
        }

        if (experimentKey === 'line-search.application.main') {
            var lsLog = pd && pd.ls ? pd.ls.iteration_log : null;
            var profitLog = pd && pd.profit ? pd.profit.iteration_log : null;
            var hasLs = Array.isArray(lsLog) && lsLog.length > 0;
            var hasProfit = Array.isArray(profitLog) && profitLog.length > 0;
            if (!hasLs && !hasProfit) return '当前尚无迭代数据，请先运行一次完整拟合实验。';
            return '当前阶段尚无可用的迭代数据，无法生成笔记。';
        }

        if (experimentKey === 'svm-smo.smo_iteration.observation') {
            return '当前尚无迭代数据，请先播放或单步运行一次 SMO 算法。';
        }

        if (experimentKey === 'svm-smo.kernel_trick.visualization') {
            return '未检测到可用数据，请先上传或加载预设数据集。';
        }

        return '当前尚无可用的实验数据，无法生成笔记。';
    }

    function _isLikelyDomEventObject(obj) {
        if (!obj || typeof obj !== 'object') return false;
        return (
            typeof obj.isTrusted === 'boolean' ||
            typeof obj.preventDefault === 'function' ||
            typeof obj.stopPropagation === 'function' ||
            'target' in obj ||
            'currentTarget' in obj ||
            'srcElement' in obj
        );
    }

    function _normalizeAiPayloadOverride(payloadOverride) {
        if (!payloadOverride || typeof payloadOverride !== 'object') return null;
        if (_isLikelyDomEventObject(payloadOverride)) return null;

        var hasUsefulKeys = Object.keys(payloadOverride).some(function (k) {
            return k !== 'isTrusted' && k !== 'timeStamp' && k !== 'type';
        });
        return hasUsefulKeys ? payloadOverride : null;
    }

    async function _aiGen(payloadOverride) {
        if (!isLoggedIn()) {
            _pendingAiRetry = {
                payload: _collectAiPayloadSnapshot(),
                at: Date.now()
            };
            if (window.LoginModal && typeof window.LoginModal.open === 'function') {
                window.LoginModal.open();
            } else {
                alert('请先登录后再使用 AI 生成笔记。');
            }
            return;
        }
        var btn = document.querySelector('#_enAI');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="exp-notes-ai-spinner"></span>生成中…';
        }
        setGSt(_gStEl, 'saving', 'AI 正在生成实验笔记，请稍候…');
        try {
            var pd = _normalizeAiPayloadOverride(payloadOverride) || _collectAiPayloadSnapshot();
            console.log('[Notes] Sending AI request with data keys:', Object.keys(pd));

            // 生成前校验：没有实验数据就不请求后端（与“查看实验数据”一致的行为体验）
            if (!_payloadHasExperimentDataForCurrentExperiment(pd)) {
                var msg = _getExperimentDataMissingMessage(_cfg.experimentKey, pd);
                setGSt(_gStEl, 'error', msg);
                alert(msg);
                return;
            }

            var d = await apiRequest('/notes/' + encodeURIComponent(_cfg.experimentKey) + '/ai-generate', {
                method: 'POST',
                body: JSON.stringify(pd)
            });

            console.log('[Notes] AI response:', d);

            if (d && d.id) {
                _pendingAiRetry = null;
                _notes.push(d);
                _renderList();
                var cs = _listEl ? _listEl.querySelectorAll('.exp-note-card') : [];
                if (cs.length) {
                    var lastCard = cs[cs.length - 1];
                    lastCard.scrollIntoView({behavior: 'smooth', block: 'center'});
                    var tb = lastCard.querySelector('.exp-note-toggle-btn');
                    if (tb) setTimeout(function () {
                        tb.click();
                    }, 300);
                }
                setGSt(_gStEl, 'saved', 'AI 笔记已生成并保存 ' + fmtTime(new Date()));
            } else {
                console.error('[Notes] AI response missing id:', d);
                setGSt(_gStEl, 'error', 'AI 生成失败：响应数据无效。请检查浏览器控制台。');
            }
        } catch (e) {
            console.error('[Notes] AI generation error:', e);
            var isAuthError = e && (e.status === 401 || /认证|登录|未认证|未登录|Not authenticated|Unauthorized|credentials/i.test(e.message || ''));
            var isProviderAuthError = e && /authenticationerror|api\s*key|鉴权失败|密钥|unauthorized/i.test(String(e.message || ''));
            if (isAuthError) {
                _pendingAiRetry = {
                    payload: _collectAiPayloadSnapshot(),
                    at: Date.now()
                };
                setGSt(_gStEl, 'error', '登录状态已失效，请先登录，登录成功后将自动重试本次 AI 生成。');
                if (window.LoginModal && typeof window.LoginModal.open === 'function') {
                    window.LoginModal.open();
                }
            } else if (isProviderAuthError) {
                setGSt(_gStEl, 'error', 'AI 服务鉴权失败：请联系管理员检查 DEEPSEEK_API_KEY 配置。');
            } else {
                var detail = e && e.message ? String(e.message) : '未知错误';
                // 这是“预期内”的失败（例如无实验数据导致后端 400），不要再额外提示“请检查浏览器控制台”
                setGSt(_gStEl, 'error', 'AI 生成失败：' + detail);
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'AI 生成笔记';
            }
        }
    }

// 公开接口
    function getNotes() {
        return _notes.slice();
    }

    function appendNote(note) {
        if (note && (note.id || note._lid)) {
            _notes.push(note);
            _renderList();
        }
    }

    function trackEvent(type, data) {
        _tracker.push(type, data);
    }

    function getBehavior() {
        return _tracker.export();
    }

    global.ExperimentNotes = {
        init: init,
        getNotes: getNotes,
        appendNote: appendNote,
        trackEvent: trackEvent,
        getBehavior: getBehavior
    };

// 自动初始化逻辑：若页面定义了 EXPERIMENT_NOTES_CONFIG 则自动执行
    document.addEventListener('DOMContentLoaded', function () {
        if (global.EXPERIMENT_NOTES_CONFIG) {
            init(global.EXPERIMENT_NOTES_CONFIG);
        }

        document.addEventListener('click', function (e) {
            var trigger = e.target.closest('.js-open-login-modal');
            if (!trigger) return;
            e.preventDefault();
            if (window.LoginModal && typeof window.LoginModal.open === 'function') {
                window.LoginModal.open();
            } else {
                window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.href);
            }
        });

        document.addEventListener('optlab:auth-success', function () {
            if (!_cfg || !_cfg.experimentKey) return;
            _refreshAuthUiState();
            _load();
            setGSt(_gStEl, 'saved', '登录成功，已恢复云端保存能力。');

            if (_pendingAiRetry && _pendingAiRetry.payload) {
                var retryPayload = _pendingAiRetry.payload;
                _pendingAiRetry = null;
                setGSt(_gStEl, 'saving', '已恢复登录，正在自动重试刚才的 AI 生成...');
                _aiGen(retryPayload);
            }
        });
    });

}(window));
