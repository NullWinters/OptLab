(function () {
    'use strict';
    var ADMIN_TOKEN_KEY = 'optlab_admin_token';
    var regSection = document.getElementById('admin-register-section');
    var loginSection = document.getElementById('admin-login-section');
    var envSection = document.getElementById('admin-env-section');
    var regForm = document.getElementById('admin-register-form');
    var regError = document.getElementById('reg-error');
    var loginForm = document.getElementById('admin-login-form');
    var loginError = document.getElementById('login-error');
    var envForm = document.getElementById('env-vars-form');
    var envContainer = document.getElementById('env-vars-container');
    var envSaveMsg = document.getElementById('env-save-msg');
    var envSaveError = document.getElementById('env-save-error');
    var logoutBtn = document.getElementById('logout-admin-btn');

    function show(el) { if (el) el.classList.remove('is-hidden'); }
    function hide(el) { if (el) el.classList.add('is-hidden'); }
    function hideAll() { hide(regSection); hide(loginSection); hide(envSection); }
    function setError(el, msg) { if (!el) return; el.textContent = msg || ''; if (msg) show(el); else hide(el); }

    function getAdminToken() { try { return localStorage.getItem(ADMIN_TOKEN_KEY); } catch (e) { return null; } }
    function setAdminToken(t) { try { localStorage.setItem(ADMIN_TOKEN_KEY, t); } catch (e) {} }
    function clearAdminToken() { try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch (e) {} }

    async function adminApiRequest(path, options) {
        var opts = options || {};
        var headers = opts.headers ? Object.assign({}, opts.headers) : {};
        if (!headers['Content-Type'] && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
        var token = getAdminToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;
        var resp = await fetch(path, Object.assign({}, opts, { headers: headers }));
        var text = await resp.text();
        var data;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
        if (!resp.ok) {
            var msg = (data && typeof data.detail === 'string') ? data.detail : ('请求失败（状态码 ' + resp.status + '）');
            var err = new Error(msg); err.status = resp.status; throw err;
        }
        return data;
    }

    regForm.addEventListener('submit', async function (e) {
        e.preventDefault(); setError(regError, '');
        var u = document.getElementById('reg-username').value.trim();
        var p = document.getElementById('reg-password').value;
        var c = document.getElementById('reg-confirm').value;
        if (p !== c) { setError(regError, '两次输入的密码不一致。'); return; }
        try {
            var data = await adminApiRequest('/api/admin/register', { method: 'POST', body: JSON.stringify({ username: u, password: p, confirm_password: c }) });
            setAdminToken(data.token); await loadEnvEditor();
        } catch (err) { setError(regError, err.message); }
    });

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault(); setError(loginError, '');
        var u = document.getElementById('login-username').value.trim();
        var p = document.getElementById('login-password').value;
        try {
            var data = await adminApiRequest('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
            setAdminToken(data.token); await loadEnvEditor();
        } catch (err) { setError(loginError, err.message); }
    });

    envForm.addEventListener('submit', async function (e) {
        e.preventDefault(); hide(envSaveMsg); hide(envSaveError);
        var vars = {};
        envContainer.querySelectorAll('input[data-env-key]').forEach(function (input) { vars[input.getAttribute('data-env-key')] = input.value; });
        try {
            var data = await adminApiRequest('/api/admin/env', { method: 'PUT', body: JSON.stringify({ vars: vars }) });
            envSaveMsg.textContent = data.message || '保存成功。'; show(envSaveMsg);
        } catch (err) { envSaveError.textContent = err.message; show(envSaveError); }
    });

    logoutBtn.addEventListener('click', function () { clearAdminToken(); hideAll(); show(loginSection); });

    async function loadEnvEditor() {
        try {
            var envVars = await adminApiRequest('/api/admin/env', { method: 'GET' });
            renderEnvFields(envVars); hideAll(); show(envSection);
        } catch (err) {
            if (err.status === 401) { clearAdminToken(); hideAll(); show(loginSection); }
            else { setError(envSaveError, err.message); show(envSaveError); }
        }
    }

    function renderEnvFields(envVars) {
        envContainer.innerHTML = '';
        var grid = document.createElement('div'); grid.className = 'admin-env-grid';
        Object.keys(envVars).sort().forEach(function (key) {
            var val = envVars[key] || '';
            var field = document.createElement('div'); field.className = 'admin-env-field';
            var label = document.createElement('label'); label.textContent = key; label.setAttribute('for', 'env-' + key);
            var input = document.createElement('input'); input.type = 'text'; input.id = 'env-' + key;
            input.setAttribute('data-env-key', key); input.value = val;
            if (val === '********') { input.readOnly = true; input.title = '此值为敏感信息，已屏蔽显示'; }
            field.appendChild(label); field.appendChild(input); grid.appendChild(field);
        });
        envContainer.appendChild(grid);
    }

    async function init() {
        try {
            var status = await adminApiRequest('/api/admin/status', { method: 'POST' });
            if (status.configured) {
                var token = getAdminToken();
                if (token) { await loadEnvEditor(); } else { hideAll(); show(loginSection); }
            } else { hideAll(); show(regSection); }
        } catch (err) { hideAll(); show(loginSection); }
    }
    document.addEventListener('DOMContentLoaded', init);
})();
