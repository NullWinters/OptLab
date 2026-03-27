(function () {
    // 高亮状态
    let highlightIds = [];
    let currentHighlightIndex = -1;
    let uiRegistryMap = new Map();

    // DOM 引用
    const sidebar = document.getElementById('ai-assistant-sidebar');
    const toggleBtn = document.getElementById('ai-assistant-toggle');
    const closeBtn = document.getElementById('ai-sidebar-close');
    const chatMessages = document.getElementById('ai-chat-messages');
    const inputField = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const highlightOverlay = document.getElementById('ai-highlight-overlay');
    const nextStepBtn = document.getElementById('ai-next-step-btn');

    if (!sidebar || !toggleBtn) return;

    function ensureElementId(el, prefix) {
        if (!el) return null;
        if (el.id) return el.id;
        if (el.dataset && el.dataset.aiAutoId) return el.dataset.aiAutoId;

        const base = (prefix || 'ai-auto') + '-';
        let idx = 1;
        let candidate = base + idx;
        while (document.getElementById(candidate)) {
            idx++;
            candidate = base + idx;
        }
        el.id = candidate;
        if (el.dataset) el.dataset.aiAutoId = candidate;
        return candidate;
    }

    function inferDescription(el) {
        if (!el) return '页面控件';
        const aria = el.getAttribute('aria-label');
        if (aria) return aria;
        const title = el.getAttribute('title');
        if (title) return title;
        const dataLabel = el.getAttribute('data-ai-label');
        if (dataLabel) return dataLabel;
        const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
        if (text) return text.length > 40 ? text.slice(0, 40) + '...' : text;
        return el.tagName.toLowerCase() + ' 元素';
    }

    function buildRuntimeRegistry() {
        const aiConfig = window.AI_CONFIG || {};
        const baseRegistry = Array.isArray(aiConfig.BUTTON_REGISTRY) ? aiConfig.BUTTON_REGISTRY : [];
        const map = new Map();

        baseRegistry.forEach(function (item) {
            if (item && item.id) {
                map.set(item.id, {
                    id: item.id,
                    description: item.description || item.id,
                    type: item.type || 'normal'
                });
            }
        });

        const interactiveSelector = 'button[id], input[id], select[id], textarea[id], [role="button"][id], [id].modal';
        document.querySelectorAll(interactiveSelector).forEach(function (el) {
            const id = el.id;
            if (!id || map.has(id)) return;
            map.set(id, {
                id: id,
                description: inferDescription(el),
                type: 'normal'
            });
        });

        const svgSelector = 'svg circle, svg rect, svg path, svg line, svg polyline, svg polygon, svg ellipse, svg text, svg g';
        const svgElements = Array.prototype.slice.call(document.querySelectorAll(svgSelector), 0, 60);
        svgElements.forEach(function (el, idx) {
            const id = ensureElementId(el, 'svg-node');
            if (!id || map.has(id)) return;
            map.set(id, {
                id: id,
                description: inferDescription(el) + ' (SVG图元 ' + el.tagName.toLowerCase() + ' #' + (idx + 1) + ')',
                type: 'svg'
            });
        });

        uiRegistryMap = map;
        return Array.from(map.values());
    }

    function stepMessageById(id, stepNo) {
        const meta = uiRegistryMap.get(id);
        const desc = meta ? meta.description : id;
        return '步骤' + stepNo + '：请先操作「' + desc + '」。';
    }

    // 侧边栏开关
    toggleBtn.addEventListener('click', function () {
        const isOpen = sidebar.classList.toggle('open');
        toggleBtn.classList.toggle('active', isOpen);
        document.body.classList.toggle('ai-sidebar-open', isOpen);
    });

    closeBtn && closeBtn.addEventListener('click', function () {
        sidebar.classList.remove('open');
        toggleBtn.classList.remove('active');
        document.body.classList.remove('ai-sidebar-open');
    });

        // 发送消息
    function sendMessage() {
        const message = inputField.value.trim();
        if (!message) return;

        // 获取当前页面的配置
        const aiConfig = window.AI_CONFIG || {};
        const registry = buildRuntimeRegistry();
        const guidebook = aiConfig.GUIDEBOOK || '';
        const pageId = aiConfig.PAGE_ID || 'default';

        addMessage(message, 'user');
        inputField.value = '';
        clearHighlights();

        const loadingEl = addMessage('思考中...', 'bot loading');

        fetch('/api/assistant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                page_id: pageId,
                guidebook: guidebook,
                buttons: registry
            })
        })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (body) {
                    throw new Error(body.detail || '请求失败 (' + res.status + ')');
                });
            }
            return res.json();
        })
        .then(function (data) {
            loadingEl.remove();

            if (data.highlight_ids && data.highlight_ids.length > 0) {
                highlightIds = data.highlight_ids.filter(function (id) {
                    return !!document.getElementById(id);
                });
                currentHighlightIndex = 0;
                if (highlightIds.length > 0) {
                    addMessage(stepMessageById(highlightIds[0], 1), 'bot');
                    highlightCurrentButton();
                    return;
                }
            }

            addMessage(data.text, 'bot');
        })
        .catch(function (err) {
            loadingEl && loadingEl.remove();
            addMessage('抱歉，请求出错：' + err.message, 'bot error');
        });
    }

    sendBtn.addEventListener('click', sendMessage);
    inputField.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') sendMessage();
    });

    // 添加聊天消息
    function addMessage(text, type) {
        const div = document.createElement('div');
        const baseClass = type.split(' ')[0];
        div.className = 'ai-message ai-' + baseClass;
        if (type.indexOf('loading') !== -1) div.classList.add('ai-loading');
        if (type.indexOf('error') !== -1) div.classList.add('ai-error');
        div.innerHTML = '<p>' + text + '</p>';
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    // ========== 高亮系统 ==========
    function advanceGuideStep() {
        const currentId = highlightIds[currentHighlightIndex];
        const currentEl = currentId ? document.getElementById(currentId) : null;
        if (currentEl && currentEl._aiClickHandler) {
            currentEl.removeEventListener('click', currentEl._aiClickHandler);
            delete currentEl._aiClickHandler;
        }

        currentHighlightIndex++;
        if (currentHighlightIndex < highlightIds.length) {
            addMessage(stepMessageById(highlightIds[currentHighlightIndex], currentHighlightIndex + 1), 'bot');
            highlightCurrentButton();
        } else {
            clearHighlights();
            addMessage('演示结束', 'system');
        }
    }

    function highlightCurrentButton() {
        if (currentHighlightIndex < 0 || currentHighlightIndex >= highlightIds.length) {
            clearHighlights();
            return;
        }

        const targetId = highlightIds[currentHighlightIndex];
        const targetEl = document.getElementById(targetId);
        if (!targetEl) {
            currentHighlightIndex++;
            highlightCurrentButton();
            return;
        }

        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(function () {
            positionOverlay(targetEl);
            highlightOverlay.style.display = 'block';
        }, 350);

        if (nextStepBtn) nextStepBtn.style.display = 'inline-flex';

        // 为当前目标绑定点击事件，点击后跳转到下一个
        targetEl._aiClickHandler = function () {
            advanceGuideStep();
        };
        targetEl.addEventListener('click', targetEl._aiClickHandler);
    }

    function positionOverlay(el) {
        const rect = el.getBoundingClientRect();
        const pad = 4;
        highlightOverlay.style.left = (rect.left - pad) + 'px';
        highlightOverlay.style.top = (rect.top - pad) + 'px';
        highlightOverlay.style.width = (rect.width + pad * 2) + 'px';
        highlightOverlay.style.height = (rect.height + pad * 2) + 'px';
    }

    function clearHighlights() {
        if (highlightOverlay) highlightOverlay.style.display = 'none';
        if (nextStepBtn) nextStepBtn.style.display = 'none';
        highlightIds.forEach(function (id) {
            const btn = document.getElementById(id);
            if (btn && btn._aiClickHandler) {
                btn.removeEventListener('click', btn._aiClickHandler);
                delete btn._aiClickHandler;
            }
        });
        highlightIds = [];
        currentHighlightIndex = -1;
    }

    // 滚动和窗口变化时重新定位高亮遮罩
    function repositionOverlay() {
        if (currentHighlightIndex >= 0 && currentHighlightIndex < highlightIds.length) {
            const el = document.getElementById(highlightIds[currentHighlightIndex]);
            if (el && highlightOverlay && highlightOverlay.style.display !== 'none') {
                positionOverlay(el);
            }
        }
    }

    window.addEventListener('scroll', repositionOverlay, true);
    window.addEventListener('resize', repositionOverlay);
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', function () {
            if (currentHighlightIndex >= 0 && currentHighlightIndex < highlightIds.length) {
                advanceGuideStep();
            }
        });
    }
})();
