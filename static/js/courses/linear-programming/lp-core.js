/**
 * 线性规划核心算法库 (lp-core.js)
 * 供单纯形法和两阶段法复用
 */

const LPCore = {
    EPSILON: 1e-10,
    MAX_ITERATIONS: 1000,

    // ========== 核心算法函数 ==========
    
    /**
     * 计算检验数 sigma
     * @param {Array} cj - 目标函数系数
     * @param {Array} cB - 基变量系数
     * @param {Array} A - 约束矩阵
     * @returns {Array} 检验数数组
     */
    calculateSigma(cj, cB, A) {
        const m = A.length;
        const n = cj.length;
        const sigma = [];
        
        for (let j = 0; j < n; j++) {
            let zj = 0;
            for (let i = 0; i < m; i++) {
                zj += cB[i] * A[i][j];
            }
            sigma.push(cj[j] - zj);
        }
        return sigma;
    },

    /**
     * 选择入基变量
     * @param {Array} sigma - 检验数数组
     * @param {string} solveType - 'max' 或 'min'
     * @param {number} epsilon - 精度阈值
     * @returns {number} 入基变量索引，-1表示已达最优
     */
    selectEnteringVariable(sigma, solveType, epsilon = this.EPSILON) {
        let enteringIdx = -1;
        
        if (solveType === 'max') {
            let maxSigma = -Infinity;
            for (let j = 0; j < sigma.length; j++) {
                if (sigma[j] > epsilon && sigma[j] > maxSigma) {
                    maxSigma = sigma[j];
                    enteringIdx = j;
                }
            }
        } else {
            let minSigma = Infinity;
            for (let j = 0; j < sigma.length; j++) {
                if (sigma[j] < -epsilon && sigma[j] < minSigma) {
                    minSigma = sigma[j];
                    enteringIdx = j;
                }
            }
        }
        
        return enteringIdx;
    },

    /**
     * 比值测试
     * @param {Array} A - 约束矩阵
     * @param {Array} b - 右端项
     * @param {number} enteringIdx - 入基变量索引
     * @param {number} epsilon - 精度阈值
     * @returns {Object} { leavingIdx, theta, isUnbounded, minTheta }
     */
    ratioTest(A, b, enteringIdx, epsilon = this.EPSILON) {
        const theta = [];
        let leavingIdx = -1;
        let minTheta = Infinity;
        let isUnbounded = true;

        for (let i = 0; i < b.length; i++) {
            if (A[i][enteringIdx] > epsilon) {
                isUnbounded = false;
                const t = b[i] / A[i][enteringIdx];
                theta.push(t);
                if (t < minTheta - epsilon) {
                    minTheta = t;
                    leavingIdx = i;
                }
            } else {
                theta.push(null);
            }
        }

        return { leavingIdx, theta, isUnbounded, minTheta };
    },

    /**
     * 主元消去
     * @param {Array} A - 约束矩阵（会被修改）
     * @param {Array} b - 右端项（会被修改）
     * @param {Array} basis - 基变量数组（会被修改）
     * @param {Array} cB - 基变量系数（会被修改）
     * @param {number} enteringIdx - 入基变量索引
     * @param {number} leavingIdx - 离基变量索引
     * @param {Array} cj - 目标函数系数
     */
    pivotOperation(A, b, basis, cB, enteringIdx, leavingIdx, cj) {
        const pivot = A[leavingIdx][enteringIdx];
        const m = A.length;
        const n = cj.length;

        // 主元行归一化
        b[leavingIdx] /= pivot;
        for (let j = 0; j < n; j++) {
            A[leavingIdx][j] /= pivot;
        }

        // 消去其他行
        for (let i = 0; i < m; i++) {
            if (i !== leavingIdx) {
                const factor = A[i][enteringIdx];
                if (Math.abs(factor) > 1e-15) {
                    b[i] -= factor * b[leavingIdx];
                    for (let j = 0; j < n; j++) {
                        A[i][j] -= factor * A[leavingIdx][j];
                    }
                }
            }
        }

        // 更新基
        basis[leavingIdx] = `x${enteringIdx + 1}`;
        cB[leavingIdx] = cj[enteringIdx];
    },

    /**
     * 检查是否所有人工变量已出基
     * @param {Array} basis - 基变量数组
     * @param {Array} artificialIndices - 人工变量索引列表
     * @returns {boolean}
     */
    allArtificialVarsOut(basis, artificialIndices) {
        const artificialNames = artificialIndices.map(idx => `x${idx + 1}`);
        return !basis.some(b => artificialNames.includes(b));
    },

    /**
     * 获取基中剩余的人工变量
     * @param {Array} basis - 基变量数组
     * @param {Array} artificialIndices - 人工变量索引列表
     * @returns {Array} 剩余人工变量名称列表
     */
    getRemainingArtificialVars(basis, artificialIndices) {
        const artificialNames = artificialIndices.map(idx => `x${idx + 1}`);
        return basis.filter(b => artificialNames.includes(b));
    },

    /**
     * 第一阶段到第二阶段的过渡准备
     * 处理基中剩余的人工变量
     */
    preparePhase2(phase1Result, artificialIndices, n, originalCj) {
        let currentA = phase1Result.finalA.map(r => [...r]);
        let currentB = [...phase1Result.finalB];
        let currentBasis = [...phase1Result.finalBasis];
        
        const m = currentA.length;
        const artificialNames = artificialIndices.map(idx => `x${idx + 1}`);

        for (let i = 0; i < m; i++) {
            if (artificialNames.includes(currentBasis[i])) {
                let foundReplacement = false;
                for (let j = 0; j < n; j++) {
                    if (!currentBasis.includes(`x${j + 1}`) && Math.abs(currentA[i][j]) > this.EPSILON) {
                        // 虚拟一个 cj 进行旋转
                        const dummyCj = new Array(currentA[0].length).fill(0);
                        const dummyCB = new Array(m).fill(0);
                        this.pivotOperation(currentA, currentB, currentBasis, dummyCB, j, i, dummyCj);
                        foundReplacement = true;
                        break;
                    }
                }
                // 如果没找到替换变量，说明该行是冗余的，在实际计算中只要保持 cB=0 即可
            }
        }

        const A2 = currentA.map(row => row.slice(0, n));
        const b2 = [...currentB];
        const basis2 = [...currentBasis];
        const cB2 = basis2.map(name => {
            const idx = parseInt(name.substring(1)) - 1;
            return idx < n ? (originalCj[idx] || 0) : 0;
        });

        return { A: A2, b: b2, basis: basis2, cB: cB2 };
    },

    /**
     * 计算目标函数值
     * @param {Array} cB - 基变量系数
     * @param {Array} b - 右端项
     * @returns {number}
     */
    calculateObjectiveValue(cB, b) {
        return cB.reduce((sum, cb, i) => sum + cb * b[i], 0);
    },

    /**
     * 提取解向量
     * @param {Object} finalStep - 最终迭代步骤
     * @param {number} n - 原问题变量数
     * @returns {Object} 解向量 {x1, x2, ...}
     */
    extractSolution(finalStep, n) {
        const solution = {};
        for (let j = 1; j <= n; j++) {
            const idx = finalStep ? finalStep.basis.indexOf(`x${j}`) : -1;
            solution[`x${j}`] = idx !== -1 ? Number(finalStep.b[idx]) : 0;
        }
        return solution;
    },

    /**
     * 检测循环（通过检查基变量组合是否重复）
     * @param {Array} steps - 历史步骤
     * @param {Array} currentBasis - 当前基
     * @returns {boolean}
     */
    detectCycle(steps, currentBasis) {
        const basisKey = currentBasis.sort().join(',');
        for (let i = 0; i < steps.length; i++) {
            const stepKey = steps[i].basis.sort().join(',');
            if (stepKey === basisKey) {
                return true;
            }
        }
        return false;
    },

    /**
     * 通用单纯形迭代
     * @param {Object} params 迭代参数
     * @returns {Object} 迭代结果
     */
    iterateSimplex(params) {
        const {
            cj,
            basis,
            cB,
            A,
            b,
            solveType,
            phase = 1,
            maxIterations = this.MAX_ITERATIONS,
            epsilon = this.EPSILON,
            artificialIndices = [],
            n: originalN = null  // 原问题变量数（Phase II使用）
        } = params;

        let steps = [];
        let iteration = 0;
        let finished = false;
        let status = "iterating";
        let cycleDetected = false;

        // 深拷贝避免修改原始数据
        const currentA = A.map(r => [...r]);
        const currentB = [...b];
        const currentBasis = [...basis];
        const currentCB = [...cB];

        while (!finished && iteration < maxIterations) {
            iteration++;

            // 计算检验数
            const sigma = this.calculateSigma(cj, currentCB, currentA);

            // Phase I 特殊处理：检查人工变量是否全部出基
            if (phase === 1 && artificialIndices.length > 0) {
                const remainingArtificial = this.getRemainingArtificialVars(currentBasis, artificialIndices);
                const wValue = this.calculateObjectiveValue(currentCB, currentB);
                
                // 如果人工变量全部出基且 w ≈ 0，可以提前结束
                if (remainingArtificial.length === 0 && Math.abs(wValue) < epsilon) {
                    // 继续迭代直到检验数满足最优条件
                }
            }

            // 选择入基变量
            const enteringIdx = this.selectEnteringVariable(sigma, solveType, epsilon);

            if (enteringIdx === -1) {
                status = "optimal";
                finished = true;
                
                const finalW = phase === 1 
                    ? this.calculateObjectiveValue(currentCB, currentB)
                    : null;
                    
                steps.push({
                    phase,
                    iteration,
                    cj: [...cj],
                    basis: [...currentBasis],
                    cB: [...currentCB],
                    b: [...currentB],
                    a: currentA.map(r => [...r]),
                    sigma: [...sigma],
                    entering: null,
                    leaving: null,
                    theta: null,
                    status: "optimal",
                    artificialVars: phase === 1 
                        ? this.getRemainingArtificialVars(currentBasis, artificialIndices)
                        : [],
                    wValue: finalW
                });
                break;
            }

            // 检测循环
            if (this.detectCycle(steps, currentBasis)) {
                status = "cycle";
                cycleDetected = true;
                finished = true;
                
                steps.push({
                    phase,
                    iteration,
                    cj: [...cj],
                    basis: [...currentBasis],
                    cB: [...currentCB],
                    b: [...currentB],
                    a: currentA.map(r => [...r]),
                    sigma: [...sigma],
                    entering: `x${enteringIdx + 1}`,
                    leaving: null,
                    theta: null,
                    status: "cycle",
                    artificialVars: phase === 1 
                        ? this.getRemainingArtificialVars(currentBasis, artificialIndices)
                        : [],
                    wValue: phase === 1 ? this.calculateObjectiveValue(currentCB, currentB) : null
                });
                break;
            }

            // 比值测试
            const { leavingIdx, theta, isUnbounded } = this.ratioTest(
                currentA, currentB, enteringIdx, epsilon
            );

            if (isUnbounded) {
                status = "unbounded";
                finished = true;
                
                steps.push({
                    phase,
                    iteration,
                    cj: [...cj],
                    basis: [...currentBasis],
                    cB: [...currentCB],
                    b: [...currentB],
                    a: currentA.map(r => [...r]),
                    sigma: [...sigma],
                    entering: `x${enteringIdx + 1}`,
                    leaving: null,
                    theta,
                    status: "unbounded",
                    artificialVars: phase === 1 
                        ? this.getRemainingArtificialVars(currentBasis, artificialIndices)
                        : [],
                    wValue: phase === 1 ? this.calculateObjectiveValue(currentCB, currentB) : null
                });
                break;
            }

            // 记录当前步骤
            steps.push({
                phase,
                iteration,
                cj: [...cj],
                basis: [...currentBasis],
                cB: [...currentCB],
                b: [...currentB],
                a: currentA.map(r => [...r]),
                sigma: [...sigma],
                entering: `x${enteringIdx + 1}`,
                leaving: currentBasis[leavingIdx],
                theta,
                status: "iterating",
                artificialVars: phase === 1 
                    ? this.getRemainingArtificialVars(currentBasis, artificialIndices)
                    : [],
                wValue: phase === 1 ? this.calculateObjectiveValue(currentCB, currentB) : null
            });

            // 主元消去
            this.pivotOperation(currentA, currentB, currentBasis, currentCB, 
                              enteringIdx, leavingIdx, cj);
        }

        if (iteration >= maxIterations && !finished) {
            status = "max_iter";
        }

        return {
            steps,
            finalBasis: currentBasis,
            finalA: currentA,
            finalB: currentB,
            finalCB: currentCB,
            status,
            cycleDetected,
            finalW: phase === 1 
                ? this.calculateObjectiveValue(currentCB, currentB)
                : null,
            finalObjectiveValue: phase === 2
                ? this.calculateObjectiveValue(currentCB, currentB)
                : null
        };
    },

    /**
     * 渲染单纯形表 SVG（供复用）
     * @param {Object} svg - D3 SVG 选择器
     * @param {Object} data - 迭代步骤数据
     */
    renderSimplexTable(svg, data) {
        const colWidth = 70;
        const rowHeight = 30;
        const n = data.cj.length;
        const m = data.basis.length;

        const totalCols = 3 + n + 1;
        const totalRows = 1 + m + 1;

        const width = totalCols * colWidth;
        const height = totalRows * rowHeight;

        svg.attr('width', width).attr('height', height);

        // 背景网格
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

        // 高亮入基列和离基行
        if (data.entering && data.leaving) {
            const enteringColIdx = parseInt(data.entering.substring(1)) - 1 + 3;
            const leavingRowIdx = data.basis.indexOf(data.leaving) + 1;

            // 入基列高亮（淡黄色）
            svg.append('rect')
                .attr('x', enteringColIdx * colWidth)
                .attr('y', 0)
                .attr('width', colWidth)
                .attr('height', height)
                .attr('fill', 'rgba(255, 235, 59, 0.1)');

            // 离基行高亮（淡黄色）
            svg.append('rect')
                .attr('x', 0)
                .attr('y', leavingRowIdx * rowHeight)
                .attr('width', width)
                .attr('height', rowHeight)
                .attr('fill', 'rgba(255, 235, 59, 0.1)');

            // 主元高亮（深黄色）
            svg.append('rect')
                .attr('x', enteringColIdx * colWidth)
                .attr('y', leavingRowIdx * rowHeight)
                .attr('width', colWidth)
                .attr('height', rowHeight)
                .attr('fill', '#fff9c4');
        }

        // 填充单元格内容
        const cells = [];

        // 表头行
        cells.push({r: 0, c: 0, val: 'cj'});
        cells.push({r: 0, c: 1, val: ''});
        cells.push({r: 0, c: 2, val: ''});
        for (let j = 0; j < n; j++) cells.push({r: 0, c: j+3, val: data.cj[j].toFixed(2)});
        cells.push({r: 0, c: totalCols-1, val: 'θ'});

        // 数据行
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

        // 检验数行
        const lastRowIdx = totalRows - 1;
        cells.push({r: lastRowIdx, c: 0, val: 'σj'});
        cells.push({r: lastRowIdx, c: 1, val: ''});
        cells.push({r: lastRowIdx, c: 2, val: ''});
        for (let j = 0; j < n; j++) {
            cells.push({r: lastRowIdx, c: j+3, val: data.sigma[j].toFixed(2)});
        }
        cells.push({r: lastRowIdx, c: totalCols-1, val: ''});

        // 绘制文本
        svg.selectAll('text')
            .data(cells)
            .enter()
            .append('text')
            .attr('x', d => d.c * colWidth + colWidth/2)
            .attr('y', d => d.r * rowHeight + rowHeight/2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-family', 'Consolas, Monaco, monospace')
            .attr('font-size', '12px')
            .text(d => d.val);
    },

    /**
     * 生成迭代解释文字
     * @param {Object} step - 迭代步骤
     * @param {string} solveType - 'max' 或 'min'
     * @returns {string} HTML解释文本
     */
    generateExplanation(step, solveType) {
        if (step.status === 'optimal') {
            return `<strong>结论：</strong> 所有检验数 $\sigma_j$ 均满足最优性条件（${solveType === 'max' ? '$\sigma_j \\le 0$' : '$\sigma_j \\ge 0$'}），当前基本可行解即为最优解。`;
        }
        if (step.status === 'unbounded') {
            return `<strong>结论：</strong> 选择入基变量 ${step.entering}，但其对应列系数均非正，目标函数值可无限改进，问题无界。`;
        }
        if (step.status === 'cycle') {
            return `<strong>警告：</strong> 检测到循环（基变量组合重复出现），计算终止。问题可能存在退化。`;
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
};

// 导出模块（如果支持模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LPCore;
}
