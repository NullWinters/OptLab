/**
 * 两阶段法交互实验 JavaScript
 */

document.addEventListener('DOMContentLoaded', function () {
    // DOM 元素
    const numVarsInput = document.getElementById('num-vars');
    const numConstraintsInput = document.getElementById('num-constraints');
    const coeffTableContainer = document.getElementById('coeff-table-container');
    const solveBtn = document.getElementById('solve-btn');
    const resetBtn = document.getElementById('reset-btn');
    const checkBtn = document.getElementById('check-btn');
    const exampleSelect = document.getElementById('example-select');
    const loadExampleBtn = document.getElementById('load-example-btn');
    const placeholder = document.getElementById('two-phase-placeholder');
    const phase1Panel = document.getElementById('phase1-panel');
    const phase2Panel = document.getElementById('phase2-panel');
    const phase1Status = document.getElementById('phase1-status');
    const phase2Status = document.getElementById('phase2-status');
    const phase1Container = document.getElementById('phase1-iteration-cards');
    const phase2Container = document.getElementById('phase2-iteration-cards');
    const phase1Conclusion = document.getElementById('phase1-conclusion');
    const phase2Conclusion = document.getElementById('phase2-conclusion');

    // 实验数据面板（查看/导出/保存）
    const twoPhaseLogOpenBtn = document.getElementById('two-phase-log-open-btn');
    const twoPhaseLogExportJsonBtn = document.getElementById('two-phase-log-export-json-btn');
    const twoPhaseLogSaveToProfileBtn = document.getElementById('two-phase-log-save-to-profile-btn');
    const twoPhaseLogModal = document.getElementById('two-phase-log-modal');
    const twoPhaseLogCloseBtn = document.getElementById('two-phase-log-close');
    const twoPhaseLogSummary = document.getElementById('two-phase-log-summary');
    const twoPhaseLogBody = document.getElementById('two-phase-log-body');

    // 示例数据（等式约束）
    const examples = {
        'max': {
            n: 3, m: 2, type: 'max',
            c: [1, 1, 3],
            a: [[1, 0, 1], [0, 1, 1]],
            b: [1, 2]
        },
        'min': {
            n: 4, m: 2, type: 'min',
            c: [2, -1, -1, 0],
            a: [[3, 1, 0, 1], [6, 2, 1, 1]],
            b: [4, 5]
        },
        'infeasible': {
            n: 2, m: 2, type: 'max',
            c: [1, 1],
            a: [[1, 1], [1, 1]],
            b: [2, 3]
        },
        'degenerate': {
            n: 2, m: 2, type: 'max',
            c: [1, 2],
            a: [[1, 1], [0, 1]],
            b: [2, 0]
        },
        'unbounded': {
            n: 2, m: 1, type: 'max',
            c: [1, 1],
            a: [[1, -1]],
            b: [0]
        }
    };

    let lastRunRecord = null;

    const twoPhaseEventBuffer = [];
    const MAX_TWO_PHASE_EVENTS = 300;

    function pushTwoPhaseEvent(type, data) {
        twoPhaseEventBuffer.push({
            t: new Date().toISOString(),
            type: type,
            data: data || null
        });
        if (twoPhaseEventBuffer.length > MAX_TWO_PHASE_EVENTS) {
            twoPhaseEventBuffer.shift();
        }
    }

    function getTwoPhaseStatusLabel(phase, status, finalW, finalZ) {
        if (phase === 1) {
            if (status === 'optimal') {
                if (typeof finalW === 'number' && Math.abs(finalW) <= 1e-10) return '已完成（找到可行解，w=0）';
                if (typeof finalW === 'number') return `已终止（无可行解，w=${finalW.toFixed(4)}）`;
                return '已完成（第一阶段达到最优）';
            }
            if (status === 'unbounded') return '已终止（辅助问题无界）';
            if (status === 'cycle') return '已终止（检测到循环）';
            if (status === 'max_iter') return '已终止（达到最大迭代次数）';
            return '迭代进行中';
        }

        // phase === 2
        if (status === 'optimal') return `已完成（达到最优，Z=${typeof finalZ === 'number' ? finalZ.toFixed(4) : '--'}）`;
        if (status === 'unbounded') return '已终止（原问题无界）';
        if (status === 'cycle') return '已终止（检测到循环）';
        if (status === 'max_iter') return '已终止（达到最大迭代次数）';
        return '迭代进行中';
    }

    function createTwoPhaseRecordPayload() {
        if (!lastRunRecord) return null;

        const phase1Steps = lastRunRecord.phase1 && Array.isArray(lastRunRecord.phase1.steps)
            ? lastRunRecord.phase1.steps
            : [];
        const phase2Steps = lastRunRecord.phase2 && Array.isArray(lastRunRecord.phase2.steps)
            ? lastRunRecord.phase2.steps
            : [];

        if (!phase1Steps.length && !phase2Steps.length) return null;

        const phase1FinalW = lastRunRecord.phase1 ? lastRunRecord.phase1.finalW : null;
        const phase2FinalZ = lastRunRecord.phase2 ? lastRunRecord.phase2.finalObjectiveValue : null;

        function mapStep(step) {
            const obj = {
                iteration: step.iteration,
                phase: step.phase,
                status: step.status,
                entering: step.entering,
                leaving: step.leaving,
                basis: step.basis,
                cB: step.cB,
                b: step.b,
                sigma: step.sigma,
                theta: step.theta,
                wValue: step.wValue
            };
            obj.tableau = {
                cj: step.cj,
                a: step.a,
                b: step.b,
                cB: step.cB,
                basis: step.basis,
                sigma: step.sigma,
                theta: step.theta
            };
            return obj;
        }

        const phase1_iteration_data = phase1Steps.map(mapStep);
        const phase2_iteration_data = phase2Steps.map(mapStep);

        return {
            algorithm_name: '两阶段法',
            test_function: lastRunRecord.solveType === 'max' ? 'Max Z' : 'Min Z',
            initial_state: {
                n: lastRunRecord.n,
                m: lastRunRecord.m,
                solve_type: lastRunRecord.solveType,
                objective_coeffs: lastRunRecord.objective || [],
                constraints: lastRunRecord.constraints || []
            },
            phase1_result: {
                status: lastRunRecord.phase1 ? lastRunRecord.phase1.status : null,
                status_label: getTwoPhaseStatusLabel(
                    1,
                    lastRunRecord.phase1 ? lastRunRecord.phase1.status : null,
                    phase1FinalW,
                    null
                ),
                final_w: phase1FinalW
            },
            phase2_result: {
                status: lastRunRecord.phase2 ? lastRunRecord.phase2.status : null,
                status_label: getTwoPhaseStatusLabel(
                    2,
                    lastRunRecord.phase2 ? lastRunRecord.phase2.status : null,
                    null,
                    phase2FinalZ
                ),
                final_objective_value: phase2FinalZ
            },
            phase1_iteration_data: phase1_iteration_data,
            phase2_iteration_data: phase2_iteration_data,
            iteration_data: phase1_iteration_data.concat(phase2_iteration_data)
        };
    }

    function updateTwoPhaseExperimentData(extra) {
        const payload = createTwoPhaseRecordPayload();
        window.TwoPhaseExperimentData = Object.assign({}, window.TwoPhaseExperimentData || {}, {
            page: 'linear-programming.two_phase',
            lastUpdatedAt: new Date().toISOString(),
            lastRunRecord: lastRunRecord,
            latestPayload: payload,
            tableauSteps: payload && Array.isArray(payload.iteration_data) ? payload.iteration_data : [],
            operationEvents: twoPhaseEventBuffer.slice()
        }, extra || {});
    }

    function formatCellNumber(value, digits) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return n.toFixed(typeof digits === 'number' ? digits : 4);
    }

    function buildTableauDetailHtml(tableau) {
        if (!tableau || !Array.isArray(tableau.a) || !Array.isArray(tableau.cj)) {
            return '<div class="simplex-tableau-empty">无可用矩阵数据</div>';
        }

        const header = ['cB', 'Basis', 'b']
            .concat(tableau.cj.map(function (_, idx) {
                return 'x' + (idx + 1);
            }))
            .concat(['θ']);

        const bArr = Array.isArray(tableau.b) ? tableau.b : [];
        const cBArr = Array.isArray(tableau.cB) ? tableau.cB : [];
        const basisArr = Array.isArray(tableau.basis) ? tableau.basis : [];
        const thetaArr = Array.isArray(tableau.theta) ? tableau.theta : [];
        const sigmaArr = Array.isArray(tableau.sigma) ? tableau.sigma : [];

        let html = '<div class="simplex-tableau-wrap"><table class="simplex-tableau-table"><thead><tr>';
        header.forEach(function (h) {
            html += '<th>' + h + '</th>';
        });
        html += '</tr></thead><tbody>';

        tableau.a.forEach(function (row, rowIdx) {
            html += '<tr>' +
                '<td>' + formatCellNumber(cBArr[rowIdx], 4) + '</td>' +
                '<td>' + (basisArr[rowIdx] || '--') + '</td>' +
                '<td>' + formatCellNumber(bArr[rowIdx], 4) + '</td>';

            for (let j = 0; j < tableau.cj.length; j++) {
                html += '<td>' + formatCellNumber(row[j], 4) + '</td>';
            }

            const thetaVal = thetaArr[rowIdx] == null ? '—' : formatCellNumber(thetaArr[rowIdx], 4);
            html += '<td>' + thetaVal + '</td></tr>';
        });

        html += '<tr class="sigma-row">' +
            '<td>σj</td><td></td><td></td>';

        for (let j = 0; j < tableau.cj.length; j++) {
            html += '<td>' + formatCellNumber(sigmaArr[j], 4) + '</td>';
        }
        html += '<td></td></tr>';

        html += '</tbody></table></div>';
        return html;
    }

    function bindTwoPhaseTableauExpandEvents() {
        if (!twoPhaseLogBody) return;
        twoPhaseLogBody.querySelectorAll('.simplex-expand-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const step = btn.getAttribute('data-step');
                const detailRow = twoPhaseLogBody.querySelector('tr[data-detail-row="' + step + '"]');
                if (!detailRow) return;
                const expanded = detailRow.classList.toggle('hidden');
                btn.textContent = expanded ? '展开完整 tableau' : '收起 tableau';
            });
        });
    }

    function openTwoPhaseLogModal() {
        const payload = createTwoPhaseRecordPayload();
        if (!payload) {
            alert('当前尚无实验数据，请先运行一次两阶段法求解。');
            return;
        }

        pushTwoPhaseEvent('open_log_modal', {
            phase1_steps: payload.phase1_iteration_data.length,
            phase2_steps: payload.phase2_iteration_data.length
        });

        if (twoPhaseLogSummary) {
            twoPhaseLogSummary.innerHTML =
                '<div>求解类型：' + (lastRunRecord.solveType === 'max' ? '最大化' : '最小化') + '</div>' +
                '<div>规模：n = ' + lastRunRecord.n + '，m = ' + lastRunRecord.m + '</div>' +
                '<div>第一阶段：' + payload.phase1_result.status_label + '</div>' +
                '<div>第二阶段：' + payload.phase2_result.status_label + '</div>' +
                '<div>迭代步数：' + payload.iteration_data.length + '</div>';
        }

        if (twoPhaseLogBody) {
            twoPhaseLogBody.innerHTML = payload.iteration_data.map(function (row) {
                const phase = row.phase;
                const statusLabel = getTwoPhaseStatusLabel(
                    phase,
                    row.status,
                    phase === 1 ? row.wValue : null,
                    phase === 2 ? null : null
                );
                const basisText = Array.isArray(row.basis) ? row.basis.join(', ') : '--';
                const bText = Array.isArray(row.b) ? row.b.map(function (v) {
                    return Number(v).toFixed(4);
                }).join(', ') : '--';
                const targetText = phase === 1
                    ? (typeof row.wValue === 'number' ? row.wValue.toFixed(4) : '--')
                    : (Array.isArray(row.cB) && Array.isArray(row.b)
                        ? row.cB.reduce(function (sum, cb, i) {
                            return sum + cb * row.b[i];
                        }, 0).toFixed(4)
                        : '--');

                const stepKey = 'p' + phase + '-' + row.iteration;
                const detailHtml = buildTableauDetailHtml(row.tableau);

                return '<tr>' +
                    '<td>' + phase + '</td>' +
                    '<td>' + row.iteration + '</td>' +
                    '<td>' + (row.entering || '—') + '</td>' +
                    '<td>' + (row.leaving || '—') + '</td>' +
                    '<td>' + statusLabel + '</td>' +
                    '<td>' + basisText + '</td>' +
                    '<td>' + bText + '</td>' +
                    '<td>' + targetText + '</td>' +
                    '<td><button type="button" class="simplex-expand-btn" data-step="' + stepKey + '">展开完整 tableau</button></td>' +
                    '</tr>' +
                    '<tr class="hidden" data-detail-row="' + stepKey + '">' +
                    '<td colspan="9">' + detailHtml + '</td>' +
                    '</tr>';
            }).join('');
            bindTwoPhaseTableauExpandEvents();
        }

        if (twoPhaseLogModal) twoPhaseLogModal.classList.remove('hidden');
    }

    function closeTwoPhaseLogModal() {
        if (!twoPhaseLogModal) return;
        twoPhaseLogModal.classList.add('hidden');
    }

    function exportTwoPhaseLogAsJson() {
        const payload = createTwoPhaseRecordPayload();
        if (!payload) {
            alert('当前尚无实验数据，请先运行一次两阶段法求解。');
            return;
        }
        pushTwoPhaseEvent('export_json', {
            phase1_steps: payload.phase1_iteration_data.length,
            phase2_steps: payload.phase2_iteration_data.length
        });

        function compactNums(arr) {
            return (Array.isArray(arr) ? arr : []).map(function (v) {
                return Number(v).toFixed(4);
            }).join(', ');
        }

        function compactConstraints(items) {
            return (Array.isArray(items) ? items : []).map(function (it, idx) {
                return '约束' + (idx + 1) + ': [' + compactNums(it.coeffs) + '] = ' + Number(it.b).toFixed(4);
            });
        }

        const L = {
            FILE_INFO: '文件说明',
            NAME: '名称',
            TIME: '导出时间',
            PAGE: '页面',
            REMARK: '备注',
            OVERVIEW: '实验概览',
            ALGO: '算法',
            TYPE: '求解类型',
            SCALE: '规模',
            P1_STATUS: '第一阶段状态',
            P2_STATUS: '第二阶段状态',
            INPUT: '输入数据',
            OBJ_COEFF: '目标函数系数',
            CONSTRAINTS: '约束条件',
            P1_SUMMARY: '第一阶段迭代摘要',
            ITER: '迭代',
            STATUS: '状态',
            ENTERING: '入基变量',
            LEAVING: '离基变量',
            BASIS: '基变量',
            W_VALUE: '当前辅助目标w',
            P2_SUMMARY: '第二阶段迭代摘要',
            Z_VALUE: '当前目标值Z'
        };

        const pretty = {
            [L.FILE_INFO]: {
                [L.NAME]: '线性规划-两阶段法实验记录',
                [L.TIME]: new Date().toLocaleString('zh-CN', {hour12: false}),
                [L.PAGE]: 'linear-programming.two_phase',
                [L.REMARK]: '按“第一阶段-迭代摘要-逐步tableau(紧凑)-第二阶段-迭代摘要-逐步tableau(紧凑)”组织，便于阅读与复现实验。'
            },
            [L.OVERVIEW]: {
                [L.ALGO]: payload.algorithm_name,
                [L.TYPE]: payload.initial_state.solve_type === 'max' ? '最大化' : '最小化',
                [L.SCALE]: 'n=' + payload.initial_state.n + ', m=' + payload.initial_state.m,
                [L.P1_STATUS]: payload.phase1_result.status_label,
                [L.P2_STATUS]: payload.phase2_result.status_label
            },
            [L.INPUT]: {
                [L.OBJ_COEFF]: '[' + compactNums(payload.initial_state.objective_coeffs) + ']',
                [L.CONSTRAINTS]: compactConstraints(payload.initial_state.constraints)
            },
            [L.P1_SUMMARY]: payload.phase1_iteration_data.map(function (it) {
                return {
                    [L.ITER]: it.iteration,
                    [L.STATUS]: it.status,
                    [L.ENTERING]: it.entering || '—',
                    [L.LEAVING]: it.leaving || '—',
                    [L.BASIS]: (it.basis || []).join(', '),
                    [L.W_VALUE]: typeof it.wValue === 'number' ? it.wValue.toFixed(4) : '—'
                };
            }),
            [L.P2_SUMMARY]: payload.phase2_iteration_data.map(function (it) {
                const z = (Array.isArray(it.cB) && Array.isArray(it.b))
                    ? it.cB.reduce(function (sum, cb, i) {
                        return sum + cb * it.b[i];
                    }, 0)
                    : null;
                return {
                    [L.ITER]: it.iteration,
                    [L.STATUS]: it.status,
                    [L.ENTERING]: it.entering || '—',
                    [L.LEAVING]: it.leaving || '—',
                    [L.BASIS]: (it.basis || []).join(', '),
                    [L.Z_VALUE]: typeof z === 'number' ? z.toFixed(4) : '—'
                };
            })
        };

        const jsonText = JSON.stringify(pretty, null, 2);
        const blob = new Blob([jsonText], {type: 'application/json;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'linear-programming.two_phase-实验迭代数据.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function saveTwoPhaseLogToProfile() {
        const payload = createTwoPhaseRecordPayload();
        if (!payload) {
            alert('当前尚无实验数据，请先运行一次两阶段法求解。');
            return;
        }
        pushTwoPhaseEvent('save_to_profile_click', {
            steps: payload.iteration_data.length
        });

        if (typeof apiPost !== 'function' || typeof getStoredToken !== 'function' || !getStoredToken()) {
            if (window.LoginModal && typeof window.LoginModal.open === 'function') {
                window.LoginModal.open({mode: 'login', notice: '请先登录后再保存至个人中心。'});
            } else {
                alert('请先登录后再保存至个人中心。');
            }
            return;
        }

        const defaultAlias = (window.RecordSaveModal && typeof window.RecordSaveModal.makeDefaultAlias === 'function')
            ? window.RecordSaveModal.makeDefaultAlias('TWO_PHASE')
            : ('TWO_PHASE-' + new Date().toISOString().slice(0, 16).replace('T', ' '));

        if (window.RecordSaveModal && typeof window.RecordSaveModal.open === 'function') {
            window.RecordSaveModal.open({
                title: '保存至个人中心',
                subtitle: '两阶段法交互实验记录将保存到你的个人中心',
                aliasPrefix: 'TWO_PHASE',
                defaultAlias,
                onConfirm: function (alias) {
                    pushTwoPhaseEvent('save_to_profile_confirm', {alias: String(alias || '').trim()});
                    return apiPost('/experiments/records', {
                        alias: String(alias).trim(),
                        source_page: 'linear-programming.two_phase',
                        payload: payload
                    });
                }
            });
        } else {
            alert('保存弹窗未加载，请刷新页面后重试。');
        }
    }

    // 初始化
    generateCoeffTable();
    updateTwoPhaseExperimentData({reason: 'init'});

    // 事件监听
    numVarsInput.addEventListener('change', generateCoeffTable);
    numConstraintsInput.addEventListener('change', handleConstraintCountChange);
    resetBtn.addEventListener('click', resetForm);
    checkBtn.addEventListener('click', validateInputs);
    solveBtn.addEventListener('click', solveTwoPhase);
    loadExampleBtn.addEventListener('click', loadExample);

    if (twoPhaseLogOpenBtn) twoPhaseLogOpenBtn.addEventListener('click', openTwoPhaseLogModal);
    if (twoPhaseLogExportJsonBtn) twoPhaseLogExportJsonBtn.addEventListener('click', exportTwoPhaseLogAsJson);
    if (twoPhaseLogSaveToProfileBtn) twoPhaseLogSaveToProfileBtn.addEventListener('click', saveTwoPhaseLogToProfile);
    if (twoPhaseLogCloseBtn) twoPhaseLogCloseBtn.addEventListener('click', closeTwoPhaseLogModal);
    if (twoPhaseLogModal) {
        twoPhaseLogModal.addEventListener('click', function (e) {
            if (e.target === twoPhaseLogModal) closeTwoPhaseLogModal();
        });
    }

    function handleConstraintCountChange() {
        const m = parseInt(numConstraintsInput.value);
        if (m > 10) {
            numConstraintsInput.value = 10;
            showConstraintLimitWarning();
        }
        generateCoeffTable();
    }

    function showConstraintLimitWarning() {
        const existingWarning = document.querySelector('.constraint-limit-warning');
        if (existingWarning) existingWarning.remove();

        const warning = document.createElement('div');
        warning.className = 'constraint-limit-warning';
        warning.textContent = '已达到最大约束数量 (10条)';
        document.body.appendChild(warning);

        setTimeout(() => {
            warning.remove();
        }, 5000);
    }

    function loadExample() {
        const selected = exampleSelect.value;
        const data = examples[selected];
        if (!data) return;

        numVarsInput.value = data.n;
        numConstraintsInput.value = Math.min(data.m, 10);
        document.querySelector(`input[name="solve-type"][value="${data.type}"]`).checked = true;

        generateCoeffTable();

        // 填充系数
        data.c.forEach((val, j) => {
            const input = document.getElementById(`c-${j + 1}`);
            if (input) input.value = val;
        });

        data.a.forEach((row, i) => {
            row.forEach((val, j) => {
                const input = document.getElementById(`a-${i + 1}-${j + 1}`);
                if (input) input.value = val;
            });
            const bInput = document.getElementById(`b-${i + 1}`);
            if (bInput) bInput.value = data.b[i];
        });

        resetResults();

        // 系数表行数变化会引起像素级高度差，使用两次 requestAnimationFrame
        // 确保布局完成后再同步（避免拿到过渡中的高度）。
        (window.requestAnimationFrame || function (cb) {
            return setTimeout(cb, 0);
        })(function () {
            syncResultAreaHeight();
            (window.requestAnimationFrame || function (cb) {
                return setTimeout(cb, 0);
            })(function () {
                syncResultAreaHeight();
            });
        });
    }

    function generateCoeffTable() {
        const n = parseInt(numVarsInput.value);
        const m = parseInt(numConstraintsInput.value);

        let html = '<table class="input-table">';

        // 表头
        html += '<thead><tr><th></th>';
        for (let j = 1; j <= n; j++) {
            html += `<th>x<sub>${j}</sub></th>`;
        }
        html += '<th>b</th></tr></thead>';

        // 目标函数行
        html += '<tbody><tr><td><strong>目标</strong></td>';
        for (let j = 1; j <= n; j++) {
            html += `<td><input type="number" step="any" id="c-${j}" value="0"></td>`;
        }
        html += '<td class="empty-cell"></td></tr>';

        // 约束条件行
        for (let i = 1; i <= m; i++) {
            html += `<tr><td><strong>约束${i}</strong></td>`;
            for (let j = 1; j <= n; j++) {
                html += `<td><input type="number" step="any" id="a-${i}-${j}" value="0"></td>`;
            }
            html += `<td><input type="number" step="any" id="b-${i}" value="0"></td></tr>`;
        }

        html += '</tbody></table>';
        coeffTableContainer.innerHTML = html;
    }

    function resetForm() {
        numVarsInput.value = 3;
        numConstraintsInput.value = 3;
        document.querySelector('input[name="solve-type"][value="max"]').checked = true;
        exampleSelect.value = 'max';
        generateCoeffTable();
        resetResults();
    }

    function resetResults() {
        placeholder.classList.remove('hidden');
        phase1Panel.classList.add('hidden');
        phase2Panel.classList.add('hidden');
        phase1Panel.removeAttribute('disabled');
        phase2Panel.setAttribute('disabled', 'true');
        phase1Container.innerHTML = '';
        phase2Container.innerHTML = '';
        phase1Conclusion.classList.add('hidden');
        phase2Conclusion.classList.add('hidden');
        updatePhaseStatus(1, 'pending');
        updatePhaseStatus(2, 'pending');

        lastRunRecord = null;
        twoPhaseEventBuffer.length = 0;
        updateTwoPhaseExperimentData({reason: 'reset_results'});

        (window.requestAnimationFrame || function (cb) {
            return setTimeout(cb, 0);
        })(function () {
            syncResultAreaHeight();
            (window.requestAnimationFrame || function (cb) {
                return setTimeout(cb, 0);
            })(function () {
                syncResultAreaHeight();
            });
        });
    }

    function updatePhaseStatus(phase, status) {
        const statusEl = phase === 1 ? phase1Status : phase2Status;
        const statusMap = {
            'pending': {text: phase === 1 ? '等待求解' : '未开始', class: 'pending'},
            'running': {text: '计算中...', class: 'running'},
            'success': {text: '已完成', class: 'success'},
            'infeasible': {text: '无可行解', class: 'infeasible'},
            'unbounded': {text: '无界', class: 'unbounded'},
            'cycle': {text: '检测到循环', class: 'cycle'}
        };

        const info = statusMap[status] || statusMap['pending'];
        statusEl.textContent = info.text;
        statusEl.className = 'phase-status-badge ' + info.class;
    }

    function validateInputs() {
        const n = parseInt(numVarsInput.value);
        const m = parseInt(numConstraintsInput.value);

        const inputs = coeffTableContainer.querySelectorAll('input[type="number"]');
        for (let input of inputs) {
            if (input.value === "" || isNaN(parseFloat(input.value))) {
                alert("请确保所有单元格都填写了有效的数字。");
                input.focus();
                return false;
            }
        }

        for (let i = 1; i <= m; i++) {
            const bVal = parseFloat(document.getElementById(`b-${i}`).value);
            if (bVal < 0) {
                alert(`约束 ${i} 的右端项 (b) 必须是非负数。`);
                document.getElementById(`b-${i}`).focus();
                return false;
            }
        }

        alert("输入验证通过！");
        return true;
    }

    function solveTwoPhase() {
        if (!validateInputs()) return;

        // 获取输入
        const n = parseInt(numVarsInput.value);
        const m = parseInt(numConstraintsInput.value);
        const solveType = document.querySelector('input[name="solve-type"]:checked').value;
        pushTwoPhaseEvent('solve_start', {n: n, m: m, solve_type: solveType});

        // 读取系数
        const c = [];
        for (let j = 1; j <= n; j++) {
            c.push(parseFloat(document.getElementById(`c-${j}`).value));
        }

        const a = [];
        const b = [];
        for (let i = 1; i <= m; i++) {
            const row = [];
            for (let j = 1; j <= n; j++) {
                row.push(parseFloat(document.getElementById(`a-${i}-${j}`).value));
            }
            a.push(row);
            b.push(parseFloat(document.getElementById(`b-${i}`).value));
        }

        const objective = c;
        const constraints = a.map(function (row, idx) {
            return {coeffs: row, b: b[idx]};
        });

        // 显示面板
        placeholder.classList.add('hidden');
        phase1Panel.classList.remove('hidden');
        updatePhaseStatus(1, 'running');

        // ========== 第一阶段 ==========
        // 构造 Phase I 初始表: min w = sum(人工变量)
        const totalVarsPhase1 = n + m;
        const artificialIndices = [];

        const cjPhase1 = new Array(totalVarsPhase1).fill(0);
        for (let i = 0; i < m; i++) {
            cjPhase1[n + i] = 1;
            artificialIndices.push(n + i);
        }

        const basisPhase1 = [];
        const cBPhase1 = [];
        for (let i = 0; i < m; i++) {
            basisPhase1.push(`x${n + i + 1}`);
            cBPhase1.push(1);
        }

        const APhase1 = a.map((row, i) => {
            const artificialPart = new Array(m).fill(0);
            artificialPart[i] = 1;
            return [...row, ...artificialPart];
        });

        const phase1Result = LPCore.iterateSimplex({
            cj: cjPhase1,
            basis: basisPhase1,
            cB: cBPhase1,
            A: APhase1,
            b: [...b],
            solveType: 'min',
            phase: 1,
            maxIterations: 1000,
            artificialIndices: artificialIndices,
            n: n
        });

        renderPhaseResults(1, phase1Result);

        const remainingArtificial = LPCore.getRemainingArtificialVars(
            phase1Result.finalBasis, artificialIndices
        );

        if (phase1Result.cycleDetected) {
            updatePhaseStatus(1, 'cycle');
            phase1Conclusion.innerHTML = `
                <div class="alert alert-warning">
                    <strong>第一阶段结论：</strong> 检测到循环（基变量组合重复出现），计算终止。
                </div>
            `;
            phase1Conclusion.classList.remove('hidden');
            lastRunRecord = {
                n: n,
                m: m,
                solveType: solveType,
                objective: objective,
                constraints: constraints,
                phase1: phase1Result,
                phase2: null
            };
            updateTwoPhaseExperimentData({reason: 'phase1_cycle'});
            pushTwoPhaseEvent('solve_complete', {stage: 'phase1', status: 'cycle'});
            return;
        }

        if (Math.abs(phase1Result.finalW) > 1e-10) {
            updatePhaseStatus(1, 'infeasible');
            phase1Conclusion.innerHTML = `
                <div class="alert alert-danger">
                    <strong>第一阶段结论：</strong> 辅助问题最优值 w = ${phase1Result.finalW.toFixed(4)} > 0，
                    原问题<strong>无可行解</strong>。
                </div>
            `;
            phase1Conclusion.classList.remove('hidden');
            lastRunRecord = {
                n: n,
                m: m,
                solveType: solveType,
                objective: objective,
                constraints: constraints,
                phase1: phase1Result,
                phase2: null
            };
            updateTwoPhaseExperimentData({reason: 'phase1_infeasible'});
            pushTwoPhaseEvent('solve_complete', {stage: 'phase1', status: 'infeasible'});
            return;
        }

        updatePhaseStatus(1, 'success');
        phase1Conclusion.innerHTML = `
            <div class="alert alert-success">
                <strong>第一阶段结论：</strong> 辅助问题最优值 w = 0，找到初始基可行解，进入第二阶段。
            </div>
        `;
        phase1Conclusion.classList.remove('hidden');

        // Phase II 之前先暴露 Phase I 数据（若用户立即生成笔记，也能获得完整输入）
        lastRunRecord = {
            n: n,
            m: m,
            solveType: solveType,
            objective: objective,
            constraints: constraints,
            phase1: phase1Result,
            phase2: null
        };
        updateTwoPhaseExperimentData({reason: 'phase1_success'});

        // ========== 第二阶段 ==========
        phase2Panel.classList.remove('hidden');
        phase2Panel.removeAttribute('disabled');
        phase2Panel.open = true;
        updatePhaseStatus(2, 'running');

        const {A: APhase2, b: bPhase2, basis: basisPhase2, cB: cBPhase2} =
            LPCore.preparePhase2(phase1Result, artificialIndices, n, c);

        const phase2Result = LPCore.iterateSimplex({
            cj: [...c],
            basis: basisPhase2,
            cB: cBPhase2,
            A: APhase2,
            b: bPhase2,
            solveType: solveType,
            phase: 2,
            maxIterations: 1000,
            n: n
        });

        renderPhaseResults(2, phase2Result);

        if (phase2Result.cycleDetected) {
            updatePhaseStatus(2, 'cycle');
            phase2Conclusion.innerHTML = `
                <div class="alert alert-warning">
                    <strong>第二阶段结论：</strong> 检测到循环（基变量组合重复出现）。
                </div>
            `;
        } else if (phase2Result.status === 'unbounded') {
            updatePhaseStatus(2, 'unbounded');
            phase2Conclusion.innerHTML = `
                <div class="alert alert-danger">
                    <strong>第二阶段结论：</strong> 原问题<strong>无界</strong>。
                </div>
            `;
        } else if (phase2Result.status === 'optimal') {
            updatePhaseStatus(2, 'success');
            const finalZ = phase2Result.finalObjectiveValue;
            phase2Conclusion.innerHTML = `
                <div class="alert alert-success">
                    <strong>求解成功！</strong> 第二阶段找到最优解。
                    最优目标函数值 Z = ${finalZ.toFixed(4)}
                </div>
            `;
        } else {
            updatePhaseStatus(2, 'pending');
            phase2Conclusion.innerHTML = `
                <div class="alert alert-warning">
                    <strong>求解终止：</strong> 达到最大迭代次数。
                </div>
            `;
        }
        phase2Conclusion.classList.remove('hidden');

        lastRunRecord = {
            n: n,
            m: m,
            solveType: solveType,
            objective: objective,
            constraints: constraints,
            phase1: phase1Result,
            phase2: phase2Result
        };

        updateTwoPhaseExperimentData({reason: 'solve_complete'});
        pushTwoPhaseEvent('solve_complete', {stage: 'phase2', status: phase2Result.status});
    }

    function renderPhaseResults(phase, result) {
        const container = phase === 1 ? phase1Container : phase2Container;
        const solveType = document.querySelector('input[name="solve-type"]:checked').value;

        container.innerHTML = '';

        if (!result || !result.steps || result.steps.length === 0) {
            container.innerHTML = '<p>无迭代数据</p>';
            return;
        }

        result.steps.forEach((step) => {
            const card = document.createElement('div');
            card.className = `iteration-card phase-${phase}`;

            let title = `第 ${step.iteration} 次迭代`;
            if (step.status === 'optimal') title += " (达到最优)";
            if (step.status === 'unbounded') title += " (检测到无界)";
            if (step.status === 'cycle') title += " (检测到循环)";

            card.innerHTML = `<h4>${title}</h4>`;

            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'table-wrapper';
            const svg = d3.select(tableWrapper).append('svg')
                .attr('class', 'simplex-svg');

            LPCore.renderSimplexTable(svg, step);
            card.appendChild(tableWrapper);

            const explanation = document.createElement('div');
            explanation.className = 'explanation';

            if (phase === 1 && step.wValue !== null) {
                explanation.innerHTML = LPCore.generateExplanation(step, 'min') +
                    `<br><strong>当前辅助目标值：</strong> w = ${step.wValue.toFixed(4)}`;
            } else {
                explanation.innerHTML = LPCore.generateExplanation(step, solveType);
            }
            card.appendChild(explanation);

            const isDegenerate = step.b.some(val => Math.abs(val) < 1e-10);
            if (isDegenerate && step.status === 'iterating') {
                const alert = document.createElement('div');
                alert.className = 'alert alert-warning';
                alert.innerText = "提示：当前存在取值为 0 的基变量，解是退化的。";
                card.appendChild(alert);
            }

            container.appendChild(card);
        });

        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([container]).catch((err) =>
                console.log('MathJax typeset failed: ' + err.message)
            );
        }

        (window.requestAnimationFrame || function (cb) {
            return setTimeout(cb, 0);
        })(function () {
            syncResultAreaHeight();
            (window.requestAnimationFrame || function (cb) {
                return setTimeout(cb, 0);
            })(function () {
                syncResultAreaHeight();
            });
        });

    }

    // ========== 结果区域高度同步逻辑 (对齐左侧面板) ==========
    const leftColumn = document.querySelector('.left-column');
    const resultArea = document.querySelector('.result-area');

    function syncResultAreaHeight() {
        if (!leftColumn || !resultArea) return;

        if (window.innerWidth > 1024) {
            // 精准对齐：左侧由 input-panel + experiment-data-panel 组成，
            // 中间由 grid/flex gap 控制，直接用 leftColumn.offsetHeight 会引入像素误差。
            const inputPanel = leftColumn.querySelector('.input-panel');
            const dataPanel = leftColumn.querySelector('.experiment-data-panel');
            if (inputPanel && dataPanel) {
                const gap = 14; // two_phase.css: .left-column { gap: 14px; }
                const target = inputPanel.offsetHeight + gap + dataPanel.offsetHeight;
                resultArea.style.height = `${target}px`;
                resultArea.style.maxHeight = `${target}px`;
            } else {
                const leftHeight = leftColumn.offsetHeight;
                resultArea.style.height = `${leftHeight}px`;
                resultArea.style.maxHeight = `${leftHeight}px`;
            }
        } else {
            resultArea.style.height = 'auto';
            resultArea.style.maxHeight = 'none';
        }
    }

    // 初始化 ResizeObserver 监听左侧高度变化
    if (leftColumn && resultArea && typeof ResizeObserver !== 'undefined') {
        const resizeObserver = new ResizeObserver(() => {
            syncResultAreaHeight();
        });
        resizeObserver.observe(leftColumn);

        // 也监听窗口缩放
        window.addEventListener('resize', syncResultAreaHeight);

        // 初始同步
        syncResultAreaHeight();
    }
});
