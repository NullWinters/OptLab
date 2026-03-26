(function () {
    // 高亮状态
    let highlightIds = [];
    let currentHighlightIndex = -1;

    // 会话状态
    let currentSessionId = null;
    let isLoadingHistory = false;

    // DOM 引用
    const sidebar = document.getElementById('ai-assistant-sidebar');
    const toggleBtn = document.getElementById('ai-assistant-toggle');
    const closeBtn = document.getElementById('ai-sidebar-close');
    const chatMessages = document.getElementById('ai-chat-messages');
    const inputField = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const highlightOverlay = document.getElementById('ai-highlight-overlay');
    const resetBtn = document.getElementById('ai-reset-btn');
    const resetModal = document.getElementById('ai-reset-modal');
    const resetConfirm = document.getElementById('ai-reset-confirm');
    const resetCancel = document.getElementById('ai-reset-cancel');

    if (!sidebar || !toggleBtn) return;

    // 侧边栏开关
    toggleBtn.addEventListener('click', async function () {
        const isOpen = sidebar.classList.toggle('open');
        toggleBtn.classList.toggle('active', isOpen);
        document.body.classList.toggle('ai-sidebar-open', isOpen);

        // 如果打开侧栏且未加载过历史，加载会话历史
        if (isOpen && !isLoadingHistory) {
            await loadSessionHistory();
        }
    });

    closeBtn && closeBtn.addEventListener('click', function () {
        sidebar.classList.remove('open');
        toggleBtn.classList.remove('active');
        document.body.classList.remove('ai-sidebar-open');
    });

    // 加载会话历史
    async function loadSessionHistory() {
        isLoadingHistory = true;
        const pageId = window.AI_CONFIG?.PAGE_ID || 'default';

        try {
            const response = await apiGet(`/api/assistant/session?page_id=${encodeURIComponent(pageId)}`);

            if (!response.exists) {
                currentSessionId = null;
                clearChatMessages();
            } else {
                currentSessionId = response.id;
                clearChatMessages();

                if (response.messages && response.messages.length > 0) {
                    response.messages.forEach(function (msg) {
                        addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot');
                    });
                }
            }
        } catch (err) {
            console.error('加载会话历史失败:', err);
            currentSessionId = null;
            clearChatMessages();
        } finally {
            isLoadingHistory = false;
        }
    }

    // 发送消息
    async function sendMessage() {
        const message = inputField.value.trim();
        if (!message) return;

        // 获取当前页面的配置
        const aiConfig = window.AI_CONFIG || {};
        const registry = aiConfig.BUTTON_REGISTRY || [];
        const guidebook = aiConfig.GUIDEBOOK || '';
        const pageId = aiConfig.PAGE_ID || 'default';

        // 如果没有会话，先创建
        if (!currentSessionId) {
            try {
                const session = await apiPost('/api/assistant/session', { page_id: pageId });
                currentSessionId = session.id;
            } catch (err) {
                // 检测是否为认证错误
                const isAuthError = err.status === 401 || 
                    /认证|登录|未认证|未登录|Not authenticated|Unauthorized|credentials/i.test(err.message);
                
                if (isAuthError) {
                    // 生成登录链接，包含当前页面URL作为redirect参数
                    const currentUrl = encodeURIComponent(window.location.href);
                    const loginUrl = '/auth/login?redirect=' + currentUrl;
                    
                    const errorHtml = '<div style="margin-bottom: 10px;">您的登录已过期，请重新登录后继续使用。</div>' +
                        '<a href="' + loginUrl + '" class="ai-login-btn">点击登录</a>';
                    addMessage(errorHtml, 'bot error');
                } else {
                    addMessage('抱歉，创建会话失败：' + err.message, 'bot error');
                }
                return;
            }
        }

        addMessage(message, 'user');
        inputField.value = '';
        clearHighlights();

        const loadingEl = addMessage('思考中...', 'bot loading');

        try {
            const data = await apiPost('/api/assistant/chat', {
                session_id: currentSessionId,
                message: message,
                page_id: pageId,
                guidebook: guidebook,
                buttons: registry
            });

            loadingEl.remove();
            addMessage(data.text, 'bot');

            if (data.highlight_ids && data.highlight_ids.length > 0) {
                highlightIds = data.highlight_ids;
                currentHighlightIndex = 0;
                highlightCurrentButton();
            }
        } catch (err) {
            loadingEl && loadingEl.remove();
            addMessage('抱歉，请求出错：' + err.message, 'bot error');
        }
    }

    // 重置会话
    function showResetModal() {
        if (resetModal) {
            resetModal.style.display = 'flex';
        }
    }

    function hideResetModal() {
        if (resetModal) {
            resetModal.style.display = 'none';
        }
    }

    async function resetSession() {
        const pageId = window.AI_CONFIG?.PAGE_ID || 'default';

        try {
            await apiPost('/api/assistant/session/reset', { page_id: pageId });
            currentSessionId = null;
            clearChatMessages();
            hideResetModal();
        } catch (err) {
            alert('重置失败：' + err.message);
        }
    }

    // 清空聊天消息区域
    function clearChatMessages() {
        // 保留欢迎语
        chatMessages.innerHTML = '';
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'ai-message ai-bot';
        welcomeDiv.innerHTML = '<p>你好！我是页面操作助手，可以帮助你了解如何使用这个页面的各项功能。请问有什么需要帮助的？</p>';
        chatMessages.appendChild(welcomeDiv);
    }

    // 绑定事件
    sendBtn.addEventListener('click', sendMessage);
    inputField.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') sendMessage();
    });

    resetBtn && resetBtn.addEventListener('click', showResetModal);
    resetConfirm && resetConfirm.addEventListener('click', resetSession);
    resetCancel && resetCancel.addEventListener('click', hideResetModal);

    // 点击弹窗外部关闭
    resetModal && resetModal.addEventListener('click', function (e) {
        if (e.target === resetModal) {
            hideResetModal();
        }
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
