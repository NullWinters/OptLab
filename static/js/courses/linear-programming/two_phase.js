/**
 * 两阶段法交互实验 JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
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

    // 示例数据（等式约束）
    const examples = {
        'max': {
            n: 2, m: 2, type: 'max',
            c: [3, 2],
            a: [[1, 1], [2, 1]],
            b: [4, 5]
        },
        'min': {
            n: 2, m: 2, type: 'min',
            c: [4, 3],
            a: [[1, 2], [3, 1]],
            b: [4, 6]
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

    // 初始化
    generateCoeffTable();
    
    // 事件监听
    numVarsInput.addEventListener('change', generateCoeffTable);
    numConstraintsInput.addEventListener('change', handleConstraintCountChange);
    resetBtn.addEventListener('click', resetForm);
    checkBtn.addEventListener('click', validateInputs);
    solveBtn.addEventListener('click', solveTwoPhase);
    loadExampleBtn.addEventListener('click', loadExample);

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

        setTimeout(() => { warning.remove(); }, 5000);
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
    }

    function updatePhaseStatus(phase, status) {
        const statusEl = phase === 1 ? phase1Status : phase2Status;
        const statusMap = {
            'pending': { text: phase === 1 ? '等待求解' : '未开始', class: 'pending' },
            'running': { text: '计算中...', class: 'running' },
            'success': { text: '已完成', class: 'success' },
            'infeasible': { text: '无可行解', class: 'infeasible' },
            'unbounded': { text: '无界', class: 'unbounded' },
            'cycle': { text: '检测到循环', class: 'cycle' }
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
            return;
        }

        updatePhaseStatus(1, 'success');
        phase1Conclusion.innerHTML = `
            <div class="alert alert-success">
                <strong>第一阶段结论：</strong> 辅助问题最优值 w = 0，找到初始基可行解，进入第二阶段。
            </div>
        `;
        phase1Conclusion.classList.remove('hidden');

        // ========== 第二阶段 ==========
        phase2Panel.classList.remove('hidden');
        phase2Panel.removeAttribute('disabled');
        phase2Panel.open = true;
        updatePhaseStatus(2, 'running');

        const { A: APhase2, b: bPhase2, basis: basisPhase2, cB: cBPhase2 } = 
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
            n, m, solveType,
            phase1: phase1Result,
            phase2: phase2Result
        };
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
    }

    // ========== 结果区域高度同步逻辑 (对齐左侧面板) ==========
    const leftColumn = document.querySelector('.left-column');
    const resultArea = document.querySelector('.result-area');
    
    function syncResultAreaHeight() {
        if (!leftColumn || !resultArea) return;
        
        if (window.innerWidth > 1024) {
            const leftHeight = leftColumn.offsetHeight;
            resultArea.style.height = `${leftHeight}px`;
            resultArea.style.maxHeight = `${leftHeight}px`;
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
