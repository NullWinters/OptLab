(function (global) {
    'use strict';

    var overlay = null;
    var opened = false;
    var activeMode = 'login';
    var lastTrigger = null;
    var scrollY = 0;

    var loginForm = null;
    var registerForm = null;
    var loginAlert = null;
    var registerAlert = null;
    var loginPanel = null;
    var registerPanel = null;
    var isLoginSubmitting = false;
    var isRegisterSubmitting = false;
    var lastLoginSubmitAt = 0;
    var lastRegisterSubmitAt = 0;
    var ENTER_SUBMIT_THROTTLE_MS = 700;

    function setAlert(el, msg, ok) {
        if (!el) return;
        el.classList.remove('is-visible', 'is-error', 'is-success');
        if (!msg) {
            el.innerHTML = '';
            return;
        }
        el.innerHTML = String(msg).replace(/\n/g, '<br>');
        el.classList.add('is-visible');
        el.classList.add(ok ? 'is-success' : 'is-error');
    }

    function normalizeError(err, fallback) {
        if (!err) return fallback;
        if (typeof err.message === 'string' && err.message.trim()) return err.message;
        return fallback;
    }

    function switchMode(mode) {
        activeMode = mode === 'register' ? 'register' : 'login';
        if (!loginPanel || !registerPanel) return;

        var isLogin = activeMode === 'login';
        loginPanel.classList.toggle('is-active', isLogin);
        registerPanel.classList.toggle('is-active', !isLogin);

        setAlert(loginAlert, '', false);
        setAlert(registerAlert, '', false);

        setTimeout(function () {
            var targetInput = isLogin
                ? (loginForm && loginForm.querySelector('input[name="identifier"]'))
                : (registerForm && registerForm.querySelector('input[name="email"]'));
            if (targetInput) targetInput.focus();
        }, 10);
    }

    function lockBodyScroll() {
        scrollY = window.scrollY || window.pageYOffset || 0;
        document.body.classList.add('modal-open');
        document.body.style.position = 'fixed';
        document.body.style.top = '-' + scrollY + 'px';
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
    }

    function unlockBodyScroll() {
        document.body.classList.remove('modal-open');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY || 0);
    }

    function notifyAuthSuccess(user) {
        document.dispatchEvent(new CustomEvent('optlab:auth-success', {detail: {user: user || null}}));
        if (typeof global.refreshNavbarAuthState === 'function') {
            try {
                global.refreshNavbarAuthState();
            } catch (_) {
            }
        }
    }

    function isSubmitThrottled(mode) {
        var now = Date.now();
        if (mode === 'register') {
            if (now - lastRegisterSubmitAt < ENTER_SUBMIT_THROTTLE_MS) return true;
            lastRegisterSubmitAt = now;
            return false;
        }
        if (now - lastLoginSubmitAt < ENTER_SUBMIT_THROTTLE_MS) return true;
        lastLoginSubmitAt = now;
        return false;
    }

    async function handleLoginSubmit(e) {
        e.preventDefault();
        if (!loginForm || isLoginSubmitting) return;
        if (isSubmitThrottled('login')) return;

        var identifier = (loginForm.querySelector('input[name="identifier"]') || {}).value || '';
        var password = (loginForm.querySelector('input[name="password"]') || {}).value || '';
        var submitBtn = loginForm.querySelector('.login-modal-submit');

        if (!identifier || !password) {
            setAlert(loginAlert, '请输入账号和密码', false);
            return;
        }

        setAlert(loginAlert, '', false);
        isLoginSubmitting = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '登录中...';
        }

        try {
            var data = await apiPost('/auth/login', {identifier: identifier, password: password});
            if (data && data.token && data.user) {
                setStoredAuth(data.token, data.user);
                setAlert(loginAlert, '登录成功，正在返回当前页面...', true);
                notifyAuthSuccess(data.user);
                setTimeout(close, 240);
            } else {
                setAlert(loginAlert, '登录失败，请稍后重试。', false);
            }
        } catch (err) {
            setAlert(loginAlert, normalizeError(err, '登录失败，请检查账号和密码。'), false);
        } finally {
            isLoginSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '登录';
            }
        }
    }

    async function handleRegisterSubmit(e) {
        e.preventDefault();
        if (!registerForm || isRegisterSubmitting) return;
        if (isSubmitThrottled('register')) return;

        var email = (registerForm.querySelector('input[name="email"]') || {}).value || '';
        var username = (registerForm.querySelector('input[name="username"]') || {}).value || '';
        var password = (registerForm.querySelector('input[name="password"]') || {}).value || '';
        var confirmPassword = (registerForm.querySelector('input[name="confirm_password"]') || {}).value || '';
        var submitBtn = registerForm.querySelector('.login-modal-submit');

        if (!email || !username || !password || !confirmPassword) {
            setAlert(registerAlert, '请完整填写所有字段', false);
            return;
        }

        setAlert(registerAlert, '', false);
        isRegisterSubmitting = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '注册中...';
        }

        try {
            await apiPost('/auth/register', {
                email: email,
                username: username,
                password: password,
                confirm_password: confirmPassword,
            });
            setAlert(registerAlert, '注册成功，请登录。', true);
            if (loginForm) {
                var identifierInput = loginForm.querySelector('input[name="identifier"]');
                if (identifierInput) identifierInput.value = username || email;
            }
            setTimeout(function () {
                switchMode('login');
            }, 380);
        } catch (err) {
            setAlert(registerAlert, normalizeError(err, '注册失败，请稍后重试。'), false);
        } finally {
            isRegisterSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '注册';
            }
        }
    }

    function ensureModal() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.className = 'login-modal-overlay';
        overlay.id = 'login-modal-overlay';
        overlay.innerHTML =
            '<div class="login-modal-card" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">' +
            '  <button class="login-modal-close" type="button" aria-label="关闭">×</button>' +
            '  <div class="login-modal-head">' +
            '    <h2 class="login-modal-title" id="login-modal-title">欢迎使用 OptLab</h2>' +
            '    <p class="login-modal-subtitle">保持在当前页面完成登录或注册</p>' +
            '  </div>' +
            '  <section class="login-modal-panel is-active" data-auth-panel="login">' +
            '    <div id="login-modal-alert" class="login-modal-alert"></div>' +
            '    <form id="login-modal-form" class="login-modal-form">' +
            '      <div class="login-modal-field">' +
            '        <label for="login-modal-identifier">邮箱或用户名</label>' +
            '        <input id="login-modal-identifier" name="identifier" type="text" required>' +
            '      </div>' +
            '      <div class="login-modal-field">' +
            '        <label for="login-modal-password">密码</label>' +
            '        <input id="login-modal-password" name="password" type="password" required>' +
            '      </div>' +
            '      <button class="login-modal-submit" type="submit">登录</button>' +
            '    </form>' +
            '    <p class="login-modal-footer-tip">还没有账号？ <a href="/auth/register" class="js-open-register-modal">立即注册</a></p>' +
            '  </section>' +
            '  <section class="login-modal-panel" data-auth-panel="register">' +
            '    <div id="register-modal-alert" class="login-modal-alert"></div>' +
            '    <form id="register-modal-form" class="login-modal-form">' +
            '      <div class="login-modal-field">' +
            '        <label for="register-modal-email">邮箱</label>' +
            '        <input id="register-modal-email" name="email" type="email" required>' +
            '      </div>' +
            '      <div class="login-modal-field">' +
            '        <label for="register-modal-username">用户名</label>' +
            '        <input id="register-modal-username" name="username" type="text" required>' +
            '      </div>' +
            '      <div class="login-modal-field">' +
            '        <label for="register-modal-password">密码</label>' +
            '        <input id="register-modal-password" name="password" type="password" required>' +
            '        <p class="login-modal-field-hint">密码长度需在 8-50 个字符之间。</p>' +
            '      </div>' +
            '      <div class="login-modal-field">' +
            '        <label for="register-modal-confirm-password">确认密码</label>' +
            '        <input id="register-modal-confirm-password" name="confirm_password" type="password" required>' +
            '      </div>' +
            '      <button class="login-modal-submit" type="submit">注册</button>' +
            '    </form>' +
            '    <p class="login-modal-footer-tip">已有账号？ <a href="/auth/login" class="js-open-login-modal">返回登录</a></p>' +
            '  </section>' +
            '</div>';

        document.body.appendChild(overlay);

        loginAlert = overlay.querySelector('#login-modal-alert');
        registerAlert = overlay.querySelector('#register-modal-alert');
        loginForm = overlay.querySelector('#login-modal-form');
        registerForm = overlay.querySelector('#register-modal-form');
        loginPanel = overlay.querySelector('[data-auth-panel="login"]');
        registerPanel = overlay.querySelector('[data-auth-panel="register"]');

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
            if (e.target.closest('.js-open-register-modal')) {
                e.preventDefault();
                switchMode('register');
            }
            if (e.target.closest('.js-open-login-modal')) {
                e.preventDefault();
                switchMode('login');
            }
        });

        overlay.querySelector('.login-modal-close').addEventListener('click', close);
        loginForm.addEventListener('submit', handleLoginSubmit);
        registerForm.addEventListener('submit', handleRegisterSubmit);

        document.addEventListener('keydown', function (e) {
            if (!opened) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        });
    }

    function open(options) {
        ensureModal();
        opened = true;
        overlay.classList.add('is-open');
        lockBodyScroll();

        if (options && options.mode === 'register') switchMode('register');
        else switchMode('login');

        if (options && options.prefillIdentifier && loginForm) {
            var idInput = loginForm.querySelector('input[name="identifier"]');
            if (idInput) idInput.value = options.prefillIdentifier;
        }

        if (options && options.notice) {
            if (activeMode === 'register') setAlert(registerAlert, options.notice, false);
            else setAlert(loginAlert, options.notice, false);
        }
    }

    function close() {
        if (!overlay || !opened) return;
        opened = false;
        overlay.classList.remove('is-open');
        unlockBodyScroll();

        if (loginForm) loginForm.reset();
        if (registerForm) registerForm.reset();
        isLoginSubmitting = false;
        isRegisterSubmitting = false;
        setAlert(loginAlert, '', false);
        setAlert(registerAlert, '', false);
        switchMode('login');

        if (lastTrigger && typeof lastTrigger.focus === 'function') {
            try {
                lastTrigger.focus();
            } catch (_) {
            }
        }
        lastTrigger = null;
    }

    function bindLoginTrigger(selector, options) {
        document.addEventListener('click', function (e) {
            var target = e.target.closest(selector);
            if (!target) return;
            e.preventDefault();
            lastTrigger = target;
            open(options || {});
        });
    }

    function formatRecordAlias(prefix) {
        var d = new Date();
        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        var hh = String(d.getHours()).padStart(2, '0');
        var mi = String(d.getMinutes()).padStart(2, '0');
        return (prefix || 'EXP') + '-' + yyyy + '-' + mm + '-' + dd + ' ' + hh + ':' + mi;
    }

    var recordSaveModal = null;
    var recordAliasInput = null;
    var recordAliasAlert = null;
    var recordConfirmBtn = null;
    var isRecordSaving = false;

    var recordDeleteConfirmModal = null;
    var recordDeleteConfirmMsg = null;
    var recordDeleteConfirmAlert = null;
    var recordDeleteConfirmBtn = null;
    var recordDeleteCancelBtn = null;
    var isRecordDeleteSubmitting = false;

    function setRecordAliasAlert(msg, ok) {
        if (!recordAliasAlert) return;
        recordAliasAlert.classList.remove('is-visible', 'is-error', 'is-success');
        if (!msg) {
            recordAliasAlert.innerHTML = '';
            return;
        }
        recordAliasAlert.innerHTML = String(msg).replace(/\n/g, '<br>');
        recordAliasAlert.classList.add('is-visible');
        recordAliasAlert.classList.add(ok ? 'is-success' : 'is-error');
    }

    function ensureRecordSaveModal() {
        if (recordSaveModal) return;
        recordSaveModal = document.createElement('div');
        recordSaveModal.className = 'login-modal-overlay';
        recordSaveModal.id = 'record-save-modal-overlay';
        recordSaveModal.innerHTML =
            '<div class="login-modal-card record-save-modal-card" role="dialog" aria-modal="true" aria-labelledby="record-save-modal-title">' +
            '  <button class="login-modal-close" type="button" aria-label="关闭">×</button>' +
            '  <div class="login-modal-head">' +
            '    <h2 class="login-modal-title" id="record-save-modal-title">保存至个人中心</h2>' +
            '    <p class="login-modal-subtitle" id="record-save-modal-subtitle">为本次实验记录设置一个易识别的别名</p>' +
            '  </div>' +
            '  <section class="login-modal-panel is-active">' +
            '    <div id="record-save-modal-alert" class="login-modal-alert"></div>' +
            '    <div class="login-modal-form">' +
            '      <div class="login-modal-field">' +
            '        <label for="record-save-modal-alias">实验别名</label>' +
            '        <input id="record-save-modal-alias" name="alias" type="text" maxlength="80" required>' +
            '        <p class="login-modal-field-hint">建议使用“实验名-日期 时间”格式，方便在个人中心检索。</p>' +
            '      </div>' +
            '      <button id="record-save-modal-submit" class="login-modal-submit" type="button">确认保存</button>' +
            '    </div>' +
            '  </section>' +
            '</div>';

        document.body.appendChild(recordSaveModal);
        recordAliasInput = recordSaveModal.querySelector('#record-save-modal-alias');
        recordAliasAlert = recordSaveModal.querySelector('#record-save-modal-alert');
        recordConfirmBtn = recordSaveModal.querySelector('#record-save-modal-submit');

        recordSaveModal.addEventListener('click', function (e) {
            if (e.target === recordSaveModal) closeRecordSaveModal();
        });
        recordSaveModal.querySelector('.login-modal-close').addEventListener('click', closeRecordSaveModal);
        recordAliasInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (recordConfirmBtn) recordConfirmBtn.click();
            }
        });
    }

    function closeRecordSaveModal() {
        if (!recordSaveModal) return;
        recordSaveModal.classList.remove('is-open');
        if (!overlay || !overlay.classList.contains('is-open')) {
            unlockBodyScroll();
        }
        isRecordSaving = false;
        setRecordAliasAlert('', false);
        if (recordConfirmBtn) {
            recordConfirmBtn.disabled = false;
            recordConfirmBtn.textContent = '确认保存';
        }
    }

    function openRecordSaveModal(options) {
        options = options || {};
        ensureRecordSaveModal();

        var titleEl = recordSaveModal.querySelector('#record-save-modal-title');
        var subtitleEl = recordSaveModal.querySelector('#record-save-modal-subtitle');
        if (titleEl) titleEl.textContent = options.title || '保存至个人中心';
        if (subtitleEl) subtitleEl.textContent = options.subtitle || '为本次实验记录设置一个易识别的别名';

        setRecordAliasAlert('', false);
        isRecordSaving = false;
        if (recordConfirmBtn) {
            recordConfirmBtn.disabled = false;
            recordConfirmBtn.textContent = '确认保存';
        }

        recordAliasInput.value = options.defaultAlias || formatRecordAlias(options.aliasPrefix || 'EXP');

        if (recordConfirmBtn) {
            recordConfirmBtn.onclick = async function () {
                if (isRecordSaving) return;
                var alias = (recordAliasInput.value || '').trim();
                if (!alias) {
                    setRecordAliasAlert('请输入实验别名。', false);
                    return;
                }
                if (typeof options.onConfirm !== 'function') {
                    closeRecordSaveModal();
                    return;
                }
                isRecordSaving = true;
                recordConfirmBtn.disabled = true;
                recordConfirmBtn.textContent = '保存中...';
                try {
                    await options.onConfirm(alias);
                    setRecordAliasAlert('已保存至个人中心。', true);
                    setTimeout(closeRecordSaveModal, 1000);
                } catch (err) {
                    setRecordAliasAlert(normalizeError(err, '保存失败，请稍后重试。'), false);
                    isRecordSaving = false;
                    recordConfirmBtn.disabled = false;
                    recordConfirmBtn.textContent = '确认保存';
                }
            };
        }

        recordSaveModal.classList.add('is-open');
        lockBodyScroll();
        setTimeout(function () {
            if (recordAliasInput) {
                recordAliasInput.focus();
                recordAliasInput.select();
            }
        }, 10);
    }

    function ensureRecordDeleteConfirmModal() {
        if (recordDeleteConfirmModal) return;
        recordDeleteConfirmModal = document.createElement('div');
        recordDeleteConfirmModal.className = 'login-modal-overlay';
        recordDeleteConfirmModal.id = 'record-delete-confirm-modal-overlay';
        recordDeleteConfirmModal.innerHTML =
            '<div class="login-modal-card record-save-modal-card" role="dialog" aria-modal="true" aria-labelledby="record-delete-confirm-modal-title">' +
            '  <button class="login-modal-close" type="button" aria-label="关闭">×</button>' +
            '  <div class="login-modal-head">' +
            '    <h2 class="login-modal-title" id="record-delete-confirm-modal-title">删除实验记录</h2>' +
            '    <p class="login-modal-subtitle" id="record-delete-confirm-modal-subtitle">该操作不可恢复，请再次确认</p>' +
            '  </div>' +
            '  <section class="login-modal-panel is-active">' +
            '    <div id="record-delete-confirm-modal-alert" class="login-modal-alert"></div>' +
            '    <p id="record-delete-confirm-modal-message" class="record-confirm-message">确定删除这条实验记录吗？删除后无法恢复。</p>' +
            '    <div class="record-confirm-actions">' +
            '      <button id="record-delete-confirm-cancel" class="login-modal-submit record-confirm-cancel" type="button">取消</button>' +
            '      <button id="record-delete-confirm-submit" class="login-modal-submit record-confirm-submit" type="button">确认删除</button>' +
            '    </div>' +
            '  </section>' +
            '</div>';

        document.body.appendChild(recordDeleteConfirmModal);
        recordDeleteConfirmMsg = recordDeleteConfirmModal.querySelector('#record-delete-confirm-modal-message');
        recordDeleteConfirmAlert = recordDeleteConfirmModal.querySelector('#record-delete-confirm-modal-alert');
        recordDeleteConfirmBtn = recordDeleteConfirmModal.querySelector('#record-delete-confirm-submit');
        recordDeleteCancelBtn = recordDeleteConfirmModal.querySelector('#record-delete-confirm-cancel');

        recordDeleteConfirmModal.addEventListener('click', function (e) {
            if (e.target === recordDeleteConfirmModal) closeRecordDeleteConfirmModal();
        });
        recordDeleteConfirmModal.querySelector('.login-modal-close').addEventListener('click', closeRecordDeleteConfirmModal);
        if (recordDeleteCancelBtn) recordDeleteCancelBtn.addEventListener('click', closeRecordDeleteConfirmModal);
    }

    function closeRecordDeleteConfirmModal() {
        if (!recordDeleteConfirmModal) return;
        recordDeleteConfirmModal.classList.remove('is-open');
        if (!overlay || !overlay.classList.contains('is-open')) {
            unlockBodyScroll();
        }
        isRecordDeleteSubmitting = false;
        setAlert(recordDeleteConfirmAlert, '', false);
        if (recordDeleteConfirmBtn) {
            recordDeleteConfirmBtn.disabled = false;
            recordDeleteConfirmBtn.textContent = '确认删除';
        }
    }

    function openRecordDeleteConfirmModal(options) {
        options = options || {};
        ensureRecordDeleteConfirmModal();

        var titleEl = recordDeleteConfirmModal.querySelector('#record-delete-confirm-modal-title');
        var subtitleEl = recordDeleteConfirmModal.querySelector('#record-delete-confirm-modal-subtitle');
        if (titleEl) titleEl.textContent = options.title || '删除实验记录';
        if (subtitleEl) subtitleEl.textContent = options.subtitle || '该操作不可恢复，请再次确认';
        if (recordDeleteConfirmMsg) {
            recordDeleteConfirmMsg.textContent = options.message || '确定删除这条实验记录吗？删除后无法恢复。';
        }

        setAlert(recordDeleteConfirmAlert, '', false);
        isRecordDeleteSubmitting = false;
        if (recordDeleteConfirmBtn) {
            recordDeleteConfirmBtn.disabled = false;
            recordDeleteConfirmBtn.textContent = '确认删除';
            recordDeleteConfirmBtn.onclick = async function () {
                if (isRecordDeleteSubmitting) return;
                if (typeof options.onConfirm !== 'function') {
                    closeRecordDeleteConfirmModal();
                    return;
                }
                isRecordDeleteSubmitting = true;
                recordDeleteConfirmBtn.disabled = true;
                recordDeleteConfirmBtn.textContent = '删除中...';
                try {
                    await options.onConfirm();
                    closeRecordDeleteConfirmModal();
                } catch (err) {
                    setAlert(recordDeleteConfirmAlert, normalizeError(err, '删除失败，请稍后重试。'), false);
                    isRecordDeleteSubmitting = false;
                    recordDeleteConfirmBtn.disabled = false;
                    recordDeleteConfirmBtn.textContent = '确认删除';
                }
            };
        }

        recordDeleteConfirmModal.classList.add('is-open');
        lockBodyScroll();
    }

    global.LoginModal = {
        open: open,
        close: close,
        bindLoginTrigger: bindLoginTrigger,
        switchMode: switchMode,
    };

    global.RecordSaveModal = {
        open: openRecordSaveModal,
        close: closeRecordSaveModal,
        makeDefaultAlias: formatRecordAlias
    };

    global.RecordDeleteConfirmModal = {
        open: openRecordDeleteConfirmModal,
        close: closeRecordDeleteConfirmModal
    };
})(window);
