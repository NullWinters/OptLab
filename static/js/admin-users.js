/**
 * 用户管理页面 JS
 * 搜索 / 分页 / 详情弹窗 / 删除确认
 */
(function () {
    'use strict';

    if (!ensureAdminAuth()) {
        window.addEventListener('admin-authenticated', init, { once: true });
    } else {
        init();
    }

    var currentPage = 1;
    var currentSearch = '';
    var searchTimer = null;

    function init() {
        loadUsers();
    }

    window.loadUsers = async function (page) {
        if (page) currentPage = page;
        var tbody = document.getElementById('user-tbody');
        tbody.innerHTML = '<tr><td colspan="7" class="admin-loading"><span class="admin-spinner"></span>加载中...</td></tr>';
        try {
            var data = await adminApi(
                '/api/admin/users?search=' + encodeURIComponent(currentSearch) +
                '&page=' + currentPage + '&page_size=20'
            );
            renderUsers(data.users);
            var pg = data.pagination;
            document.getElementById('user-pagination').innerHTML = renderPagination(pg.page, pg.total_pages, 'loadUsers');
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="7" class="admin-alert error" style="display:block;">加载失败: ' + escHtml(e.message) + '</td></tr>';
        }
    };

    function renderUsers(users) {
        var tbody = document.getElementById('user-tbody');
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="admin-empty">暂无用户数据</div></td></tr>';
            return;
        }
        tbody.innerHTML = users.map(function (u) {
            return '<tr>' +
                '<td>' + u.id + '</td>' +
                '<td><strong>' + escHtml(u.username) + '</strong></td>' +
                '<td class="mono">' + escHtml(u.email) + '</td>' +
                '<td>' + fmtTime(u.created_at) + '</td>' +
                '<td>' + (u.experiment_count || 0) + '</td>' +
                '<td>' + (u.note_count || 0) + '</td>' +
                '<td>' +
                '<button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="showUserDetail(' + u.id + ')">' +
                '<i class="fas fa-eye"></i> 详情</button> ' +
                '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="confirmDeleteUser(' + u.id + ',\'' + escHtml(u.username) + '\')">' +
                '<i class="fas fa-trash"></i> 删除</button>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    window.debounceSearch = function () {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            currentSearch = document.getElementById('user-search').value.trim();
            currentPage = 1;
            loadUsers();
        }, 400);
    };

    // ── 详情弹窗 ──
    window.showUserDetail = async function (userId) {
        try {
            var data = await adminApi('/api/admin/users/' + userId);
            document.getElementById('user-detail-content').innerHTML =
                '<table class="admin-table">' +
                '<tr><th style="width:120px;">ID</th><td>' + data.id + '</td></tr>' +
                '<tr><th>用户名</th><td><strong>' + escHtml(data.username) + '</strong></td></tr>' +
                '<tr><th>邮箱</th><td class="mono">' + escHtml(data.email) + '</td></tr>' +
                '<tr><th>注册时间</th><td>' + fmtTime(data.created_at) + '</td></tr>' +
                '<tr><th>实验记录</th><td>' + (data.experiment_count || 0) + ' 条</td></tr>' +
                '<tr><th>实验笔记</th><td>' + (data.note_count || 0) + ' 条</td></tr>' +
                '<tr><th>AI 会话</th><td>' + (data.chat_count || 0) + ' 个</td></tr>' +
                '</table>' +
                (data.recent_experiments && data.recent_experiments.length > 0
                    ? '<h4 style="margin-top:16px;">最近实验</h4>' +
                      '<table class="admin-table"><thead><tr><th>别名</th><th>类型</th><th>时间</th></tr></thead><tbody>' +
                      data.recent_experiments.map(function (e) {
                          return '<tr><td>' + escHtml(e.alias || '—') + '</td><td>' + escHtml(e.source_page || '—') + '</td><td>' + fmtTime(e.created_at) + '</td></tr>';
                      }).join('') + '</tbody></table>'
                    : '');
            document.getElementById('user-detail-modal').style.display = '';
        } catch (e) {
            alert('加载失败: ' + e.message);
        }
    };

    window.closeUserDetail = function () {
        document.getElementById('user-detail-modal').style.display = 'none';
    };

    // ── 删除确认 ──
    var pendingDeleteId = null;

    window.confirmDeleteUser = function (userId, username) {
        pendingDeleteId = userId;
        document.getElementById('delete-confirm-msg').innerHTML =
            '确定删除用户 <strong>' + escHtml(username) + '</strong> 吗？其所有实验记录、笔记和 AI 会话也将一并删除。此操作不可撤销。';
        document.getElementById('delete-confirm-modal').style.display = '';
        document.getElementById('delete-confirm-btn').onclick = executeDeleteUser;
    };

    window.closeDeleteConfirm = function () {
        document.getElementById('delete-confirm-modal').style.display = 'none';
        pendingDeleteId = null;
    };

    async function executeDeleteUser() {
        if (!pendingDeleteId) return;
        var btn = document.getElementById('delete-confirm-btn');
        btn.disabled = true;
        btn.textContent = '删除中...';
        try {
            await adminApi('/api/admin/users/' + pendingDeleteId, { method: 'DELETE' });
            closeDeleteConfirm();
            loadUsers();
        } catch (e) {
            alert('删除失败: ' + e.message);
        }
        btn.disabled = false;
        btn.textContent = '确认删除';
    }
})();
