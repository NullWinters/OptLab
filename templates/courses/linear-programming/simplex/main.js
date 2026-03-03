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

    // 初始化表格
    generateCoeffTable();

    // 事件监听
    numVarsInput.addEventListener('change', generateCoeffTable);
    numConstraintsInput.addEventListener('change', generateCoeffTable);
    resetBtn.addEventListener('click', resetForm);
    checkBtn.addEventListener('click', validateInputs);
    solveBtn.addEventListener('click', solveSimplex);

    /**
     * 动态生成系数输入表格
     * (m+1) 行 x (n+1) 列
     * 第一行为目标函数系数，最后一列为右端项 b
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
        iterationResults.innerHTML = '<div class="placeholder-text">请在左侧输入参数并点击“求解”开始实验。</div>';
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
        // 变量总数 = 原始变量 + 松弛变量
        const totalVars = n + m;
        const cj = [...c, ...new Array(m).fill(0)];
        
        // 初始基变量：松弛变量 x_{n+1} ... x_{n+m}
        const basis = [];
        for (let i = 1; i <= m; i++) {
            basis.push(`x${n + i}`);
        }

        // 初始 cB
        const cB = new Array(m).fill(0);

        // 初始 A 矩阵（包含松弛变量的单位阵）
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
        let status = "iterating"; // "optimal", "unbounded", "max_iter"

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
                // 最大化：若所有 sigma <= 0，则达到最优
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
                // 最小化：若所有 sigma >= 0，则达到最优
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
                    } else if (Math.abs(t - minTheta) < 1e-10) {
                        // Bland 规则：选下标最小的变量
                        // 这里我们选行号小的，对应松弛变量初始顺序，通常也符合要求
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
            
            // 1. 主元行归一化
            currentB[leavingIdx] /= pivot;
            for (let j = 0; j < totalVars; j++) {
                fullA[leavingIdx][j] /= pivot;
            }

            // 2. 其他行消元
            for (let i = 0; i < m; i++) {
                if (i !== leavingIdx) {
                    const factor = fullA[i][enteringIdx];
                    currentB[i] -= factor * currentB[leavingIdx];
                    for (let j = 0; j < totalVars; j++) {
                        fullA[i][j] -= factor * fullA[leavingIdx][j];
                    }
                }
            }

            // 3. 更新基变量
            basis[leavingIdx] = `x${enteringIdx + 1}`;
            cB[leavingIdx] = cj[enteringIdx];
        }

        if (iteration >= maxIterations) status = "max_iter";

        // 3. 渲染结果
        renderResults(steps, status, solveType);
        
        // 4. 二维可视化 (如果 n=2)
        if (n === 2) {
            render2DViz(c, a, b, steps, solveType);
        } else {
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
            
            // SVG 表格容器
            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'table-wrapper';
            const svg = d3.select(tableWrapper).append('svg')
                .attr('class', 'simplex-svg');
            
            renderSimplexTable(svg, step);
            card.appendChild(tableWrapper);
            
            // 说明文本
            const explanation = document.createElement('div');
            explanation.className = 'explanation';
            explanation.innerHTML = generateExplanation(step, solveType);
            card.appendChild(explanation);

            // 退化提示
            const isDegenerate = step.b.some(val => Math.abs(val) < 1e-10);
            if (isDegenerate && step.status === 'iterating') {
                const alert = document.createElement('div');
                alert.className = 'alert alert-warning';
                alert.innerText = "提示：当前存在取值为 0 的基变量，解是退化的。";
                card.appendChild(alert);
            }

            iterationResults.appendChild(card);
        });

        // 最终状态提示
        const finalAlert = document.createElement('div');
        if (status === 'optimal') {
            finalAlert.className = 'alert alert-success';
            const lastStep = steps[steps.length - 1];
            // 计算最优值
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

        // 重新触发 MathJax 渲染动态添加的内容
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([iterationResults]).catch((err) => console.log('MathJax typeset failed: ' + err.message));
        }
    }

    function renderSimplexTable(svg, data) {
        const colWidth = 70;
        const rowHeight = 30;
        const n = data.cj.length;
        const m = data.basis.length;

        const totalCols = 3 + n + 1; // cB, XB, b, vars..., theta
        const totalRows = 1 + m + 1; // cj, basis rows, sigma

        const width = totalCols * colWidth;
        const height = totalRows * rowHeight;

        svg.attr('width', width).attr('height', height);

        // 1. 绘制网格背景
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

        // 2. 高亮主元、入基列、离基行
        if (data.entering && data.leaving) {
            const enteringColIdx = parseInt(data.entering.substring(1)) - 1 + 3;
            const leavingRowIdx = data.basis.indexOf(data.leaving) + 1;

            // 入基列
            svg.append('rect')
                .attr('x', enteringColIdx * colWidth)
                .attr('y', 0)
                .attr('width', colWidth)
                .attr('height', height)
                .attr('fill', 'rgba(255, 235, 59, 0.1)');

            // 离基行
            svg.append('rect')
                .attr('x', 0)
                .attr('y', leavingRowIdx * rowHeight)
                .attr('width', width)
                .attr('height', rowHeight)
                .attr('fill', 'rgba(255, 235, 59, 0.1)');

            // 主元单元格
            svg.append('rect')
                .attr('x', enteringColIdx * colWidth)
                .attr('y', leavingRowIdx * rowHeight)
                .attr('width', colWidth)
                .attr('height', rowHeight)
                .attr('fill', '#fff9c4');
        }

        // 3. 填充文本
        const cells = [];

        // 第0行: cj
        cells.push({r: 0, c: 0, val: 'cj'});
        cells.push({r: 0, c: 1, val: ''});
        cells.push({r: 0, c: 2, val: ''});
        for (let j = 0; j < n; j++) cells.push({r: 0, c: j+3, val: data.cj[j].toFixed(2)});
        cells.push({r: 0, c: totalCols-1, val: 'θ'});

        // 主体行
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

        // 最后一行: sigma
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

    /**
     * 二维可视化 (n=2)
     */
    function render2DViz(c, a, b, steps, solveType) {
        viz2dContainer.classList.remove('hidden');
        const container = d3.select('#lp-viz');
        container.selectAll('*').remove();

        const margin = {top: 20, right: 30, bottom: 40, left: 40};
        const width = container.node().clientWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // 确定坐标轴范围
        let maxX = 5, maxY = 5;
        // 根据约束确定范围
        a.forEach((row, i) => {
            if (row[0] > 0) maxX = Math.max(maxX, b[i] / row[0]);
            if (row[1] > 0) maxY = Math.max(maxY, b[i] / row[1]);
        });
        maxX *= 1.2; maxY *= 1.2;

        const xScale = d3.scaleLinear().domain([0, maxX]).range([0, width]);
        const yScale = d3.scaleLinear().domain([0, maxY]).range([height, 0]);

        // 坐标轴
        svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(xScale));
        svg.append('g').call(d3.axisLeft(yScale));

        // 绘制约束线
        a.forEach((row, i) => {
            let points = [];
            if (row[0] === 0 && row[1] !== 0) {
                points = [[0, b[i]/row[1]], [maxX, b[i]/row[1]]];
            } else if (row[1] === 0 && row[0] !== 0) {
                points = [[b[i]/row[0], 0], [b[i]/row[0], maxY]];
            } else if (row[0] !== 0 && row[1] !== 0) {
                points = [[0, b[i]/row[1]], [b[i]/row[0], 0]];
            }

            if (points.length > 0) {
                svg.append('line')
                    .attr('x1', xScale(points[0][0]))
                    .attr('y1', yScale(points[0][1]))
                    .attr('x2', xScale(points[1][0]))
                    .attr('y2', yScale(points[1][1]))
                    .attr('stroke', '#ccc')
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '4');
            }
        });

        // 绘制迭代路径
        const pathData = [];
        steps.forEach(step => {
            // 从基变量和 b 计算 x1, x2
            let x1 = 0, x2 = 0;
            const x1Idx = step.basis.indexOf('x1');
            const x2Idx = step.basis.indexOf('x2');
            if (x1Idx !== -1) x1 = step.b[x1Idx];
            if (x2Idx !== -1) x2 = step.b[x2Idx];
            pathData.push({x: x1, y: x2, iter: step.iteration});
        });

        // 路径连线
        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y));

        svg.append('path')
            .datum(pathData)
            .attr('fill', 'none')
            .attr('stroke', 'var(--accent-color)')
            .attr('stroke-width', 2)
            .attr('d', line);

        // 路径点
        svg.selectAll('.dot')
            .data(pathData)
            .enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', 5)
            .attr('fill', 'var(--primary-color)')
            .append('title')
            .text(d => `迭代 ${d.iter}: (${d.x.toFixed(2)}, ${d.y.toFixed(2)})`);

        // 标注
        svg.append('text')
            .attr('x', width)
            .attr('y', height - 5)
            .attr('text-anchor', 'end')
            .text('x1');
        svg.append('text')
            .attr('x', 5)
            .attr('y', 0)
            .text('x2');
    }
});
