/**
 * 后台管理系统共享 JS
 * 认证 / API 请求 / 工具函数 / 侧边栏 / 退出登录
 */
(function () {
    'use strict';

    var TOKEN_KEY = 'optlab_admin_token';
    var ADMIN_USERNAME_KEY = 'optlab_admin_username';

    // ═══════════════════════════════════════════════════════
    // 认证
    // ═══════════════════════════════════════════════════════

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token) {
        localStorage.setItem(TOKEN_KEY, token);
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ADMIN_USERNAME_KEY);
    }

    /** 核心 API 请求 */
    async function adminApi(path, options) {
        if (!options) options = {};
        var headers = options.headers || {};
        var token = getToken();
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        var resp = await fetch(path, {
            method: options.method || 'GET',
            headers: headers,
            body: options.body || undefined,
            signal: options.signal || undefined,
        });
        if (!resp.ok) {
            var detail = '';
            try {
                var err = JSON.parse(await resp.text());
                detail = err.detail || '';
            } catch (e) { /* ignore */ }
            throw new Error(detail || '请求失败 (HTTP ' + resp.status + ')');
        }
        return resp.json();
    }

    /** 检查管理员认证：无 token 则显示登录/注册界面 */
    function ensureAdminAuth() {
        var token = getToken();
        if (!token) {
            showAuth();
            return false;
        }
        // token 存在，假定有效
        showMain();
        highlightSidebar();
        return true;
    }

    // ═══════════════════════════════════════════════════════
    // 认证界面
    // ═══════════════════════════════════════════════════════

    async function showAuth() {
        var authWrap = document.getElementById('admin-auth-wrap');
        var main = document.getElementById('admin-main');
        if (authWrap) authWrap.style.display = '';
        if (main) main.style.display = 'none';

        // 检查是否已配置管理员
        try {
            var resp = await fetch('/api/admin/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            var data = await resp.json();
            if (data.configured) {
                showLogin();
            } else {
                showRegister(data.setup_hint || '');
            }
        } catch (e) {
            showLogin();
        }
    }

    function showLogin() {
        var regCard = document.getElementById('admin-register-card');
        var loginCard = document.getElementById('admin-login-card');
        if (regCard) regCard.style.display = 'none';
        if (loginCard) loginCard.style.display = '';
        var authWrap = document.getElementById('admin-auth-wrap');
        if (authWrap) authWrap.style.display = '';
    }

    function showRegister(setupHint) {
        var regCard = document.getElementById('admin-register-card');
        var loginCard = document.getElementById('admin-login-card');
        if (regCard) regCard.style.display = '';
        if (loginCard) loginCard.style.display = 'none';
        var authWrap = document.getElementById('admin-auth-wrap');
        if (authWrap) authWrap.style.display = '';
        var hintEl = document.getElementById('admin-setup-hint');
        if (hintEl && setupHint) {
            hintEl.textContent = '设置密钥提示: ' + setupHint + '（完整密钥请在服务端控制台查看）';
            hintEl.style.display = 'block';
        }
    }

    function showMain() {
        var authWrap = document.getElementById('admin-auth-wrap');
        var main = document.getElementById('admin-main');
        if (authWrap) authWrap.style.display = 'none';
        if (main) main.style.display = '';
    }

    // 绑定登录/注册表单
    document.addEventListener('DOMContentLoaded', function () {
        var regForm = document.getElementById('admin-register-form');
        if (regForm) {
            regForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                var username = document.getElementById('admin-reg-username').value.trim();
                var password = document.getElementById('admin-reg-password').value;
                var confirm = document.getElementById('admin-reg-confirm').value;
                var errEl = document.getElementById('admin-reg-error');
                errEl.style.display = 'none';
                if (password !== confirm) {
                    errEl.textContent = '两次输入的密码不一致。';
                    errEl.style.display = 'block';
                    return;
                }
                try {
                    var setupKey = document.getElementById('admin-reg-setup-key').value.trim();
                    var data = await adminApi('/api/admin/register', {
                        method: 'POST',
                        body: JSON.stringify({ username: username, password: password, confirm_password: confirm, setup_key: setupKey }),
                    });
                    setToken(data.token);
                    localStorage.setItem(ADMIN_USERNAME_KEY, data.username);
                    showMain();
                    highlightSidebar();
                    window.dispatchEvent(new Event('admin-authenticated'));
                } catch (err) {
                    errEl.textContent = err.message;
                    errEl.style.display = 'block';
                }
            });
        }

        var loginForm = document.getElementById('admin-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                var username = document.getElementById('admin-login-username').value.trim();
                var password = document.getElementById('admin-login-password').value;
                var errEl = document.getElementById('admin-login-error');
                errEl.style.display = 'none';
                try {
                    var data = await adminApi('/api/admin/login', {
                        method: 'POST',
                        body: JSON.stringify({ username: username, password: password }),
                    });
                    setToken(data.token);
                    localStorage.setItem(ADMIN_USERNAME_KEY, data.username);
                    showMain();
                    highlightSidebar();
                    window.dispatchEvent(new Event('admin-authenticated'));
                } catch (err) {
                    errEl.textContent = err.message;
                    errEl.style.display = 'block';
                }
            });
        }

        var logoutBtn = document.getElementById('admin-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                clearToken();
                showAuth();
            });
        }

        // 非认证页面初始化
        var authWrap = document.getElementById('admin-auth-wrap');
        if (authWrap) {
            var token = getToken();
            if (token) {
                showMain();
                highlightSidebar();
            } else {
                showAuth();
            }
        }
    });

    /** 侧边栏当前页高亮 */
    function highlightSidebar() {
        var path = window.location.pathname;
        var links = document.querySelectorAll('.admin-sidebar-nav a');
        var matched = null;
        links.forEach(function (a) {
            var href = a.getAttribute('href');
            a.classList.remove('active');
            if (href === path) matched = a;
        });
        if (matched) {
            matched.classList.add('active');
        } else if (path.startsWith('/admin')) {
            // 默认高亮仪表盘
            var dash = document.querySelector('.admin-sidebar-nav a[data-page="dashboard"]');
            if (dash) dash.classList.add('active');
        }
    }

    // ═══════════════════════════════════════════════════════
    // 工具函数
    // ═══════════════════════════════════════════════════════

    window.escHtml = function (str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    window.fmtTime = function (iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.toLocaleString('zh-CN', { hour12: false });
        } catch (e) {
            return iso;
        }
    };

    window.fmtShortTime = function (iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.toLocaleDateString('zh-CN') + ' ' +
                String(d.getHours()).padStart(2, '0') + ':' +
                String(d.getMinutes()).padStart(2, '0');
        } catch (e) {
            return iso;
        }
    };

    /** 简单分页 HTML */
    window.renderPagination = function (page, totalPages, onClick) {
        if (totalPages <= 1) return '';
        var html = '';
        html += '<button ' + (page <= 1 ? 'disabled' : '') + ' onclick="' + onClick + '(' + (page - 1) + ')">上一页</button>';
        var start = Math.max(1, page - 2);
        var end = Math.min(totalPages, page + 2);
        for (var i = start; i <= end; i++) {
            html += '<button class="' + (i === page ? 'active' : '') + '" onclick="' + onClick + '(' + i + ')">' + i + '</button>';
        }
        html += '<button ' + (page >= totalPages ? 'disabled' : '') + ' onclick="' + onClick + '(' + (page + 1) + ')">下一页</button>';
        html += '<span class="page-info">第 ' + page + ' / ' + totalPages + ' 页</span>';
        return html;
    };

    /** JSON 格式化到 <pre> */
    window.renderJsonPreview = function (obj) {
        var text;
        try {
            text = JSON.stringify(obj, null, 2);
        } catch (e) {
            text = String(obj);
        }
        return '<pre class="admin-json-preview">' + window.escHtml(text) + '</pre>';
    };

    // 暴露到全局
    window.getAdminToken = getToken;
    window.setAdminToken = setToken;
    window.clearAdminToken = clearToken;
    window.adminApi = adminApi;
    window.ensureAdminAuth = ensureAdminAuth;
    window.showMain = showMain;
    window.showAuth = showAuth;
})();
