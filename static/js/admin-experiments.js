/**
 * 数据管理页面 JS — 实验记录 / 笔记 / AI 会话
 */
(function () {
    'use strict';

    var currentTab = 'experiments';
    var filters = { exp: { page: 1, type: '', user: '' }, note: { page: 1, key: '', user: '' }, chat: { page: 1, user: '' } };
    var filterTimers = {};

    function init() {
        loadTypes();
        loadCurrentTab();
        // 标签页切换
        document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.admin-tab-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentTab = btn.dataset.tab;
                document.querySelectorAll('.admin-tab-panel').forEach(function(p) { p.style.display = 'none'; });
                document.getElementById('tab-' + currentTab).style.display = '';
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
            renderExperiments(data.experiments);
            var pg = data.pagination;
            var pagEl = document.getElementById('exp-pagination');
            if (pagEl) pagEl.innerHTML = renderPagination(pg.page, pg.total_pages, 'loadExperiments');
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="admin-alert error">加载失败: ' + escHtml(e.message) + '</div></td></tr>';
        }
    };

    function renderExperiments(items) {
        var tbody = document.getElementById('exp-tbody');
        if (!tbody) return;
        if (!items || items.length === 0) { tbody.innerHTML = '<tr><td colspan="6"><div class="admin-empty">暂无</div></td></tr>'; return; }
        tbody.innerHTML = items.map(function(e) {
            return '<tr><td>' + e.id + '</td><td>' + escHtml(e.alias || '—') + '</td><td>' + escHtml(e.source_page || '—') +
                '</td><td>' + escHtml(e.username) + '</td><td>' + fmtTime(e.created_at) + '</td>' +
                '<td><button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="showExpDetail(' + e.id + ')">' +
                '<i class="fas fa-eye"></i> 详情</button> ' +
                '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="confirmDeleteExp(' + e.id + ')">' +
                '<i class="fas fa-trash"></i> 删除</button></td></tr>';
        }).join('');
    }

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
            renderTable(data.notes, 'note-tbody', function(n) {
                return '<tr><td>' + n.id + '</td><td>' + escHtml(n.title || '—') + '</td><td>' + escHtml(n.experiment_key) +
                    '</td><td>' + escHtml(n.username) + '</td><td>' + fmtTime(n.updated_at) + '</td>' +
                    '<td><button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="showNoteDetail(' + n.id + ')">' +
                    '<i class="fas fa-eye"></i> 查看</button></td></tr>';
            });
            var pg = data.pagination;
            var pagEl = document.getElementById('note-pagination');
            if (pagEl) pagEl.innerHTML = renderPagination(pg.page, pg.total_pages, 'loadNotes');
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="admin-alert error">加载失败: ' + escHtml(e.message) + '</div></td></tr>';
        }
    };

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
            renderTable(data.chats, 'chat-tbody', function(c) {
                return '<tr><td class="mono">' + escHtml(c.id).substring(0, 8) + '...</td>' +
                    '<td>' + escHtml(c.username) + '</td><td>' + escHtml(c.page_id) + '</td>' +
                    '<td>' + c.message_count + '</td>' +
                    '<td>' + (c.is_active ? '<span style="color:#2E7D32;">活跃</span>' : '<span style="color:#9E9E9E;">已关闭</span>') + '</td>' +
                    '<td>' + fmtTime(c.created_at) + '</td><td>' + fmtTime(c.updated_at) + '</td></tr>';
            });
            var pg = data.pagination;
            var pagEl = document.getElementById('chat-pagination');
            if (pagEl) pagEl.innerHTML = renderPagination(pg.page, pg.total_pages, 'loadChats');
        } catch(e) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="admin-alert error">加载失败: ' + escHtml(e.message) + '</div></td></tr>';
        }
    };

    function renderTable(items, tbodyId, rowFn) {
        var tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        if (!items || items.length === 0) { tbody.innerHTML = '<tr><td colspan="99"><div class="admin-empty">暂无</div></td></tr>'; return; }
        tbody.innerHTML = items.map(rowFn).join('');
    }

    // ── 笔记内容弹窗 ──
    window.showNoteDetail = async function(id) {
        try {
            var data = await adminApi('/api/admin/notes?page=1&page_size=500');
            var note = (data.notes || []).find(function(n) { return n.id === id; });
            if (!note) { alert('未找到'); return; }
            document.getElementById('exp-detail-content').innerHTML =
                '<table class="admin-table"><tr><th style="width:100px;">ID</th><td>' + note.id + '</td></tr>' +
                '<tr><th>标题</th><td><strong>' + escHtml(note.title || '—') + '</strong></td></tr>' +
                '<tr><th>实验键</th><td>' + escHtml(note.experiment_key) + '</td></tr>' +
                '<tr><th>用户</th><td>' + escHtml(note.username) + '</td></tr>' +
                '<tr><th>更新时间</th><td>' + fmtTime(note.updated_at) + '</td></tr></table>' +
                '<h4 style="margin-top:14px;">内容</h4>' +
                renderJsonPreview(note.content || '(空)');
            document.getElementById('exp-detail-modal').style.display = '';
        } catch(e) { alert('加载失败: ' + e.message); }
    };

    // ── 实验详情 ──
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

    // ── 删除 ──
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
