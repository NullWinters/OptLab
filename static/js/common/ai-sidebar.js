(function () {
    // 高亮状态
    let highlightIds = [];
    let currentHighlightIndex = -1;
    let uiRegistryMap = new Map();
    let optionalAdvanceTimer = null;
    const OPTIONAL_ADVANCE_MS = 2600;
    const TYPEWRITER_SPEED_MS = 18;

    // 会话状态
    let currentSessionId = null;
    let isLoadingHistory = false;
    let pendingAuthRetry = null;

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
    const nextStepBtn = document.getElementById('ai-next-step-btn');

    if (!sidebar || !toggleBtn) return;

    function isLoggedIn() {
        return (typeof getStoredToken === 'function') && !!getStoredToken();
    }

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
        if (text) {
            // 质量校验：如果文本主要由数字、坐标轴符号（如减号、点、逗号）、下标和变量x组成，且较长，则视为低质量描述（坐标轴特征）
            if (text.length > 10 && /^[0-9.,\-\s\u2080-\u2089\u2212x]+$/.test(text)) {
                return '';
            }
            return text.length > 40 ? text.slice(0, 40) + '...' : text;
        }
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
                type: "normal"
            });
        });

        const graphicSelector = 'canvas[id], #scene, div[id*="canvas"], div[id*="plot"], div[id*="chart"]';
        document.querySelectorAll(graphicSelector).forEach(function (el) {
            const id = el.id;
            if (!id || map.has(id)) return;
            map.set(id, {
                id: id,
                description: inferDescription(el),
                type: "svg"
            });
        });

        const svgSelector = 'svg circle, svg rect, svg path, svg line, svg polyline, svg polygon, svg ellipse, svg text, svg g';
        const svgElements = Array.prototype.slice.call(document.querySelectorAll(svgSelector), 0, 150);
        svgElements.forEach(function (el, idx) {
            const id = ensureElementId(el, 'svg-node');
            if (!id || map.has(id)) return;
            const desc = inferDescription(el);
            if (!desc) return; // 跳过描述为空（如坐标轴数值）的图元

            const isFallback = desc === (el.tagName.toLowerCase() + ' 元素');
            // 过滤无意义的图元：fallback描述且没有原始ID，或者是坐标轴组件
            if (isFallback && !el.getAttribute('id')) return;
            if (el.closest && (el.closest('.axis') || el.closest('.tick') || el.closest('.grid-layer') || el.closest('.axis-layer'))) return;

            map.set(id, {
                id: id,
                description: desc + ' (SVG图元 ' + el.tagName.toLowerCase() + ' #' + (idx + 1) + ')',
                type: 'svg'
            });
        });

        uiRegistryMap = map;
        // 过滤掉类型为 svg 的按钮，不作为交互引导项发送给 AI，避免生成无效的高亮引导消息
        return Array.from(map.values()).filter(item => item.type !== 'svg');
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function createMessageShell(type) {
        const div = document.createElement('div');
        const baseClass = type.split(' ')[0];
        div.className = 'ai-message ai-' + baseClass;
        if (type.indexOf('loading') !== -1) div.classList.add('ai-loading');
        if (type.indexOf('error') !== -1) div.classList.add('ai-error');
        const content = document.createElement('div');
        content.className = 'ai-message-content';
        div.appendChild(content);
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return {div: div, content: content};
    }

    function renderMathAndMarkdown(container) {
        if (!container) return;
        if (window.marked && typeof window.marked.parse === 'function') {
            const raw = container.textContent || '';
            container.innerHTML = window.marked.parse(raw);
        }
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            window.MathJax.typesetPromise([container]).catch(function () {
            });
        }
    }

    async function typewriterToElement(contentEl, text, speedMs) {
        const source = String(text || '');
        contentEl.textContent = '';
        for (let i = 0; i < source.length; i++) {
            contentEl.textContent += source[i];
            if (i % 2 === 0) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            await new Promise(function (resolve) {
                setTimeout(resolve, speedMs);
            });
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function splitReplyText(text) {
        return String(text || '')
            .split(/\n\s*\n/g)
            .map(function (item) {
                return item.trim();
            })
            .filter(Boolean);
    }

    function appendAssistantHistoryMessages(msg) {
        const customBlocks = Array.isArray(msg.text_blocks) ? msg.text_blocks : [];
        const blocks = customBlocks.length ? customBlocks : splitReplyText(msg.content);
        if (!blocks.length) {
            addMessage(String(msg.content || ''), 'bot');
            return;
        }
        blocks.forEach(function (block) {
            const shell = createMessageShell('bot');
            shell.content.textContent = String(block || '');
            renderMathAndMarkdown(shell.content);
        });
    }

    function collectGraphContext() {
        const context = {
            hasCanvas: !!document.querySelector('canvas'),
            canvasCount: document.querySelectorAll('canvas').length,
            svgCount: document.querySelectorAll('svg').length,
            hasThreeScene: !!document.getElementById('scene') || !!window.THREE,
            chartLikeNodes: document.querySelectorAll('[id*="chart"], [class*="chart"], [id*="plot"], [class*="plot"]').length,
            axisLabelCount: document.querySelectorAll('.axis, [class*="axis"], [id*="axis"]').length
        };

        // 增强感知能力：提取 SVG 内部图元的简要信息（ID 和 inferDescription）
        const svgElementsSummary = [];
        const svgSelector = 'svg circle, svg rect, svg path, svg line, svg polyline, svg polygon, svg ellipse, svg text, svg g';
        const svgNodes = Array.prototype.slice.call(document.querySelectorAll(svgSelector), 0, 150);
        svgNodes.forEach(function (el) {
            const id = el.id;
            const desc = inferDescription(el);

            if (desc && desc.length > 2) {
                const isFallback = desc === (el.tagName.toLowerCase() + ' 元素');
                // 优先收集有意义的图元，跳过无ID的坐标轴/网格等背景图元
                if (isFallback && !id) return;
                if (el.closest && (el.closest('.axis') || el.closest('.tick') || el.closest('.grid-layer') || el.closest('.axis-layer'))) return;

                svgElementsSummary.push({
                    id: id || el.tagName.toLowerCase(),
                    desc: desc
                });
            }
        });
        context.svgElementsSummary = svgElementsSummary.slice(0, 50);

        // 增强感知能力：如果页面定义了特定数据提取函数，优先调用 AI 专用钩子
        const getPageData = window.AI_GET_PAGE_DATA || (window.EXPERIMENT_NOTES_CONFIG && window.EXPERIMENT_NOTES_CONFIG.getPageData);
        if (typeof getPageData === 'function') {
            try {
                context.customPageData = getPageData();
            } catch (err) {
                console.error('AI_GET_PAGE_DATA failed:', err);
            }
        }

        // 增强 Three.js 的感知能力：尝试从全局变量提取场景摘要
        const scene = window.scene || (window.THREE_STATE && window.THREE_STATE.scene);
        if (scene && scene.children) {
            const threeNodes = [];
            scene.children.forEach(function (obj) {
                if (obj.visible && (obj.name || (obj.type && obj.type !== 'Group'))) {
                    threeNodes.push({
                        name: obj.name || 'unnamed',
                        type: obj.type
                    });
                }
            });
            context.threeElementsSummary = threeNodes.slice(0, 20);
        }

        const numericSnapshot = [];
        document.querySelectorAll('input[type="range"], input[type="number"], select').forEach(function (el) {
            if (!el.id) return;
            numericSnapshot.push({
                id: el.id,
                value: el.value
            });
        });
        context.controlSnapshot = numericSnapshot.slice(0, 40);
        return context;
    }

    function stepMessageById(id, stepNo) {
        const meta = uiRegistryMap.get(id);
        const desc = meta ? meta.description : id;
        return '步骤' + stepNo + '：操作「' + desc + '」。';
    }

    function setPendingAuthRetry(payload) {
        if (!payload) {
            pendingAuthRetry = null;
            return;
        }
        pendingAuthRetry = {
            message: payload.message || '',
            pageId: payload.pageId || (window.AI_CONFIG?.PAGE_ID || 'default'),
            guidebook: payload.guidebook || '',
            buttons: Array.isArray(payload.buttons) ? payload.buttons : []
        };
    }

    async function retryPendingAuthRequest() {
        if (!pendingAuthRetry || !isLoggedIn()) return;
        const retryPayload = pendingAuthRetry;
        pendingAuthRetry = null;

        inputField.value = retryPayload.message || '';
        addMessage('已恢复登录，正在自动重试刚才的问题...', 'system');
        await sendMessage();
    }

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
                        if (msg.role === 'user') {
                            addMessage(msg.content, 'user');
                        } else {
                            appendAssistantHistoryMessages(msg);
                        }
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

    function setSendBusy(isBusy) {
        if (!sendBtn || !inputField) return;
        sendBtn.disabled = !!isBusy;
        inputField.disabled = !!isBusy;
        sendBtn.textContent = isBusy ? '发送中...' : '发送';
    }

    // 发送消息
    async function sendMessage() {
        if (!inputField || !sendBtn || sendBtn.disabled) return;
        const message = inputField.value.trim();
        if (!message) return;
        setSendBusy(true);

        // 获取当前页面的配置
        const aiConfig = window.AI_CONFIG || {};
        const registry = buildRuntimeRegistry();
        const guidebook = aiConfig.GUIDEBOOK || '';
        const pageId = aiConfig.PAGE_ID || 'default';
        const graphContext = collectGraphContext();
        const retrySnapshot = {message: message, pageId: pageId, guidebook: guidebook, buttons: registry};

        // 如果没有会话，先创建
        if (!currentSessionId) {
            try {
                const session = await apiPost('/api/assistant/session', {page_id: pageId});
                currentSessionId = session.id;
            } catch (err) {
                // 检测是否为认证错误
                const isAuthError = err.status === 401 ||
                    /认证|登录|未认证|未登录|Not authenticated|Unauthorized|credentials/i.test(err.message);

                if (isAuthError) {
                    setPendingAuthRetry(retrySnapshot);
                    var errorHtml = '<div style="margin-bottom: 10px;">您的登录已过期，请重新登录后继续使用。</div>' +
                        '<button type="button" class="ai-login-btn js-open-login-modal">点击登录</button>';
                    addMessage(errorHtml, 'bot error');
                } else {
                    addMessage('抱歉，创建会话失败：' + err.message, 'bot error');
                }
                setSendBusy(false);
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
                buttons: registry,
                graph_context: graphContext
            });

            loadingEl.remove();

            if (data.highlight_ids && data.highlight_ids.length > 0) {
                highlightIds = data.highlight_ids.filter(function (id) {
                    const el = document.getElementById(id);
                    if (!el) return false;
                    const meta = uiRegistryMap.get(id);
                    // 过滤掉类型为 svg 的按钮，不进行交互引导
                    if (meta && meta.type === 'svg') return false;

                    // 兜底检查：如果描述是乱码数字（坐标轴特征），剔除。即使 meta 不存在也通过 inferDescription 检查
                    const desc = meta ? meta.description : inferDescription(el);
                    if (desc && desc.length > 15 && /^[0-9.,\-\s\u2080-\u2089\u2212x]+$/.test(desc)) {
                        return false;
                    }

                    // 额外检查是否为 SVG/Canvas 元素或其容器，防止漏网之鱼
                    const isSvg = (typeof SVGElement !== "undefined" && el instanceof SVGElement) ||
                        el.ownerSVGElement ||
                        el.tagName.toLowerCase() === "svg" ||
                        el.querySelector("svg") ||
                        el.tagName.toLowerCase() === "canvas";
                    return !isSvg;

                });
                currentHighlightIndex = 0;
                if (highlightIds.length > 0) {
                    await renderReplyBlocks(data);
                    addMessage(stepMessageById(highlightIds[0], 1), 'bot');
                    highlightCurrentButton();
                    return;
                }
            }

            await renderReplyBlocks(data);
        } catch (err) {
            loadingEl && loadingEl.remove();
            const isAuthError = err && (err.status === 401 || /认证|登录|未认证|未登录|Not authenticated|Unauthorized|credentials/i.test(err.message || ''));
            if (isAuthError) {
                setPendingAuthRetry(retrySnapshot);
                const errorHtml = '<div style="margin-bottom: 10px;">当前未登录，登录后可继续向 AI 助手提问。</div>' +
                    '<button type="button" class="ai-login-btn js-open-login-modal">点击登录</button>';
                addMessage(errorHtml, 'bot error');
            } else {
                addMessage('抱歉，请求出错：' + err.message, 'bot error');
            }
        } finally {
            setSendBusy(false);
        }
    }

    async function renderReplyBlocks(data) {
        const customBlocks = Array.isArray(data.text_blocks) ? data.text_blocks : [];
        const blocks = customBlocks.length ? customBlocks : splitReplyText(data.text);
        if (!blocks.length) {
            await addMessageWithTypewriter(String(data.text || ''), 'bot', true);
            return;
        }
        for (let i = 0; i < blocks.length; i++) {
            await addMessageWithTypewriter(blocks[i], 'bot', true);
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
            await apiPost('/api/assistant/session/reset', {page_id: pageId});
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
        welcomeDiv.innerHTML = '<p>你好！我是AI助手，可以帮助你了解这个实验，指导你完成实验操作，分析实验结果，解释实验图像。请问有什么需要帮助的？</p>';
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
        const shell = createMessageShell(type);
        if (type.indexOf('bot') !== -1 && type.indexOf('loading') === -1 && type.indexOf('error') === -1) {
            shell.content.textContent = String(text || '');
            renderMathAndMarkdown(shell.content);
        } else if (type.indexOf('error') !== -1 && String(text || '').indexOf('js-open-login-modal') !== -1) {
            shell.content.innerHTML = String(text || '');
        } else {
            shell.content.innerHTML = '<p>' + escapeHtml(text) + '</p>';
        }
        return shell.div;
    }

    async function addMessageWithTypewriter(text, type, enableMath) {
        const shell = createMessageShell(type);
        const paragraph = document.createElement('p');
        shell.content.appendChild(paragraph);
        await typewriterToElement(paragraph, String(text || ''), TYPEWRITER_SPEED_MS);
        if (enableMath) {
            renderMathAndMarkdown(shell.content);
        }
        return shell.div;
    }

    // 绑定聊天区内“点击登录”按钮，弹窗登录不跳页
    chatMessages.addEventListener('click', function (e) {
        var trigger = e.target.closest('.js-open-login-modal');
        if (!trigger) return;
        e.preventDefault();
        if (window.LoginModal && typeof window.LoginModal.open === 'function') {
            window.LoginModal.open();
        } else {
            window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.href);
        }
    });

    // 登录成功后自动重试刚才失败的问题
    document.addEventListener('optlab:auth-success', function () {
        retryPendingAuthRequest();
    });

    // ========== 高亮系统 ==========
    function advanceGuideStep() {
        if (optionalAdvanceTimer) {
            clearTimeout(optionalAdvanceTimer);
            optionalAdvanceTimer = null;
        }
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
        const targetMeta = uiRegistryMap.get(targetId) || {type: 'normal'};

        // 清理旧定时器，防止重叠
        if (optionalAdvanceTimer) {
            clearTimeout(optionalAdvanceTimer);
            optionalAdvanceTimer = null;
        }

        if (!targetEl) {
            currentHighlightIndex++;
            highlightCurrentButton();
            return;
        }

        // 清理旧点击事件
        if (targetEl._aiClickHandler) {
            targetEl.removeEventListener('click', targetEl._aiClickHandler);
            delete targetEl._aiClickHandler;
        }

        targetEl.scrollIntoView({behavior: 'smooth', block: 'center'});

        setTimeout(function () {
            positionOverlay(targetEl);
            highlightOverlay.style.display = 'block';
        }, 350);

        if (nextStepBtn) nextStepBtn.style.display = 'inline-flex';

        // 识别是否为 SVG 元素（针对自动生成的 ID 或 动态 Registry 未命中）
        const isSvgElement = (typeof SVGElement !== 'undefined' && targetEl instanceof SVGElement) ||
            (targetEl.ownerSVGElement) ||
            (targetEl.tagName.toLowerCase() === 'svg');

        // 为当前目标绑定点击事件，点击后跳转到下一个
        const metaType = targetMeta.type;
        if (metaType === 'optional' || metaType === 'svg' || isSvgElement) {
            optionalAdvanceTimer = setTimeout(function () {
                advanceGuideStep();
            }, OPTIONAL_ADVANCE_MS);
        } else {
            targetEl._aiClickHandler = function () {
                advanceGuideStep();
            };
            targetEl.addEventListener('click', targetEl._aiClickHandler, {once: true});
        }
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
        if (optionalAdvanceTimer) {
            clearTimeout(optionalAdvanceTimer);
            optionalAdvanceTimer = null;
        }
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
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0) {
                    positionOverlay(el);
                } else {
                    setTimeout(function () {
                        const nextRect = el.getBoundingClientRect();
                        if (nextRect.width > 0 && nextRect.height > 0) {
                            positionOverlay(el);
                        }
                    }, 120);
                }
            }
        }
    }

    window.addEventListener('scroll', repositionOverlay, true);
    window.addEventListener('resize', repositionOverlay);
    window.addEventListener('focus', function () {
        setTimeout(repositionOverlay, 80);
        setTimeout(repositionOverlay, 280);
    });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            setTimeout(repositionOverlay, 80);
            setTimeout(repositionOverlay, 280);
        }
    });
    document.addEventListener('change', function (e) {
        const t = e.target;
        if (t && t.matches && t.matches('input[type="file"]')) {
            setTimeout(repositionOverlay, 80);
            setTimeout(repositionOverlay, 260);
        }
    }, true);
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', function () {
            if (currentHighlightIndex >= 0 && currentHighlightIndex < highlightIds.length) {
                advanceGuideStep();
            }
        });
    }
})();
