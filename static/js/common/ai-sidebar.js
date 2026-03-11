(function () {
    // 高亮状态
    let highlightIds = [];
    let currentHighlightIndex = -1;

    // DOM 引用
    const sidebar = document.getElementById('ai-assistant-sidebar');
    const toggleBtn = document.getElementById('ai-assistant-toggle');
    const closeBtn = document.getElementById('ai-sidebar-close');
    const chatMessages = document.getElementById('ai-chat-messages');
    const inputField = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const highlightOverlay = document.getElementById('ai-highlight-overlay');

    if (!sidebar || !toggleBtn) return;

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
        const registry = aiConfig.BUTTON_REGISTRY || [];
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
            addMessage(data.text, 'bot');

            if (data.highlight_ids && data.highlight_ids.length > 0) {
                highlightIds = data.highlight_ids;
                currentHighlightIndex = 0;
                highlightCurrentButton();
            }
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
    function highlightCurrentButton() {
        if (currentHighlightIndex < 0 || currentHighlightIndex >= highlightIds.length) {
            clearHighlights();
            return;
        }

        const btnId = highlightIds[currentHighlightIndex];
        const btn = document.getElementById(btnId);
        if (!btn) {
            currentHighlightIndex++;
            highlightCurrentButton();
            return;
        }

        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(function () {
            positionOverlay(btn);
            highlightOverlay.style.display = 'block';
        }, 350);

        // 为当前按钮绑定点击事件，点击后跳转到下一个
        btn._aiClickHandler = function () {
            btn.removeEventListener('click', btn._aiClickHandler);
            delete btn._aiClickHandler;
            currentHighlightIndex++;
            if (currentHighlightIndex < highlightIds.length) {
                highlightCurrentButton();
            } else {
                clearHighlights();
                addMessage('演示结束', 'system');
            }
        };
        btn.addEventListener('click', btn._aiClickHandler);
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
            const btn = document.getElementById(highlightIds[currentHighlightIndex]);
            if (btn && highlightOverlay && highlightOverlay.style.display !== 'none') {
                positionOverlay(btn);
            }
        }
    }

    window.addEventListener('scroll', repositionOverlay, true);
    window.addEventListener('resize', repositionOverlay);
})();
