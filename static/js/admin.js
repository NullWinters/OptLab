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

        // 忘记密码链接 → 显示重置密码卡片
        var forgotLink = document.getElementById('admin-forgot-link');
        if (forgotLink) {
            forgotLink.addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('admin-login-card').style.display = 'none';
                document.getElementById('admin-reset-card').style.display = '';
            });
        }

        // 返回登录链接
        var resetBack = document.getElementById('admin-reset-back');
        if (resetBack) {
            resetBack.addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('admin-reset-card').style.display = 'none';
                document.getElementById('admin-login-card').style.display = '';
            });
        }

        // 忘记密码页：生成设置密钥按钮
        var requestKeyBtn = document.getElementById('admin-request-key-btn');
        if (requestKeyBtn) {
            requestKeyBtn.addEventListener('click', async function() {
                var btn = this;
                var result = document.getElementById('admin-request-key-result');
                btn.disabled = true;
                btn.innerHTML = '<span class="admin-spinner" style="width:12px;height:12px;border-width:2px;"></span> 生成中...';
                result.textContent = '';
                try {
                    var data = await adminApi('/api/admin/request-reset-key', { method: 'POST' });
                    result.innerHTML = '<span style="color:#E65100;"><i class="fas fa-check-circle"></i> 密钥已生成并写入 .env 文件</span><br><span style="color:#9E9E9E;">完整密钥已输出到服务端控制台，请查看终端窗口。提示: ' + escHtml(data.hint) + '</span>';
                } catch (e) {
                    result.textContent = '生成失败: ' + e.message;
                }
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-key"></i> 生成设置密钥（写入 .env）';
            });
        }

        // 重置密码表单
        var resetForm = document.getElementById('admin-reset-form');
        if (resetForm) {
            resetForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                var username = document.getElementById('admin-reset-username').value.trim();
                var setupKey = document.getElementById('admin-reset-setup-key').value.trim();
                var password = document.getElementById('admin-reset-password').value;
                var confirm = document.getElementById('admin-reset-confirm').value;
                var errEl = document.getElementById('admin-reset-error');
                errEl.style.display = 'none';
                if (password !== confirm) {
                    errEl.textContent = '两次输入的密码不一致。';
                    errEl.style.display = 'block';
                    return;
                }
                try {
                    var data = await adminApi('/api/admin/reset-password', {
                        method: 'POST',
                        body: JSON.stringify({ username: username, password: password, confirm_password: confirm, setup_key: setupKey }),
                    });
                    setToken(data.token);
                    localStorage.setItem(ADMIN_USERNAME_KEY, data.username);
                    document.getElementById('admin-reset-card').style.display = 'none';
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

        // 侧边栏折叠/展开
        var toggleBtn = document.getElementById('admin-sidebar-toggle');
        if (toggleBtn) {
            function toggleSidebar() {
                var sb = document.querySelector('.admin-sidebar');
                var content = document.querySelector('.admin-content');
                if (!sb) return;
                var collapsed = sb.classList.toggle('collapsed');
                if (content) {
                    content.style.marginLeft = collapsed ? '60px' : '240px';
                }
                var icon = toggleBtn.querySelector('i');
                var label = toggleBtn.querySelector('span');
                if (collapsed) {
                    if (icon) { icon.classList.remove('fa-chevron-left'); icon.classList.add('fa-chevron-right'); }
                    if (label) label.textContent = '';
                } else {
                    if (icon) { icon.classList.remove('fa-chevron-right'); icon.classList.add('fa-chevron-left'); }
                    if (label) label.textContent = '折叠';
                }
                localStorage.setItem('optlab_admin_sidebar_collapsed', collapsed ? '1' : '0');
            }
            toggleBtn.addEventListener('click', toggleSidebar);
            // 恢复上次折叠状态
            if (localStorage.getItem('optlab_admin_sidebar_collapsed') === '1') {
                var sb = document.querySelector('.admin-sidebar');
                var content = document.querySelector('.admin-content');
                if (sb) {
                    sb.classList.add('collapsed');
                    if (content) content.style.marginLeft = '60px';
                    var icon = toggleBtn.querySelector('i');
                    var label = toggleBtn.querySelector('span');
                    if (icon) { icon.classList.remove('fa-chevron-left'); icon.classList.add('fa-chevron-right'); }
                    if (label) label.textContent = '';
                }
            }
        }

        // 非认证页面初始化
        var authWrap = document.getElementById('admin-auth-wrap');
        if (authWrap) {
            var token = getToken();
            if (token) {
                showMain();
                highlightSidebar();
                window.dispatchEvent(new Event('admin-authenticated'));
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
