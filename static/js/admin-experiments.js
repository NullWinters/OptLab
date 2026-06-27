/**
 * 数据管理页面 JS — 实验记录 / 笔记 / AI 会话
 */
(function () {
    'use strict';

    var currentTab = 'experiments';
    var filters = {
        exp: { page: 1, type: '', user: '' },
        note: { page: 1, key: '', user: '' },
        chat: { page: 1, user: '' }
    };
    var filterTimers = {};
    var pendingNoteDeleteId = null;

    function init() {
        loadTypes();
        loadCurrentTab();
        document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.admin-tab-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentTab = btn.dataset.tab;
                document.querySelectorAll('.admin-tab-panel').forEach(function(p) { p.style.display = 'none'; });
                var panel = document.getElementById('tab-' + currentTab);
                if (panel) panel.style.display = '';
                loadCurrentTab();
            });
        });
    }

    window.addEventListener('admin-authenticated', init, { once: true });
    if (window.getAdminToken && window.getAdminToken()) {
        var m = document.getElementById('admin-main');
        if (m && m.style.display !== 'none') { window.removeEventListener('admin-authenticated', init); init(); }
    }

    window.loadCurrentTab = function() {
        if (currentTab === 'experiments') loadExperiments();
        else if (currentTab === 'notes') loadNotes();
        else if (currentTab === 'chats') loadChats();
    };

    window.debounceFilter = function(prefix) {
        if (filterTimers[prefix]) clearTimeout(filterTimers[prefix]);
        filterTimers[prefix] = setTimeout(function() {
            if (prefix === 'exp') { filters.exp.page = 1; loadExperiments(); }
            else if (prefix === 'note') { filters.note.page = 1; loadNotes(); }
            else if (prefix === 'chat') { filters.chat.page = 1; loadChats(); }
        }, 400);
    };

    // ── 实验类型 ──
    async function loadTypes() {
        try {
            var data = await adminApi('/api/admin/experiments/stats');
            var types = data.experiments_by_type || [];
            var sel = document.getElementById('exp-type-filter');
            if (!sel) return;
            types.forEach(function(t) {
                var opt = document.createElement('option');
                opt.value = t.source_page;
                opt.textContent = t.source_page + ' (' + t.count + ')';
                sel.appendChild(opt);
            });
        } catch(e) { console.error(e); }
    }

    // ── 实验记录 ──
    window.loadExperiments = async function(page) {
        if (page) filters.exp.page = page;
        var fs = filters.exp;
        var typeSel = document.getElementById('exp-type-filter');
        var userInput = document.getElementById('exp-user-filter');
        if (typeSel) fs.type = typeSel.value;
        if (userInput) fs.user = userInput.value.trim();
        var tbody = document.getElementById('exp-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6"><div class="admin-loading"><span class="admin-spinner"></span>加载中...</div></td></tr>';
        try {
            var params = 'page=' + fs.page + '&page_size=20';
            if (fs.type) params += '&source_page=' + encodeURIComponent(fs.type);
            if (fs.user) params += '&user_id=' + encodeURIComponent(fs.user);
            var data = await adminApi('/api/admin/experiments?' + params);
            if (!data.experiments || data.experiments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6"><div class="admin-empty">暂无实验记录</div></td></tr>';
            } else {
                tbody.innerHTML = data.experiments.map(function(e) {
                    return '<tr><td>' + e.id + '</td><td>' + escHtml(e.alias || '—') + '</td><td>' + escHtml(e.source_page || '—') +
                        '</td><td>' + escHtml(e.username) + '</td><td>' + fmtTime(e.created_at) + '</td>' +
                        '<td><button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="showExpDetail(' + e.id + ')">' +
                        '<i class="fas fa-eye"></i> 详情</button> ' +
                        '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="confirmDeleteExp(' + e.id + ')">' +
                        '<i class="fas fa-trash"></i> 删除</button></td></tr>';
                }).join('');
            }
            var pg = data.pagination;
            var pagEl = document.getElementById('exp-pagination');
            if (pagEl) pagEl.innerHTML = renderPagination(pg.page, pg.total_pages, 'loadExperiments');
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="admin-alert error">加载失败: ' + escHtml(e.message) + '</div></td></tr>';
        }
    };

    // ── 笔记 ──
    window.loadNotes = async function(page) {
        if (page) filters.note.page = page;
        var fs = filters.note;
        var keyInput = document.getElementById('note-key-filter');
        var userInput = document.getElementById('note-user-filter');
        if (keyInput) fs.key = keyInput.value.trim();
        if (userInput) fs.user = userInput.value.trim();
        var tbody = document.getElementById('note-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6"><div class="admin-loading"><span class="admin-spinner"></span>加载中...</div></td></tr>';
        try {
            var params = 'page=' + fs.page + '&page_size=20';
            if (fs.key) params += '&experiment_key=' + encodeURIComponent(fs.key);
            if (fs.user) params += '&user_id=' + encodeURIComponent(fs.user);
            var data = await adminApi('/api/admin/notes?' + params);
            if (!data.notes || data.notes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6"><div class="admin-empty">暂无笔记</div></td></tr>';
            } else {
                tbody.innerHTML = data.notes.map(function(n) {
                    return '<tr><td>' + n.id + '</td><td>' + escHtml(n.title || '—') + '</td><td>' + escHtml(n.experiment_key) +
                        '</td><td>' + escHtml(n.username) + '</td><td>' + fmtTime(n.updated_at) + '</td>' +
                        '<td><button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="showNoteDetail(' + n.id + ')">' +
                        '<i class="fas fa-eye"></i> 查看</button> ' +
                        '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="confirmDeleteNote(' + n.id + ',\'' + escHtml(n.title || '笔记') + '\')">' +
                        '<i class="fas fa-trash"></i> 删除</button></td></tr>';
                }).join('');
            }
            var pg = data.pagination;
            var pagEl = document.getElementById('note-pagination');
            if (pagEl) pagEl.innerHTML = renderPagination(pg.page, pg.total_pages, 'loadNotes');
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="admin-alert error">加载失败: ' + escHtml(e.message) + '</div></td></tr>';
        }
    };

    // ── 笔记详情（Markdown + LaTeX 渲染） ──
    window.showNoteDetail = async function(id) {
        var modal = document.getElementById('note-detail-modal');
        var contentEl = document.getElementById('note-detail-content');
        if (modal) modal.style.display = '';
        if (contentEl) contentEl.innerHTML = '<div class="admin-loading"><span class="admin-spinner"></span>加载中...</div>';
        try {
            var note = await adminApi('/api/admin/notes/' + id);
            document.getElementById('note-detail-title').textContent = note.title || '笔记 #' + note.id;
            document.getElementById('note-detail-key').textContent = note.experiment_key || '—';
            document.getElementById('note-detail-user').textContent = note.username || '—';
            document.getElementById('note-detail-time').textContent = fmtTime(note.updated_at);

            var rawContent = note.content || '(空)';
            var htmlContent = renderMarkdown(rawContent);
            if (contentEl) {
                contentEl.className = 'admin-note-render';
                contentEl.innerHTML = htmlContent;
            }

            // 触发 MathJax 重新渲染
            if (window.MathJax && window.MathJax.typesetPromise) {
                MathJax.typesetPromise([contentEl]).catch(function(err) {
                    console.warn('MathJax render error:', err);
                });
            }
        } catch(e) {
            if (contentEl) contentEl.innerHTML = '<div class="admin-alert error">加载失败: ' + escHtml(e.message) + '</div>';
        }
    };

    window.closeNoteDetail = function() {
        var el = document.getElementById('note-detail-modal');
        if (el) el.style.display = 'none';
    };

    // ── 笔记删除 ──
    window.confirmDeleteNote = function(id, title) {
        pendingNoteDeleteId = id;
        var el = document.getElementById('note-delete-msg');
        if (el) el.innerHTML = '确定删除笔记 <strong>' + escHtml(title) + '</strong> (#' + id + ') 吗？此操作不可撤销。';
        document.getElementById('note-delete-modal').style.display = '';
        document.getElementById('note-delete-btn').onclick = executeDeleteNote;
    };

    window.closeNoteDelete = function() {
        document.getElementById('note-delete-modal').style.display = 'none';
        pendingNoteDeleteId = null;
    };

    async function executeDeleteNote() {
        if (!pendingNoteDeleteId) return;
        var btn = document.getElementById('note-delete-btn');
        btn.disabled = true; btn.textContent = '删除中...';
        try {
            await adminApi('/api/admin/notes/' + pendingNoteDeleteId, { method: 'DELETE' });
            closeNoteDelete();
            loadNotes();
        } catch(e) { alert('删除失败: ' + e.message); }
        btn.disabled = false; btn.textContent = '确认删除';
    }

    // ── Markdown 渲染 ──
    function renderMarkdown(text) {
        if (typeof marked !== 'undefined' && marked.parse) {
            try {
                return marked.parse(text);
            } catch(e) {
                console.warn('Markdown parse error:', e);
            }
        }
        // 回退：转义 HTML 并保留换行
        return '<pre style="white-space:pre-wrap;font-family:inherit;">' + escHtml(text) + '</pre>';
    }

    // ── 聊天会话 ──
    window.loadChats = async function(page) {
        if (page) filters.chat.page = page;
        var fs = filters.chat;
        var userInput = document.getElementById('chat-user-filter');
        if (userInput) fs.user = userInput.value.trim();
        var tbody = document.getElementById('chat-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7"><div class="admin-loading"><span class="admin-spinner"></span>加载中...</div></td></tr>';
        try {
            var params = 'page=' + fs.page + '&page_size=20';
            if (fs.user) params += '&user_id=' + encodeURIComponent(fs.user);
            var data = await adminApi('/api/admin/chats?' + params);
            if (!data.chats || data.chats.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7"><div class="admin-empty">暂无会话</div></td></tr>';
            } else {
                tbody.innerHTML = data.chats.map(function(c) {
                    return '<tr><td class="mono">' + escHtml(String(c.id).substring(0, 8)) + '...</td>' +
                        '<td>' + escHtml(c.username) + '</td><td>' + escHtml(c.page_id) + '</td>' +
                        '<td>' + c.message_count + '</td>' +
                        '<td>' + (c.is_active ? '<span style="color:#2E7D32;">活跃</span>' : '<span style="color:#9E9E9E;">已关闭</span>') + '</td>' +
                        '<td>' + fmtTime(c.created_at) + '</td><td>' + fmtTime(c.updated_at) + '</td></tr>';
                }).join('');
            }
            var pg = data.pagination;
            var pagEl = document.getElementById('chat-pagination');
            if (pagEl) pagEl.innerHTML = renderPagination(pg.page, pg.total_pages, 'loadChats');
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="admin-alert error">加载失败: ' + escHtml(e.message) + '</div></td></tr>';
        }
    };

    // ── 实验详情弹窗 ──
    window.showExpDetail = async function(id) {
        try {
            var listData = await adminApi('/api/admin/experiments?page=1&page_size=500');
            var exp = (listData.experiments || []).find(function(e) { return e.id === id; });
            if (!exp) { alert('未找到'); return; }
            var el = document.getElementById('exp-detail-content');
            if (!el) return;
            el.innerHTML = '<table class="admin-table"><tr><th style="width:100px;">ID</th><td>' + exp.id + '</td></tr>' +
                '<tr><th>别名</th><td>' + escHtml(exp.alias || '—') + '</td></tr>' +
                '<tr><th>实验页面</th><td>' + escHtml(exp.source_page || '—') + '</td></tr>' +
                '<tr><th>用户</th><td>' + escHtml(exp.username) + '</td></tr>' +
                '<tr><th>创建时间</th><td>' + fmtTime(exp.created_at) + '</td></tr></table>' +
                '<h4 style="margin-top:14px;">数据</h4>' + renderJsonPreview(exp.payload || {});
            document.getElementById('exp-detail-modal').style.display = '';
        } catch(e) { alert('加载失败: ' + e.message); }
    };

    window.closeExpDetail = function() {
        var el = document.getElementById('exp-detail-modal');
        if (el) el.style.display = 'none';
    };

    // ── 实验删除 ──
    var pendingDeleteId = null;

    window.confirmDeleteExp = function(id) {
        pendingDeleteId = id;
        var el = document.getElementById('exp-delete-msg');
        if (el) el.innerHTML = '确定删除记录 <strong>#' + id + '</strong> 吗？';
        document.getElementById('exp-delete-modal').style.display = '';
        document.getElementById('exp-delete-btn').onclick = executeDeleteExp;
    };

    window.closeExpDelete = function() {
        document.getElementById('exp-delete-modal').style.display = 'none';
        pendingDeleteId = null;
    };

    async function executeDeleteExp() {
        if (!pendingDeleteId) return;
        var btn = document.getElementById('exp-delete-btn');
        btn.disabled = true; btn.textContent = '删除中...';
        try {
            await adminApi('/api/admin/experiments/' + pendingDeleteId, { method: 'DELETE' });
            closeExpDelete(); loadExperiments();
        } catch(e) { alert('删除失败: ' + e.message); }
        btn.disabled = false; btn.textContent = '确认删除';
    }
})();
