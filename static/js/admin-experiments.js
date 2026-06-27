/**
 * 实验管理页面 JS
 * 筛选 / 分页 / 详情弹窗 / 删除确认
 */
(function () {
    'use strict';

    if (!ensureAdminAuth()) {
        window.addEventListener('admin-authenticated', init, { once: true });
    } else {
        init();
    }

    var currentPage = 1;
    var currentSourcePage = '';
    var currentUserId = '';
    var filterTimer = null;

    function init() {
        loadTypes();
        loadExperiments();
    }

    async function loadTypes() {
        try {
            var data = await adminApi('/api/admin/experiments/stats');
            var types = data.experiments_by_type || [];
            var sel = document.getElementById('exp-type-filter');
            types.forEach(function (t) {
                var opt = document.createElement('option');
                opt.value = t.source_page;
                opt.textContent = t.source_page + ' (' + t.count + ')';
                sel.appendChild(opt);
            });
        } catch (e) {
            console.error(e);
        }
    }

    window.loadExperiments = async function (page) {
        if (page) currentPage = page;
        currentSourcePage = document.getElementById('exp-type-filter').value;
        currentUserId = document.getElementById('exp-user-filter').value.trim();
        var tbody = document.getElementById('exp-tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="admin-loading"><span class="admin-spinner"></span>加载中...</td></tr>';
        try {
            var params = 'page=' + currentPage + '&page_size=20';
            if (currentSourcePage) params += '&source_page=' + encodeURIComponent(currentSourcePage);
            if (currentUserId) params += '&user_id=' + encodeURIComponent(currentUserId);
            var data = await adminApi('/api/admin/experiments?' + params);
            renderExperiments(data.experiments);
            var pg = data.pagination;
            document.getElementById('exp-pagination').innerHTML = renderPagination(pg.page, pg.total_pages, 'loadExperiments');
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="6" class="admin-alert error" style="display:block;">加载失败: ' + escHtml(e.message) + '</td></tr>';
        }
    };

    function renderExperiments(experiments) {
        var tbody = document.getElementById('exp-tbody');
        if (!experiments || experiments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="admin-empty">暂无实验记录</div></td></tr>';
            return;
        }
        tbody.innerHTML = experiments.map(function (e) {
            return '<tr>' +
                '<td>' + e.id + '</td>' +
                '<td>' + escHtml(e.alias || '—') + '</td>' +
                '<td>' + escHtml(e.source_page || '—') + '</td>' +
                '<td>' + escHtml(e.username) + '</td>' +
                '<td>' + fmtTime(e.created_at) + '</td>' +
                '<td>' +
                '<button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="showExpDetail(' + e.id + ')">' +
                '<i class="fas fa-eye"></i> 详情</button> ' +
                '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="confirmDeleteExp(' + e.id + ')">' +
                '<i class="fas fa-trash"></i> 删除</button>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    window.debounceFilter = function () {
        if (filterTimer) clearTimeout(filterTimer);
        filterTimer = setTimeout(function () {
            currentPage = 1;
            loadExperiments();
        }, 400);
    };

    // ── 详情弹窗 ──
    window.showExpDetail = async function (id) {
        try {
            var listData = await adminApi('/api/admin/experiments?page=1&page_size=200');
            var exp = (listData.experiments || []).find(function (e) { return e.id === id; });
            if (!exp) { alert('未找到该记录'); return; }
            document.getElementById('exp-detail-content').innerHTML =
                '<table class="admin-table">' +
                '<tr><th style="width:120px;">ID</th><td>' + exp.id + '</td></tr>' +
                '<tr><th>别名</th><td>' + escHtml(exp.alias || '—') + '</td></tr>' +
                '<tr><th>实验页面</th><td>' + escHtml(exp.source_page || '—') + '</td></tr>' +
                '<tr><th>用户</th><td>' + escHtml(exp.username) + '</td></tr>' +
                '<tr><th>创建时间</th><td>' + fmtTime(exp.created_at) + '</td></tr>' +
                '</table>' +
                '<h4 style="margin-top:16px;">实验数据 (Payload)</h4>' +
                renderJsonPreview(exp.payload || {});
            document.getElementById('exp-detail-modal').style.display = '';
        } catch (e) {
            alert('加载失败: ' + e.message);
        }
    };

    window.closeExpDetail = function () {
        document.getElementById('exp-detail-modal').style.display = 'none';
    };

    // ── 删除确认 ──
    var pendingExpDeleteId = null;

    window.confirmDeleteExp = function (id) {
        pendingExpDeleteId = id;
        document.getElementById('exp-delete-msg').innerHTML =
            '确定删除实验记录 <strong>#' + id + '</strong> 吗？此操作不可撤销。';
        document.getElementById('exp-delete-modal').style.display = '';
        document.getElementById('exp-delete-btn').onclick = executeDeleteExp;
    };

    window.closeExpDelete = function () {
        document.getElementById('exp-delete-modal').style.display = 'none';
        pendingExpDeleteId = null;
    };

    async function executeDeleteExp() {
        if (!pendingExpDeleteId) return;
        var btn = document.getElementById('exp-delete-btn');
        btn.disabled = true;
        btn.textContent = '删除中...';
        try {
            await adminApi('/api/admin/experiments/' + pendingExpDeleteId, { method: 'DELETE' });
            closeExpDelete();
            loadExperiments();
        } catch (e) {
            alert('删除失败: ' + e.message);
        }
        btn.disabled = false;
        btn.textContent = '确认删除';
    }
})();
