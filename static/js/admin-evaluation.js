/**
 * 评测工作台 JS
 * 从旧项目 evaluation-workbench.js 移植并适配后台布局
 */
(function () {
    'use strict';

    // 等待认证完成后初始化
    window.addEventListener('admin-authenticated', init, { once: true });
    if (window.getAdminToken && window.getAdminToken()) {
        var main = document.getElementById('admin-main');
        if (main && main.style.display !== 'none') {
            window.removeEventListener('admin-authenticated', init);
            init();
        }
    }

    var lastResult = null;

    function init() {
        loadProfiles();
        createPairRow('case-1');
        document.getElementById('add-pair-btn').addEventListener('click', function () {
            createPairRow('case-' + (document.querySelectorAll('#pair-rows tr').length + 1));
        });
        document.getElementById('run-eval-btn').addEventListener('click', runEvaluation);
    }

    function createPairRow(defaultId) {
        var tbody = document.getElementById('pair-rows');
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td><input type="text" value="' + escHtml(defaultId) + '" style="width:100%;padding:6px 8px;border:1px solid #FFE0B2;border-radius:6px;font-size:0.88em;"></td>' +
            '<td><input type="file" accept=".csv,.json" style="width:100%;"></td>' +
            '<td><input type="file" accept=".md,.markdown,.txt" style="width:100%;"></td>' +
            '<td><button class="admin-btn admin-btn-danger admin-btn-sm" type="button" onclick="this.closest(\'tr\').remove()">' +
            '<i class="fas fa-times"></i> 移除</button></td>';
        tbody.appendChild(tr);
    }

    function collectPairs() {
        var rows = document.querySelectorAll('#pair-rows tr');
        var pairs = [];
        rows.forEach(function (tr) {
            var inputs = tr.querySelectorAll('input');
            var caseId = (inputs[0].value || '').trim();
            var recFile = inputs[1].files[0];
            var repFile = inputs[2].files[0];
            if (caseId && recFile && repFile) {
                pairs.push({ caseId: caseId, record: recFile, report: repFile });
            }
        });
        return pairs;
    }

    async function runEvaluation() {
        var pairs = collectPairs();
        if (pairs.length === 0) {
            var status = document.getElementById('eval-run-status');
            status.innerHTML = '<span style="color:#C62828;">请至少填写一组有效的文件。</span>';
            return;
        }
        var strict = document.getElementById('strict-profiles').checked;
        var status = document.getElementById('eval-run-status');
        var btn = document.getElementById('run-eval-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="admin-spinner" style="width:14px;height:14px;border-width:2px;"></span> 评测中...';
        status.innerHTML = '<span style="color:#FF8F00;">正在构建评测集并评分，请稍候...</span>';

        try {
            var formData = new FormData();
            pairs.forEach(function (p) {
                formData.append('case_ids', p.caseId);
                formData.append('record_files', p.record);
                formData.append('report_files', p.report);
            });
            formData.append('strict_profiles', strict);

            var token = getAdminToken();
            var resp = await fetch('/api/admin/evaluation/run', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData,
            });
            if (!resp.ok) {
                var errText = '';
                try { var err = JSON.parse(await resp.text()); errText = err.detail || ''; } catch (e) {}
                throw new Error(errText || 'HTTP ' + resp.status);
            }
            var data = await resp.json();
            lastResult = data;
            renderResults(data);
            status.innerHTML = '<span style="color:#2E7D32;"><i class="fas fa-check-circle"></i> 评测完成</span>';
        } catch (e) {
            status.innerHTML = '<span style="color:#C62828;"><i class="fas fa-times-circle"></i> ' + escHtml(e.message) + '</span>';
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> 一键构建并评分';
    }

    function renderResults(data) {
        document.getElementById('result-section').classList.remove('admin-eval-hidden');

        var summary = data.summary || {};
        document.getElementById('summary-cards').innerHTML =
            '<div class="admin-eval-summary-item"><div class="label">总用例数</div><div class="value">' + (summary.total_cases || 0) + '</div></div>' +
            '<div class="admin-eval-summary-item"><div class="label">平均分</div><div class="value">' + (summary.average_score != null ? summary.average_score.toFixed(1) : '—') + '</div></div>' +
            '<div class="admin-eval-summary-item"><div class="label">通过数</div><div class="value admin-eval-pass">' + (summary.pass_count || 0) + '</div></div>' +
            '<div class="admin-eval-summary-item"><div class="label">通过率</div><div class="value ' + ((summary.pass_rate || 0) >= 0.7 ? 'admin-eval-pass' : 'admin-eval-fail') + '">' + (summary.pass_rate != null ? (summary.pass_rate * 100).toFixed(1) + '%' : '—') + '</div></div>';

        var manifest = data.manifest || {};
        var coverage = manifest.profile_coverage || {};
        document.getElementById('profile-coverage').innerHTML =
            '<strong>实验覆盖：</strong>' +
            Object.keys(coverage).map(function (k) {
                return escHtml(k) + ' (' + coverage[k] + ')';
            }).join(' &nbsp;|&nbsp; ');

        var scores = data.scores || [];
        document.getElementById('score-rows').innerHTML = scores.map(function (row, i) {
            var passed = row.passed ? '<span class="admin-eval-pass"><i class="fas fa-check"></i> 通过</span>'
                                    : '<span class="admin-eval-fail"><i class="fas fa-times"></i> 未通过</span>';
            var bars = renderScoreBars(row.dimension_scores || {});
            var issues = renderIssues(row);
            return '<tr>' +
                '<td>' + escHtml(row.case_id || '#' + (i + 1)) + '</td>' +
                '<td style="font-size:0.82em;">' + escHtml(row.experiment_key || '—') + '</td>' +
                '<td><strong>' + (row.total_score != null ? row.total_score.toFixed(1) : '—') + '</strong></td>' +
                '<td>' + passed + '</td>' +
                '<td>' + bars + '</td>' +
                '<td>' + issues + '</td>' +
                '</tr>';
        }).join('');

        document.getElementById('download-summary-btn').onclick = function () {
            downloadJson('eval_score_summary.json', data.summary);
        };
        document.getElementById('download-scores-btn').onclick = function () {
            downloadJson('eval_scores.json', data.scores);
        };
    }

    function renderScoreBars(dims) {
        var keys = Object.keys(dims).sort();
        if (keys.length === 0) return '—';
        return '<div class="admin-eval-bar-group">' +
            keys.map(function (k) {
                var pct = Math.round((dims[k] || 0) * 100);
                return '<div class="admin-eval-bar-row">' +
                    '<span>' + escHtml(k) + '</span>' +
                    '<div class="admin-eval-bar-track"><div class="admin-eval-bar-fill" style="width:' + pct + '%;"></div></div>' +
                    '<span>' + pct + '</span></div>';
            }).join('') + '</div>';
    }

    function renderIssues(row) {
        var issues = row.issues || [];
        if (issues.length === 0) return '<span class="admin-eval-issue-ok"><i class="fas fa-check-circle"></i> 无</span>';
        return '<div style="display:flex;flex-direction:column;gap:4px;">' +
            issues.map(function (iss) {
                var cls = iss.severity === 'hard' ? 'hard' : 'soft';
                return '<span class="admin-eval-issue-chip ' + cls + '">' + escHtml(iss.message || iss) + '</span>';
            }).join('') + '</div>';
    }

    function downloadJson(filename, data) {
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async function loadProfiles() {
        try {
            var data = await adminApi('/api/admin/evaluation/profiles');
            var profiles = data.profiles || [];
            var el = document.getElementById('supported-profiles');
            if (profiles.length === 0) {
                el.innerHTML = '<span style="color:#9E9E9E;">暂无配置</span>';
                return;
            }
            el.innerHTML = profiles.map(function (p) {
                return '<div class="admin-eval-profile-item">' +
                    '<div class="k">' + escHtml(p.key) + '</div>' +
                    '<div class="n">' + escHtml(p.name) + '</div></div>';
            }).join('');
        } catch (e) {
            document.getElementById('supported-profiles').innerHTML =
                '<span style="color:#C62828;">加载失败: ' + escHtml(e.message) + '</span>';
        }
    }
})();
