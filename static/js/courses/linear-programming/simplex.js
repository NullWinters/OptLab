/**
 * 单纯形法交互实验 JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM 元素
    const numVarsInput = document.getElementById('num-vars');
    const numConstraintsInput = document.getElementById('num-constraints');
    const coeffTableContainer = document.getElementById('coeff-table-container');
    const solveBtn = document.getElementById('solve-btn');
    const resetBtn = document.getElementById('reset-btn');
    const checkBtn = document.getElementById('check-btn');
    const iterationResults = document.getElementById('iteration-results');
    const viz2dContainer = document.getElementById('visualization-2d');
    const exampleSelect = document.getElementById('example-select');
    const loadExampleBtn = document.getElementById('load-example-btn');

    const examples = {
        'max': {
            n: 3,
            m: 3,
            type: 'max',
            c: [2, 5, 1],
            a: [[2, -1, 7], [1, 3, 4], [3, 6, 1]],
            b: [6, 9, 3]
        },
        'min': {
            n: 3,
            m: 3,
            type: 'min',
            c: [-2, -5, -1],
            a: [[2, -1, 7], [1, 3, 4], [3, 6, 1]],
            b: [6, 9, 3]
        },
        'unbounded': {
            n: 2,
            m: 1,
            type: 'max',
            c: [1, 1],
            a: [[1, -1]],
            b: [1]
        },
        'degenerate': {
            n: 2,
            m: 2,
            type: 'max',
            c: [3, 4],
            a: [[1, 1], [2, 2]],
            b: [4, 8]
        },
        'multiple': {
            n: 2,
            m: 2,
            type: 'max',
            c: [1, 1],
            a: [[1, 0], [0, 1]],
            b: [3, 3]
        }
    };

    let lastSolvedData = null; // 用于存储最后一次求解的数据，以便在 resize 时重绘

    // 初始化表格
    generateCoeffTable();

    // 事件监听
    numVarsInput.addEventListener('change', generateCoeffTable);
    numConstraintsInput.addEventListener('change', handleConstraintCountChange);
    resetBtn.addEventListener('click', resetForm);
    checkBtn.addEventListener('click', validateInputs);
    solveBtn.addEventListener('click', solveSimplex);
    loadExampleBtn.addEventListener('click', loadExample);

    // 面板折叠逻辑
    const togglePanelBtn = document.getElementById('toggle-panel-btn');
    const panelContent = document.getElementById('panel-content');
    const stickyWrapper = document.querySelector('.input-panel-sticky-wrapper');

    if (togglePanelBtn && panelContent) {
        togglePanelBtn.addEventListener('click', function() {
            const isCollapsed = panelContent.classList.toggle('collapsed');
            stickyWrapper.classList.toggle('is-collapsed', isCollapsed);
            
            // 更新按钮图标和提示
            const icon = togglePanelBtn.querySelector('i');
            if (isCollapsed) {
                icon.style.transform = 'rotate(180deg)';
                togglePanelBtn.title = '展开';
            } else {
                icon.style.transform = 'rotate(0deg)';
                togglePanelBtn.title = '收起';
            }
        });
    }

    // 约束数量限制处理
    function handleConstraintCountChange() {
        const m = parseInt(numConstraintsInput.value);
        if (m > 10) {
            numConstraintsInput.value = 10;
            showConstraintLimitWarning();
        }
        generateCoeffTable();
    }

    function showConstraintLimitWarning() {
        // 移除已存在的警告
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

        iterationResults.innerHTML = '<div class="placeholder-text">已加载示例数据，点击"求解"开始实验。</div>';
        viz2dContainer.classList.add('hidden');
    }

    /**
     * 动态生成系数输入表格
     */
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
        numVarsInput.value = 2;
        numConstraintsInput.value = 3;
        document.querySelector('input[name="solve-type"][value="max"]').checked = true;
        generateCoeffTable();
        iterationResults.innerHTML = '<div class="placeholder-text">请在左侧输入参数并点击"求解"开始实验。</div>';
        viz2dContainer.classList.add('hidden');
    }

    function validateInputs() {
        const n = parseInt(numVarsInput.value);
        const m = parseInt(numConstraintsInput.value);

        // 检查所有输入是否为有效数字
        const inputs = coeffTableContainer.querySelectorAll('input[type="number"]');
        for (let input of inputs) {
            if (input.value === "" || isNaN(parseFloat(input.value))) {
                alert("请确保所有单元格都填写了有效的数字。");
                input.focus();
                return false;
            }
        }

        // 检查 b_i >= 0
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

    /**
     * 单纯形法求解核心逻辑
     */
    function solveSimplex() {
        // 1. 获取输入数据
        const n = parseInt(numVarsInput.value);
        const m = parseInt(numConstraintsInput.value);
        const solveType = document.querySelector('input[name="solve-type"]:checked').value;

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

        // 2. 初始化单纯形表数据
        const totalVars = n + m;
        const cj = [...c, ...new Array(m).fill(0)];

        const basis = [];
        for (let i = 1; i <= m; i++) {
            basis.push(`x${n + i}`);
        }

        const cB = new Array(m).fill(0);

        const fullA = a.map((row, i) => {
            const slackPart = new Array(m).fill(0);
            slackPart[i] = 1;
            return [...row, ...slackPart];
        });

        const currentB = [...b];

        let steps = [];
        let iteration = 0;
        const maxIterations = 1000;

        let finished = false;
        let status = "iterating";

        while (!finished && iteration < maxIterations) {
            iteration++;

            // 计算检验数 sigma_j = c_j - z_j = c_j - sum(cB_i * a_ij)
            const sigma = [];
            for (let j = 0; j < totalVars; j++) {
                let zj = 0;
                for (let i = 0; i < m; i++) {
                    zj += cB[i] * fullA[i][j];
                }
                sigma.push(cj[j] - zj);
            }

            // 判断最优性
            let enteringIdx = -1;
            if (solveType === 'max') {
                let maxSigma = -Infinity;
                for (let j = 0; j < totalVars; j++) {
                    if (sigma[j] > 1e-10) {
                        if (sigma[j] > maxSigma) {
                            maxSigma = sigma[j];
                            enteringIdx = j;
                        }
                    }
                }
            } else {
                let minSigma = Infinity;
                for (let j = 0; j < totalVars; j++) {
                    if (sigma[j] < -1e-10) {
                        if (sigma[j] < minSigma) {
                            minSigma = sigma[j];
                            enteringIdx = j;
                        }
                    }
                }
            }

            if (enteringIdx === -1) {
                status = "optimal";
                finished = true;
                steps.push({
                    iteration,
                    cj: [...cj],
                    basis: [...basis],
                    cB: [...cB],
                    b: [...currentB],
                    a: fullA.map(r => [...r]),
                    sigma: [...sigma],
                    entering: null,
                    leaving: null,
                    theta: null,
                    status: "optimal"
                });
                break;
            }

            // 比值测试选择离基变量
            const theta = [];
            let leavingIdx = -1;
            let minTheta = Infinity;
            let isUnbounded = true;

            for (let i = 0; i < m; i++) {
                if (fullA[i][enteringIdx] > 1e-10) {
                    isUnbounded = false;
                    const t = currentB[i] / fullA[i][enteringIdx];
                    theta.push(t);
                    if (t < minTheta - 1e-10) {
                        minTheta = t;
                        leavingIdx = i;
                    }
                } else {
                    theta.push(null);
                }
            }

            if (isUnbounded) {
                status = "unbounded";
                finished = true;
                steps.push({
                    iteration,
                    cj: [...cj],
                    basis: [...basis],
                    cB: [...cB],
                    b: [...currentB],
                    a: fullA.map(r => [...r]),
                    sigma: [...sigma],
                    entering: `x${enteringIdx + 1}`,
                    leaving: null,
                    theta: theta,
                    status: "unbounded"
                });
                break;
            }

            // 记录当前步骤
            steps.push({
                iteration,
                cj: [...cj],
                basis: [...basis],
                cB: [...cB],
                b: [...currentB],
                a: fullA.map(r => [...r]),
                sigma: [...sigma],
                entering: `x${enteringIdx + 1}`,
                leaving: basis[leavingIdx],
                theta: theta,
                status: "iterating"
            });

            // 迭代更新（主元消去）
            const pivot = fullA[leavingIdx][enteringIdx];

            currentB[leavingIdx] /= pivot;
            for (let j = 0; j < totalVars; j++) {
                fullA[leavingIdx][j] /= pivot;
            }

            for (let i = 0; i < m; i++) {
                if (i !== leavingIdx) {
                    const factor = fullA[i][enteringIdx];
                    currentB[i] -= factor * currentB[leavingIdx];
                    for (let j = 0; j < totalVars; j++) {
                        fullA[i][j] -= factor * fullA[leavingIdx][j];
                    }
                }
            }

            basis[leavingIdx] = `x${enteringIdx + 1}`;
            cB[leavingIdx] = cj[enteringIdx];
        }

        if (iteration >= maxIterations) status = "max_iter";

        // 3. 渲染结果
        renderResults(steps, status, solveType);

        // 4. 二维可视化 (如果 n=2)
        if (n === 2) {
            lastSolvedData = {
                c: [...c],
                a: a.map(r => [...r]),
                b: [...b],
                steps: JSON.parse(JSON.stringify(steps)), // 深度克隆以防止修改
                solveType: solveType
            };
            render2DViz(c, a, b, steps, solveType);
        } else {
            lastSolvedData = null;
            viz2dContainer.classList.add('hidden');
        }
    }

    function renderResults(steps, status, solveType) {
        iterationResults.innerHTML = '';

        steps.forEach((step, idx) => {
            const card = document.createElement('div');
            card.className = 'iteration-card';

            let title = `第 ${step.iteration} 次迭代`;
            if (step.status === 'optimal') title += " (达到最优)";
            if (step.status === 'unbounded') title += " (检测到无界)";

            card.innerHTML = `<h4>${title}</h4>`;

            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'table-wrapper';
            const svg = d3.select(tableWrapper).append('svg')
                .attr('class', 'simplex-svg');

            renderSimplexTable(svg, step);
            card.appendChild(tableWrapper);

            const explanation = document.createElement('div');
            explanation.className = 'explanation';
            explanation.innerHTML = generateExplanation(step, solveType);
            card.appendChild(explanation);

            const isDegenerate = step.b.some(val => Math.abs(val) < 1e-10);
            if (isDegenerate && step.status === 'iterating') {
                const alert = document.createElement('div');
                alert.className = 'alert alert-warning';
                alert.innerText = "提示：当前存在取值为 0 的基变量，解是退化的。";
                card.appendChild(alert);
            }

            iterationResults.appendChild(card);
        });

        const finalAlert = document.createElement('div');
        if (status === 'optimal') {
            finalAlert.className = 'alert alert-success';
            const lastStep = steps[steps.length - 1];
            let z = 0;
            for(let i=0; i<lastStep.cB.length; i++) z += lastStep.cB[i] * lastStep.b[i];
            finalAlert.innerHTML = `<strong>求解成功！</strong> 找到最优解。最优目标函数值 Z = ${z.toFixed(4)}`;
        } else if (status === 'unbounded') {
            finalAlert.className = 'alert alert-danger';
            finalAlert.innerHTML = `<strong>求解终止：</strong> 问题无界。存在入基变量但所有比值测试分母均非正。`;
        } else if (status === 'max_iter') {
            finalAlert.className = 'alert alert-warning';
            finalAlert.innerHTML = `<strong>求解终止：</strong> 达到最大迭代次数。可能存在循环或计算不收敛。`;
        }
        iterationResults.appendChild(finalAlert);

        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([iterationResults]).catch((err) => console.log('MathJax typeset failed: ' + err.message));
        }
    }

    function renderSimplexTable(svg, data) {
        const colWidth = 70;
        const rowHeight = 30;
        const n = data.cj.length;
        const m = data.basis.length;

        const totalCols = 3 + n + 1;
        const totalRows = 1 + m + 1;

        const width = totalCols * colWidth;
        const height = totalRows * rowHeight;

        svg.attr('width', width).attr('height', height);

        svg.selectAll('rect.cell-bg')
            .data(d3.range(totalCols * totalRows))
            .enter()
            .append('rect')
            .attr('class', 'cell-bg')
            .attr('x', d => (d % totalCols) * colWidth)
            .attr('y', d => Math.floor(d / totalCols) * rowHeight)
            .attr('width', colWidth)
            .attr('height', rowHeight)
            .attr('fill', '#fff')
            .attr('stroke', '#eee');

        if (data.entering && data.leaving) {
            const enteringColIdx = parseInt(data.entering.substring(1)) - 1 + 3;
            const leavingRowIdx = data.basis.indexOf(data.leaving) + 1;

            svg.append('rect')
                .attr('x', enteringColIdx * colWidth)
                .attr('y', 0)
                .attr('width', colWidth)
                .attr('height', height)
                .attr('fill', 'rgba(255, 235, 59, 0.1)');

            svg.append('rect')
                .attr('x', 0)
                .attr('y', leavingRowIdx * rowHeight)
                .attr('width', width)
                .attr('height', rowHeight)
                .attr('fill', 'rgba(255, 235, 59, 0.1)');

            svg.append('rect')
                .attr('x', enteringColIdx * colWidth)
                .attr('y', leavingRowIdx * rowHeight)
                .attr('width', colWidth)
                .attr('height', rowHeight)
                .attr('fill', '#fff9c4');
        }

        const cells = [];

        cells.push({r: 0, c: 0, val: 'cj'});
        cells.push({r: 0, c: 1, val: ''});
        cells.push({r: 0, c: 2, val: ''});
        for (let j = 0; j < n; j++) cells.push({r: 0, c: j+3, val: data.cj[j].toFixed(2)});
        cells.push({r: 0, c: totalCols-1, val: 'θ'});

        for (let i = 0; i < m; i++) {
            const rowIdx = i + 1;
            cells.push({r: rowIdx, c: 0, val: data.cB[i].toFixed(2)});
            cells.push({r: rowIdx, c: 1, val: data.basis[i]});
            cells.push({r: rowIdx, c: 2, val: data.b[i].toFixed(2)});
            for (let j = 0; j < n; j++) {
                cells.push({r: rowIdx, c: j+3, val: data.a[i][j].toFixed(2)});
            }
            const thetaVal = data.theta && data.theta[i] !== null ? data.theta[i].toFixed(2) : '-';
            cells.push({r: rowIdx, c: totalCols-1, val: thetaVal});
        }

        const lastRowIdx = totalRows - 1;
        cells.push({r: lastRowIdx, c: 0, val: 'σj'});
        cells.push({r: lastRowIdx, c: 1, val: ''});
        cells.push({r: lastRowIdx, c: 2, val: ''});
        for (let j = 0; j < n; j++) {
            cells.push({r: lastRowIdx, c: j+3, val: data.sigma[j].toFixed(2)});
        }
        cells.push({r: lastRowIdx, c: totalCols-1, val: ''});

        svg.selectAll('text')
            .data(cells)
            .enter()
            .append('text')
            .attr('x', d => d.c * colWidth + colWidth/2)
            .attr('y', d => d.r * rowHeight + rowHeight/2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .text(d => d.val);
    }

    function generateExplanation(step, solveType) {
        if (step.status === 'optimal') {
            return `<strong>结论：</strong> 所有检验数 \\(\\sigma_j\\) 均满足最优性条件（${solveType === 'max' ? '\\(\\sigma_j \\le 0\\)' : '\\(\\sigma_j \\ge 0\\)'}），当前基本可行解即为最优解。`;
        }
        if (step.status === 'unbounded') {
            return `<strong>结论：</strong> 选择入基变量 ${step.entering}，但其对应列系数均非正，目标函数值可无限改进，问题无界。`;
        }

        let text = `<strong>步骤：</strong> `;
        if (solveType === 'max') {
            text += `当前为最大化问题，选择最大正检验数对应的变量 <strong>${step.entering}</strong> 入基。`;
        } else {
            text += `当前为最小化问题，选择最小负检验数对应的变量 <strong>${step.entering}</strong> 入基。`;
        }

        text += `<br><strong>比值测试：</strong> 经过计算，最小正比值为对应 <strong>${step.leaving}</strong> 所在的行，故 <strong>${step.leaving}</strong> 离基。`;
        text += `<br><strong>更新：</strong> 以 <strong>${step.entering}</strong> 和 <strong>${step.leaving}</strong> 交叉处的元素为主元进行行变换。`;

        return text;
    }

    // ==================== 二维可视化模块 ====================

    /**
     * 主可视化函数
     */
    function render2DViz(c, a, b, steps, solveType) {
        viz2dContainer.classList.remove('hidden');
        const container = d3.select('#lp-viz');
        container.selectAll('*').remove();

        const margin = {top: 40, right: 50, bottom: 50, left: 60};
        const width = container.node().clientWidth - margin.left - margin.right;
        const height = container.node().clientHeight - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // 创建浮动信息面板
        const infoPanel = createInfoPanel(container);

        // 预处理约束
        const {constraints, overlapMap} = preprocessConstraints(a, b);

        // 检查是否全部松弛
        const allSlack = constraints.every(c => c.xIntercept < 0 && c.yIntercept < 0);
        if (allSlack) {
            showAllSlackMessage(container);
            return;
        }

        // 计算坐标范围
        const bounds = calculateOptimalRange(constraints, steps);

        // 创建比例尺
        const xScale = d3.scaleLinear().domain([bounds.minX, bounds.maxX]).range([0, width]);
        const yScale = d3.scaleLinear().domain([bounds.minY, bounds.maxY]).range([height, 0]);
        const scales = {xScale, yScale, width, height};

        // 绘制网格
        drawGrid(svg, scales, bounds);

        // 绘制坐标轴
        drawAxes(svg, scales, bounds);

        // 绘制约束线
        const drawnIndices = new Set();
        constraints.forEach((constraint, i) => {
            if (!constraint.isDuplicate) {
                drawConstraintLine(svg, constraint, i, scales, bounds, overlapMap, infoPanel);
                drawnIndices.add(i);
            }
        });

        // 计算可行域顶点（使用裁剪算法）
        const feasibleVertices = calculateFeasibleRegionByClipping(bounds, constraints);

        // 绘制可行域（包括点、线段和多边形）
        if (feasibleVertices.length >= 1) {
            drawFeasibleRegion(svg, feasibleVertices, scales);
        }

        // 绘制目标函数
        const lastStep = steps[steps.length - 1];
        if (lastStep && lastStep.status === 'optimal') {
            let optimalX = 0, optimalY = 0;
            const x1Idx = lastStep.basis.indexOf('x1');
            const x2Idx = lastStep.basis.indexOf('x2');
            if (x1Idx !== -1) optimalX = lastStep.b[x1Idx];
            if (x2Idx !== -1) optimalY = lastStep.b[x2Idx];
            drawObjectiveFunction(svg, c, {x: optimalX, y: optimalY}, scales, bounds, infoPanel);
        }

        // 绘制迭代路径
        drawIterationPath(svg, steps, scales, infoPanel);
    }

    /**
     * 创建浮动信息面板
     */
    function createInfoPanel(container) {
        // 在 body 上创建面板，避免被容器裁剪
        const panel = d3.select('body').append('div')
            .attr('class', 'info-panel-float')
            .style('opacity', 0)
            .style('display', 'none');

        let showTimeout;
        let hideTimeout;

        function updatePanelPosition(event) {
            const panelNode = panel.node();
            const panelWidth = 260;
            const panelHeight = panelNode.offsetHeight || 150;
            const offset = 15;

            // 基础位置：鼠标右下方
            let left = event.clientX + offset;
            let top = event.clientY + offset;

            // 边界检测
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (left + panelWidth > viewportWidth) {
                left = event.clientX - panelWidth - offset;
            }

            if (top + panelHeight > viewportHeight) {
                top = event.clientY - panelHeight - offset;
            }

            // 确保不超出左上角
            left = Math.max(10, left);
            top = Math.max(10, top);

            panel
                .style('left', left + 'px')
                .style('top', top + 'px');
        }

        return {
            show: function(title, badge, equation, details, event) {
                clearTimeout(hideTimeout);

                // 构建面板内容
                let badgeHtml = badge ? `<span class="panel-badge">${badge}</span>` : '';
                let detailsHtml = details.map(d => `<div class="details-item">${d}</div>`).join('');

                const content = `
                    <div class="float-panel-header">
                        <span class="panel-title">${title}</span>
                        ${badgeHtml}
                    </div>
                    <div class="panel-body">
                        <div class="equation">${equation}</div>
                        <div class="details">${detailsHtml}</div>
                    </div>
                `;

                panel.html(content);

                // 延迟显示避免闪烁
                showTimeout = setTimeout(() => {
                    panel.style('display', 'block');
                    panel.style('opacity', null); // 清除内联 opacity，让 CSS 类生效
                    // 强制重绘
                    panel.node().offsetHeight;
                    // 计算位置
                    updatePanelPosition(event);
                    // 添加 visible 类实现动画
                    panel.classed('visible', true);
                }, 50);
            },
            move: function(event) {
                if (panel.classed('visible')) {
                    updatePanelPosition(event);
                }
            },
            hide: function() {
                clearTimeout(showTimeout);
                hideTimeout = setTimeout(() => {
                    panel.classed('visible', false);
                    setTimeout(() => {
                        panel.style('display', 'none');
                    }, 250);
                }, 100);
            }
        };
    }

    /**
     * 显示全松弛消息
     */
    function showAllSlackMessage(container) {
        container.append('div')
            .attr('class', 'all-slack-message')
            .html('<div>所有约束均松弛</div><div style="font-size: 14px; margin-top: 10px;">第一象限全部可行</div>');
    }

    /**
     * 计算最优坐标范围
     */
    function calculateOptimalRange(constraints, steps) {
        let minX = 0, maxX = 5, minY = 0, maxY = 5;
        
        // 收集所有截距点
        const intercepts = [];
        constraints.forEach(c => {
            if (c.xIntercept !== null && isFinite(c.xIntercept)) {
                intercepts.push(c.xIntercept);
            }
            if (c.yIntercept !== null && isFinite(c.yIntercept)) {
                intercepts.push(c.yIntercept);
            }
        });

        // 根据系数数量级动态设置上限
        const maxCoeff = Math.max(
            ...constraints.flatMap(c => c.a.map(Math.abs)),
            ...constraints.map(c => Math.abs(c.b)),
            1
        );
        const upperLimit = maxCoeff > 100 ? maxCoeff * 2 : 50;

        // 计算范围
        const positiveIntercepts = intercepts.filter(x => x > 0 && x <= upperLimit);
        const negativeIntercepts = intercepts.filter(x => x < 0 && Math.abs(x) <= upperLimit);

        if (positiveIntercepts.length > 0) {
            maxX = Math.max(5, ...positiveIntercepts) * 1.2;
            maxY = Math.max(5, ...positiveIntercepts) * 1.2;
        }

        if (negativeIntercepts.length > 0) {
            minX = Math.min(0, ...negativeIntercepts) * 1.2;
            minY = Math.min(0, ...negativeIntercepts) * 1.2;
        }

        // 根据迭代路径调整范围
        steps.forEach(step => {
            let x1 = 0, x2 = 0;
            const x1Idx = step.basis.indexOf('x1');
            const x2Idx = step.basis.indexOf('x2');
            if (x1Idx !== -1) x1 = step.b[x1Idx];
            if (x2Idx !== -1) x2 = step.b[x2Idx];
            
            if (Math.abs(x1) <= upperLimit) {
                minX = Math.min(minX, x1 * 1.1);
                maxX = Math.max(maxX, x1 * 1.1);
            }
            if (Math.abs(x2) <= upperLimit) {
                minY = Math.min(minY, x2 * 1.1);
                maxY = Math.max(maxY, x2 * 1.1);
            }
        });

        return {minX, maxX, minY, maxY};
    }

    /**
     * 预处理约束（计算斜率、截距，检测重合）
     */
    function preprocessConstraints(a, b) {
        const constraints = [];
        const overlapMap = new Map();

        a.forEach((row, i) => {
            const [a1, a2] = row;
            const bi = b[i];
            
            let slope, xIntercept, yIntercept;
            
            if (a2 !== 0) {
                slope = -a1 / a2;
                yIntercept = bi / a2;
            } else {
                slope = Infinity;
                yIntercept = null;
            }
            
            if (a1 !== 0) {
                xIntercept = bi / a1;
            } else {
                xIntercept = null;
            }

            // 检测重合（使用斜率和截距作为key）
            const key = `${slope.toFixed(10)}_${(yIntercept !== null ? yIntercept : xIntercept).toFixed(10)}`;
            
            if (overlapMap.has(key)) {
                overlapMap.get(key).push(i);
            } else {
                overlapMap.set(key, [i]);
            }

            constraints.push({
                a: row,
                b: bi,
                index: i,
                slope: slope,
                xIntercept: xIntercept,
                yIntercept: yIntercept,
                isDuplicate: false
            });
        });

        // 标记重复约束
        overlapMap.forEach((indices) => {
            if (indices.length > 1) {
                // 第一个是主约束，其余标记为重复
                for (let i = 1; i < indices.length; i++) {
                    constraints[indices[i]].isDuplicate = true;
                }
            }
        });

        return {constraints, overlapMap};
    }

    /**
     * 绘制网格
     */
    function drawGrid(svg, scales, bounds) {
        const {xScale, yScale, width, height} = scales;
        
        // 计算网格步长
        const xRange = bounds.maxX - bounds.minX;
        const yRange = bounds.maxY - bounds.minY;
        const xStep = Math.pow(10, Math.floor(Math.log10(xRange / 10)));
        const yStep = Math.pow(10, Math.floor(Math.log10(yRange / 10)));

        // 垂直网格线
        for (let x = Math.ceil(bounds.minX / xStep) * xStep; x <= bounds.maxX; x += xStep) {
            svg.append('line')
                .attr('class', 'grid-line')
                .attr('x1', xScale(x))
                .attr('y1', 0)
                .attr('x2', xScale(x))
                .attr('y2', height);
        }

        // 水平网格线
        for (let y = Math.ceil(bounds.minY / yStep) * yStep; y <= bounds.maxY; y += yStep) {
            svg.append('line')
                .attr('class', 'grid-line')
                .attr('x1', 0)
                .attr('y1', yScale(y))
                .attr('x2', width)
                .attr('y2', yScale(y));
        }
    }

    /**
     * 绘制坐标轴
     */
    function drawAxes(svg, scales, bounds) {
        const {xScale, yScale, width, height} = scales;

        // X轴
        if (bounds.minY <= 0 && bounds.maxY >= 0) {
            svg.append('line')
                .attr('class', 'axis-line')
                .attr('x1', 0)
                .attr('y1', yScale(0))
                .attr('x2', width)
                .attr('y2', yScale(0));
        }

        // Y轴
        if (bounds.minX <= 0 && bounds.maxX >= 0) {
            svg.append('line')
                .attr('class', 'axis-line')
                .attr('x1', xScale(0))
                .attr('y1', 0)
                .attr('x2', xScale(0))
                .attr('y2', height);
        }

        // D3坐标轴
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        svg.append('g')
            .call(yAxis);

        // 轴标签
        svg.append('text')
            .attr('class', 'axis-text')
            .attr('x', width)
            .attr('y', height - 5)
            .attr('text-anchor', 'end')
            .text('x₁');

        svg.append('text')
            .attr('class', 'axis-text')
            .attr('x', 5)
            .attr('y', 15)
            .text('x₂');
    }

    /**
     * 绘制约束线
     */
    function drawConstraintLine(svg, constraint, index, scales, bounds, overlapMap, infoPanel) {
        const {xScale, yScale} = scales;
        const {a, b: bi, xIntercept, yIntercept, slope} = constraint;
        const [a1, a2] = a;

        // 计算与边界的交点
        const points = [];

        // 与左边界 (x=minX) 的交点
        if (a2 !== 0) {
            const y = (bi - a1 * bounds.minX) / a2;
            if (y >= bounds.minY && y <= bounds.maxY) {
                points.push([bounds.minX, y]);
            }
        }

        // 与右边界 (x=maxX) 的交点
        if (a2 !== 0) {
            const y = (bi - a1 * bounds.maxX) / a2;
            if (y >= bounds.minY && y <= bounds.maxY) {
                points.push([bounds.maxX, y]);
            }
        }

        // 与下边界 (y=minY) 的交点
        if (a1 !== 0) {
            const x = (bi - a2 * bounds.minY) / a1;
            if (x >= bounds.minX && x <= bounds.maxX) {
                points.push([x, bounds.minY]);
            }
        }

        // 与上边界 (y=maxY) 的交点
        if (a1 !== 0) {
            const x = (bi - a2 * bounds.maxY) / a1;
            if (x >= bounds.minX && x <= bounds.maxX) {
                points.push([x, bounds.maxY]);
            }
        }

        // 去重
        const uniquePoints = [];
        const seen = new Set();
        points.forEach(p => {
            const key = `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePoints.push(p);
            }
        });

        if (uniquePoints.length < 2) return;
        
        // 绘制透明的交互线（增大命中区域）
        const interactiveLine = svg.append('line')
            .attr('x1', xScale(uniquePoints[0][0]))
            .attr('y1', yScale(uniquePoints[0][1]))
            .attr('x2', xScale(uniquePoints[1][0]))
            .attr('y2', yScale(uniquePoints[1][1]))
            .attr('stroke', 'transparent')
            .attr('stroke-width', 20)
            .style('cursor', 'pointer');

        // 绘制约束线
        const line = svg.append('line')
            .attr('class', 'constraint-line')
            .attr('x1', xScale(uniquePoints[0][0]))
            .attr('y1', yScale(uniquePoints[0][1]))
            .attr('x2', xScale(uniquePoints[1][0]))
            .attr('y2', yScale(uniquePoints[1][1]))
            .attr('stroke', '#666')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4')
            .style('pointer-events', 'none'); // 让事件透传到交互线

        // 绘制单个约束的可行域填充
        const feasiblePolygon = calculateConstraintFeasibleRegion(constraint, bounds);
        if (feasiblePolygon.length >= 3) {
            const pathData = feasiblePolygon.map((p, i) => 
                (i === 0 ? 'M' : 'L') + xScale(p[0]) + ',' + yScale(p[1])
            ).join(' ') + ' Z';

            svg.insert('path', ':first-child')
                .attr('class', 'feasible-region-single')
                .attr('d', pathData);
        }

        // 生成信息面板内容
        const key = `${slope.toFixed(10)}_${(yIntercept !== null ? yIntercept : xIntercept).toFixed(10)}`;
        const overlappingIndices = overlapMap.get(key) || [index];

        const title = `约束 ${overlappingIndices.map(i => i + 1).join(', ')}`;
        const badge = overlappingIndices.length > 1 ? `重合` : null;
        const equation = `${a1}x₁ + ${a2}x₂ ≤ ${bi}`;
        const details = [];

        if (overlappingIndices.length > 1) {
            details.push(`与约束 ${overlappingIndices.slice(1).map(i => i + 1).join(', ')} 重合`);
        }

        if (xIntercept !== null && isFinite(xIntercept)) {
            details.push(`x轴截距: (${xIntercept.toFixed(2)}, 0)`);
        }
        if (yIntercept !== null && isFinite(yIntercept)) {
            details.push(`y轴截距: (0, ${yIntercept.toFixed(2)})`);
        }

        // 添加悬停事件
        interactiveLine.on('mouseover', function(event) {
            line.attr('stroke-width', 3).attr('stroke', 'var(--primary-color)');
            infoPanel.show(title, badge, equation, details, event);
        }).on('mousemove', function(event) {
            infoPanel.move(event);
        }).on('mouseout', function() {
            line.attr('stroke-width', 1.5).attr('stroke', '#666');
            infoPanel.hide();
        });
    }

    /**
     * 计算单个约束的可行域多边形
     */
    function calculateConstraintFeasibleRegion(constraint, bounds) {
        const {a, b: bi} = constraint;
        const [a1, a2] = a;
        const polygon = [];

        // 添加边界角点（如果满足约束）
        const corners = [
            [bounds.minX, bounds.minY],
            [bounds.maxX, bounds.minY],
            [bounds.maxX, bounds.maxY],
            [bounds.minX, bounds.maxY]
        ];

        corners.forEach(([x, y]) => {
            if (a1 * x + a2 * y <= bi + 1e-10) {
                polygon.push([x, y]);
            }
        });

        // 添加约束线与边界的交点
        const intersections = [];

        // 与左边界
        if (a2 !== 0) {
            const y = (bi - a1 * bounds.minX) / a2;
            if (y >= bounds.minY && y <= bounds.maxY) {
                intersections.push([bounds.minX, y]);
            }
        }

        // 与右边界
        if (a2 !== 0) {
            const y = (bi - a1 * bounds.maxX) / a2;
            if (y >= bounds.minY && y <= bounds.maxY) {
                intersections.push([bounds.maxX, y]);
            }
        }

        // 与下边界
        if (a1 !== 0) {
            const x = (bi - a2 * bounds.minY) / a1;
            if (x >= bounds.minX && x <= bounds.maxX) {
                intersections.push([x, bounds.minY]);
            }
        }

        // 与上边界
        if (a1 !== 0) {
            const x = (bi - a2 * bounds.maxY) / a1;
            if (x >= bounds.minX && x <= bounds.maxX) {
                intersections.push([x, bounds.maxY]);
            }
        }

        // 合并并排序（极角排序）
        const allPoints = [...polygon, ...intersections];
        if (allPoints.length < 3) return [];

        // 计算中心点
        const centerX = allPoints.reduce((sum, p) => sum + p[0], 0) / allPoints.length;
        const centerY = allPoints.reduce((sum, p) => sum + p[1], 0) / allPoints.length;

        // 按极角排序
        allPoints.sort((a, b) => {
            const angleA = Math.atan2(a[1] - centerY, a[0] - centerX);
            const angleB = Math.atan2(b[1] - centerY, b[0] - centerX);
            return angleA - angleB;
        });

        return allPoints;
    }

    /**
     * 计算线段与约束线的交点
     */
    function lineSegmentIntersection(p1, p2, constraint, epsilon) {
        const [a1, a2] = constraint.a;
        const b = constraint.b;
        
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        
        // 线段参数方程: P = p1 + t*(p2-p1)
        // 与约束线 a1*x + a2*y = b 的交点
        const denom = a1 * dx + a2 * dy;
        if (Math.abs(denom) < epsilon) return null; // 平行
        
        const t = (b - a1 * p1[0] - a2 * p1[1]) / denom;
        if (t < -epsilon || t > 1 + epsilon) return null; // 交点不在线段上
        
        return [p1[0] + t * dx, p1[1] + t * dy];
    }

    /**
     * Sutherland-Hodgman多边形裁剪
     */
    function clipPolygon(polygon, constraint, epsilon) {
        const [a1, a2] = constraint.a;
        const b = constraint.b;
        const newPolygon = [];
        
        const n = polygon.length;
        if (n === 0) return [];
        
        for (let i = 0; i < n; i++) {
            const current = polygon[i];
            const next = polygon[(i + 1) % n];
            
            const currVal = a1 * current[0] + a2 * current[1] - b;
            const nextVal = a1 * next[0] + a2 * next[1] - b;
            
            const currInside = currVal <= epsilon;
            const nextInside = nextVal <= epsilon;
            
            if (currInside && nextInside) {
                // 两点都在内部：保留终点
                newPolygon.push(next);
            } else if (currInside && !nextInside) {
                // 从内到外：保留交点
                const intersect = lineSegmentIntersection(current, next, constraint, epsilon);
                if (intersect) newPolygon.push(intersect);
            } else if (!currInside && nextInside) {
                // 从外到内：保留交点和终点
                const intersect = lineSegmentIntersection(current, next, constraint, epsilon);
                if (intersect) newPolygon.push(intersect);
                newPolygon.push(next);
            }
            // 两点都在外部：不保留
        }
        
        return newPolygon;
    }

    /**
     * 使用裁剪算法计算可行域
     */
    function calculateFeasibleRegionByClipping(bounds, userConstraints) {
        // 1. 初始多边形 = 视图边界矩形
        let polygon = [
            [bounds.minX, bounds.minY],
            [bounds.maxX, bounds.minY],
            [bounds.maxX, bounds.maxY],
            [bounds.minX, bounds.maxY]
        ];
        
        // 2. 添加非负约束
        const allConstraints = [
            ...userConstraints,
            { a: [-1, 0], b: 0 },  // x₁ ≥ 0
            { a: [0, -1], b: 0 }   // x₂ ≥ 0
        ];
        
        // 3. 依次用所有约束裁剪视图矩形
        const epsilon = 1e-10;
        for (const c of allConstraints) {
            polygon = clipPolygon(polygon, c, epsilon);
            if (polygon.length === 0) return []; // 无可行域
        }
        
        // 4. 结果已经是视图内的可行域，转换为顶点对象数组
        return polygon.map(p => ({x: p[0], y: p[1]}));
    }

    /**
     * 计算多边形面积（鞋带公式）
     */
    function calculatePolygonArea(vertices) {
        let area = 0;
        const n = vertices.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }
        return Math.abs(area) / 2;
    }

    /**
     * 去除近似重合的点
     */
    function removeDuplicatePoints(vertices, epsilon) {
        const unique = [];
        vertices.forEach(v => {
            const isDuplicate = unique.some(u => 
                Math.abs(u.x - v.x) < epsilon && Math.abs(u.y - v.y) < epsilon
            );
            if (!isDuplicate) {
                unique.push(v);
            }
        });
        return unique;
    }

    /**
     * 求解线性方程组
     */
    function solveLinearSystem(a1, b1, a2, b2) {
        const det = a1[0] * a2[1] - a1[1] * a2[0];
        if (Math.abs(det) < 1e-10) return null; // 平行或重合

        const x = (b1 * a2[1] - a1[1] * b2) / det;
        const y = (a1[0] * b2 - b1 * a2[0]) / det;
        return [x, y];
    }

    /**
     * 检查点是否在边界内
     */
    function isPointInBounds(point, bounds) {
        const [x, y] = point;
        return x >= bounds.minX - 1e-10 && x <= bounds.maxX + 1e-10 &&
               y >= bounds.minY - 1e-10 && y <= bounds.maxY + 1e-10;
    }

    /**
     * 绘制可行域
     */
    function drawFeasibleRegion(svg, vertices, scales) {
        const {xScale, yScale} = scales;

        // 1. 无可行域（顶点数为0）
        if (vertices.length === 0) {
            return; // 静默跳过
        }

        // 2. 去重（使用1e-8阈值）
        const uniqueVertices = removeDuplicatePoints(vertices, 1e-8);

        // 3. 退化为点（1个顶点）
        if (uniqueVertices.length === 1) {
            const point = uniqueVertices[0];
            svg.append('circle')
                .attr('class', 'feasible-region-point')
                .attr('cx', xScale(point.x))
                .attr('cy', yScale(point.y))
                .attr('r', 6);
            return;
        }

        // 4. 退化为线段（2个顶点）
        if (uniqueVertices.length === 2) {
            const p1 = uniqueVertices[0];
            const p2 = uniqueVertices[1];
            svg.append('line')
                .attr('class', 'feasible-region-line')
                .attr('x1', xScale(p1.x))
                .attr('y1', yScale(p1.y))
                .attr('x2', xScale(p2.x))
                .attr('y2', yScale(p2.y));
            return;
        }

        // 5. 正常多边形（3个或更多顶点）
        // 计算面积验证
        const area = calculatePolygonArea(uniqueVertices);
        if (area < 1e-10) {
            return; // 面积过小，视为退化，不绘制
        }

        // 绘制深红色填充区域
        const pathData = uniqueVertices.map((v, i) => 
            (i === 0 ? 'M' : 'L') + xScale(v.x) + ',' + yScale(v.y)
        ).join(' ') + ' Z';

        svg.append('path')
            .attr('class', 'feasible-region-final')
            .attr('d', pathData);
    }

    /**
     * 绘制目标函数
     */
    function drawObjectiveFunction(svg, c, optimalPoint, scales, bounds, infoPanel) {
        const {xScale, yScale} = scales;
        const [c1, c2] = c;

        // 计算通过最优解的目标函数线上的两个点
        let points = [];

        if (c2 !== 0) {
            // 计算与左右边界的交点
            const yLeft = (c1 * optimalPoint.x + c2 * optimalPoint.y - c1 * bounds.minX) / c2;
            const yRight = (c1 * optimalPoint.x + c2 * optimalPoint.y - c1 * bounds.maxX) / c2;

            if (yLeft >= bounds.minY && yLeft <= bounds.maxY) {
                points.push([bounds.minX, yLeft]);
            }
            if (yRight >= bounds.minY && yRight <= bounds.maxY) {
                points.push([bounds.maxX, yRight]);
            }
        }

        if (points.length < 2 && c1 !== 0) {
            // 计算与上下边界的交点
            const xBottom = (c1 * optimalPoint.x + c2 * optimalPoint.y - c2 * bounds.minY) / c1;
            const xTop = (c1 * optimalPoint.x + c2 * optimalPoint.y - c2 * bounds.maxY) / c1;

            if (xBottom >= bounds.minX && xBottom <= bounds.maxX) {
                points.push([xBottom, bounds.minY]);
            }
            if (xTop >= bounds.minX && xTop <= bounds.maxX) {
                points.push([xTop, bounds.maxY]);
            }
        }

        if (points.length < 2) return;

        // 绘制透明的交互线（增大命中区域）
        const interactiveLine = svg.append('line')
            .attr('x1', xScale(points[0][0]))
            .attr('y1', yScale(points[0][1]))
            .attr('x2', xScale(points[1][0]))
            .attr('y2', yScale(points[1][1]))
            .attr('stroke', 'transparent')
            .attr('stroke-width', 20)
            .style('cursor', 'pointer');

        const line = svg.append('line')
            .attr('class', 'objective-line')
            .attr('x1', xScale(points[0][0]))
            .attr('y1', yScale(points[0][1]))
            .attr('x2', xScale(points[1][0]))
            .attr('y2', yScale(points[1][1]))
            .style('pointer-events', 'none'); // 让事件透传到交互线

        // 生成信息面板内容
        const title = '目标函数';
        const badge = '最优';
        const equation = `Z = ${c1}x₁ + ${c2}x₂`;
        const details = [
            `最优解: (${optimalPoint.x.toFixed(4)}, ${optimalPoint.y.toFixed(4)})`,
            `<span class="optimal-value">最优值: ${(c1 * optimalPoint.x + c2 * optimalPoint.y).toFixed(4)}</span>`
        ];

        // 添加悬停事件
        interactiveLine.on('mouseover', function(event) {
            line.attr('stroke-width', 4);
            infoPanel.show(title, badge, equation, details, event);
        }).on('mousemove', function(event) {
            infoPanel.move(event);
        }).on('mouseout', function() {
            line.attr('stroke-width', 2);
            infoPanel.hide();
        });
    }

    /**
     * 绘制迭代路径
     */
    function drawIterationPath(svg, steps, scales, infoPanel) {
        const {xScale, yScale} = scales;
        const pathData = [];

        steps.forEach(step => {
            let x1 = 0, x2 = 0;
            const x1Idx = step.basis.indexOf('x1');
            const x2Idx = step.basis.indexOf('x2');
            if (x1Idx !== -1) x1 = step.b[x1Idx];
            if (x2Idx !== -1) x2 = step.b[x2Idx];
            pathData.push({x: x1, y: x2, iter: step.iteration});
        });

        if (pathData.length < 2) return;

        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y));

        svg.append('path')
            .datum(pathData)
            .attr('class', 'iteration-path')
            .attr('d', line);

        const dots = svg.selectAll('.iteration-dot')
            .data(pathData)
            .enter()
            .append('circle')
            .attr('class', 'iteration-dot')
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', 5)
            .attr('fill', 'var(--primary-color)');

        // 添加悬停事件
        dots.on('mouseover', function(event, d) {
            d3.select(this).attr('r', 8);
            
            const title = `迭代 ${d.iter}`;
            const badge = d.iter === 0 ? '起始' : (d.iter === steps.length - 1 ? '最优' : `第 ${d.iter} 步`);
            const equation = `(x₁, x₂) = (${d.x.toFixed(4)}, ${d.y.toFixed(4)})`;
            const details = [
                `x₁ 坐标: ${d.x.toFixed(4)}`,
                `x₂ 坐标: ${d.y.toFixed(4)}`
            ];
            
            infoPanel.show(title, badge, equation, details, event);
        }).on('mousemove', function(event) {
            infoPanel.move(event);
        }).on('mouseout', function() {
            d3.select(this).attr('r', 5);
            infoPanel.hide();
        });
    }
    // 窗口尺寸自适应
    let resizeTimer = null;
    window.addEventListener('resize', function() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (lastSolvedData && parseInt(numVarsInput.value) === 2) {
                render2DViz(
                    lastSolvedData.c,
                    lastSolvedData.a,
                    lastSolvedData.b,
                    lastSolvedData.steps,
                    lastSolvedData.solveType
                );
            }
        }, 300);
    });
});
