(function () {
    'use strict';

    // ==================== 1. 网络拓扑图 ====================
    function initNetworkDiagram() {
        var container = document.getElementById('network-viz');
        if (!container) return;

        var h = 380;
        var m = {top: 50, right: 40, bottom: 30, left: 40};

        var svg = d3.select('#network-viz')
            .append('svg')
            .attr('viewBox', '0 0 700 ' + h);

        var g = svg.append('g');

        var layers = [
            {label: '输入层', nodes: ['x\u2081', 'x\u2082', 'x\u2083', 'x\u2084'], x: 80, color: '#42A5F5', nodeColor: '#E3F2FD'},
            {label: '隐藏层 1', nodes: ['h\u2081', 'h\u2082', 'h\u2083', 'h\u2084', 'h\u2085'], x: 280, color: '#EF5350', nodeColor: '#FFEBEE'},
            {label: '隐藏层 2', nodes: ['h\u2081', 'h\u2082', 'h\u2083', 'h\u2084', 'h\u2085'], x: 470, color: '#EF5350', nodeColor: '#FFEBEE'},
            {label: '输出层', nodes: ['\u0177\u2081', '\u0177\u2082'], x: 620, color: '#66BB6A', nodeColor: '#E8F5E9'},
        ];

        var nodeRadius = 18;
        var totalH = h - m.top - m.bottom;

        // 计算每层节点的 y 坐标
        var layerNodes = layers.map(function (l) {
            var nodeCount = l.nodes.length;
            var spacing = totalH / (nodeCount + 1);
            return l.nodes.map(function (_, i) {
                return {x: l.x, y: m.top + spacing * (i + 1)};
            });
        });

        // 绘制层间连线
        for (var li = 0; li < layers.length - 1; li++) {
            var srcNodes = layerNodes[li];
            var tgtNodes = layerNodes[li + 1];
            srcNodes.forEach(function (s) {
                tgtNodes.forEach(function (t) {
                    g.append('line')
                        .attr('x1', s.x)
                        .attr('y1', s.y)
                        .attr('x2', t.x)
                        .attr('y2', t.y)
                        .attr('stroke', '#D7CCC8')
                        .attr('stroke-width', 0.8)
                        .attr('opacity', 0.6);
                });
            });
        }

        // 绘制节点
        layerNodes.forEach(function (nl, li) {
            var layer = layers[li];
            nl.forEach(function (n, ni) {
                g.append('circle')
                    .attr('cx', n.x)
                    .attr('cy', n.y)
                    .attr('r', nodeRadius)
                    .attr('fill', layer.nodeColor)
                    .attr('stroke', layer.color)
                    .attr('stroke-width', 2);

                g.append('text')
                    .attr('x', n.x)
                    .attr('y', n.y + 4)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '12px')
                    .attr('fill', '#4E342E')
                    .attr('font-weight', 'bold')
                    .text(layer.nodes[ni]);
            });

            // 层标签
            g.append('text')
                .attr('x', layer.x)
                .attr('y', totalH + m.top + 5)
                .attr('text-anchor', 'middle')
                .attr('font-size', '13px')
                .attr('fill', layer.color)
                .attr('font-weight', 'bold')
                .text(layer.label);
        });

        // 权值标注
        g.append('text')
            .attr('x', (layers[0].x + layers[1].x) / 2)
            .attr('y', m.top - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '13px')
            .attr('fill', '#8D6E63')
            .attr('font-style', 'italic')
            .text('W\u00B9, b\u00B9');

        g.append('text')
            .attr('x', (layers[1].x + layers[2].x) / 2)
            .attr('y', m.top - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '13px')
            .attr('fill', '#8D6E63')
            .attr('font-style', 'italic')
            .text('W\u00B2, b\u00B2');

        g.append('text')
            .attr('x', (layers[2].x + layers[3].x) / 2)
            .attr('y', m.top - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '13px')
            .attr('fill', '#8D6E63')
            .attr('font-style', 'italic')
            .text('W\u00B3, b\u00B3');
    }


    // ==================== 2. 激活函数切换 ====================
    var activeFunc = 'sigmoid';

    var activationData = {
        sigmoid: {
            name: 'Sigmoid',
            func: function (x) { return 1 / (1 + Math.exp(-x)); },
            deriv: function (x) { var s = 1 / (1 + Math.exp(-x)); return s * (1 - s); },
            yDomain: [-0.1, 1.1],
            formulaText: '\\( \\sigma(x) = \\dfrac{1}{1 + e^{-x}} \\)',
            derivText: '\\( \\sigma\\,\'(x) = \\sigma(x)(1 - \\sigma(x)) \\)',
            notes: '<strong>优点：</strong>输出范围 (0, 1)，平滑可导，适合二分类输出层。<br><strong>缺点：</strong>输入绝对值较大时导数值趋近于 0，易导致<strong>梯度消失</strong>；输出非零中心化，影响梯度更新效率。',
        },
        tanh: {
            name: 'tanh',
            func: function (x) { return Math.tanh(x); },
            deriv: function (x) { var t = Math.tanh(x); return 1 - t * t; },
            yDomain: [-1.1, 1.1],
            formulaText: '\\( \\tanh(x) = \\dfrac{e^x - e^{-x}}{e^x + e^{-x}} \\)',
            derivText: '\\( \\tanh\\,\'(x) = 1 - \\tanh^2(x) \\)',
            notes: '<strong>优点：</strong>输出范围 (-1, 1)，零中心化，梯度更新效率优于 Sigmoid。<br><strong>缺点：</strong>同样存在梯度饱和问题，|x| 较大时导数趋近于 0。',
        },
        relu: {
            name: 'ReLU',
            func: function (x) { return x > 0 ? x : 0; },
            deriv: function (x) { return x > 0 ? 1 : 0; },
            yDomain: [-0.5, 5.5],
            formulaText: '\\( \\text{ReLU}(x) = \\max(0, x) \\)',
            derivText: '\\( \\text{ReLU}\\ \'(x) = \\begin{cases} 1, & x > 0 \\\\ 0, & x \\leq 0 \\end{cases} \\)',
            notes: '<strong>优点：</strong>计算简单高效，正区间导数恒为 1，缓解梯度消失，是隐藏层的默认选择。<br><strong>缺点：</strong>负区间输出为 0，导数也为 0，可能导致神经元永久"死亡"。',
        },
        leakyrelu: {
            name: 'Leaky ReLU',
            func: function (x) { return x > 0 ? x : 0.01 * x; },
            deriv: function (x) { return x > 0 ? 1 : 0.01; },
            yDomain: [-0.5, 5.5],
            formulaText: '\\( \\text{LeakyReLU}(x) = \\max(\\alpha x, x),\\ \\alpha = 0.01 \\)',
            derivText: '\\( \\text{LeakyReLU}\\ \'(x) = \\begin{cases} 1, & x > 0 \\\\ \\alpha, & x \\leq 0 \\end{cases} \\)',
            notes: '<strong>优点：</strong>在 ReLU 基础上为负区间引入小斜率 \\(\\alpha = 0.01\\)，缓解神经元死亡问题。<br><strong>缺点：</strong>负区间斜率固定，对某些任务不如 PReLU（可学习的 \\(\\alpha\\)）灵活。',
        },
    };

    function drawActivation() {
        var svg = d3.select('#activation-canvas svg');
        if (svg.empty()) return;
        var g = svg.select('g.chart-area');
        if (g.empty()) return;

        var data = activationData[activeFunc];
        var w = 600, h = 300, m = {top: 25, right: 30, bottom: 35, left: 45};
        var pw = w - m.left - m.right;
        var ph = h - m.top - m.bottom;

        var xDomain = [-5, 5];
        var yDomain = data.yDomain;

        var xScale = d3.scaleLinear().domain(xDomain).range([0, pw]);
        var yScale = d3.scaleLinear().domain(yDomain).range([ph, 0]);

        // 生成曲线采样点
        var steps = 300;
        var funcPoints = [];
        var derivPoints = [];
        for (var i = 0; i <= steps; i++) {
            var x = xDomain[0] + (xDomain[1] - xDomain[0]) * i / steps;
            funcPoints.push({x: x, y: data.func(x)});
            derivPoints.push({x: x, y: data.deriv(x)});
        }

        var lineFunc = d3.line()
            .x(function (d) { return xScale(d.x); })
            .y(function (d) { return yScale(d.y); });

        // 清空后重绘
        g.selectAll('*').remove();

        var xAxisCall = d3.axisBottom(xScale).ticks(5);
        var yAxisCall = d3.axisLeft(yScale).ticks(5);

        var zeroY = yScale(0);
        if (zeroY < 0) zeroY = 0;
        if (zeroY > ph) zeroY = ph;

        g.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(0,' + zeroY + ')')
            .call(xAxisCall);

        g.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(' + xScale(0) + ',0)')
            .call(yAxisCall);

        // 零线
        g.append('line')
            .attr('x1', 0).attr('x2', pw)
            .attr('y1', zeroY).attr('y2', zeroY)
            .attr('stroke', '#BCAAA4')
            .attr('stroke-width', 0.5)
            .attr('stroke-dasharray', '4,4');

        // 函数曲线（实线）
        g.append('path')
            .datum(funcPoints)
            .attr('d', lineFunc)
            .attr('fill', 'none')
            .attr('stroke', '#D84315')
            .attr('stroke-width', 2.5);

        // 导数曲线（虚线）
        g.append('path')
            .datum(derivPoints)
            .attr('d', lineFunc)
            .attr('fill', 'none')
            .attr('stroke', '#FF8F00')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '6,4');
    }

    function initActivationSwitch() {
        var canvas = document.getElementById('activation-canvas');
        if (!canvas) return;

        var w = 600, h = 300, m = {top: 25, right: 30, bottom: 35, left: 45};

        var svg = d3.select('#activation-canvas')
            .append('svg')
            .attr('viewBox', '0 0 ' + w + ' ' + h);

        svg.append('g')
            .attr('class', 'chart-area')
            .attr('transform', 'translate(' + m.left + ',' + m.top + ')');

        // 图例放在右上方
        svg.append('g').attr('class', 'legend');

        drawActivation();
        drawActivationLegend();

        // 按钮事件
        ['sigmoid', 'tanh', 'relu', 'leakyrelu'].forEach(function (id) {
            var btn = document.getElementById('btn-' + id);
            if (!btn) return;
            btn.addEventListener('click', function () {
                if (activeFunc === id) return;
                activeFunc = id;
                updateActivationUI();
            });
        });

        updateActivationUI();
    }

    function drawActivationLegend() {
        var svg = d3.select('#activation-canvas svg');
        var legend = svg.select('g.legend');
        legend.selectAll('*').remove();
        legend.attr('transform', 'translate(20, 12)');

        var items = [
            {label: '函数', color: '#D84315', dash: false},
            {label: '导数', color: '#FF8F00', dash: true},
        ];

        items.forEach(function (item, i) {
            var g = legend.append('g').attr('transform', 'translate(0,' + (i * 22) + ')');

            if (item.dash) {
                g.append('line')
                    .attr('x1', 0).attr('x2', 28)
                    .attr('y1', 6).attr('y2', 6)
                    .attr('stroke', item.color)
                    .attr('stroke-width', 2.5)
                    .attr('stroke-dasharray', '6,4');
            } else {
                g.append('line')
                    .attr('x1', 0).attr('x2', 28)
                    .attr('y1', 6).attr('y2', 6)
                    .attr('stroke', item.color)
                    .attr('stroke-width', 2.5);
            }

            g.append('text')
                .attr('x', 36)
                .attr('y', 10)
                .attr('font-size', '12px')
                .attr('fill', '#4E342E')
                .text(item.label);
        });
    }

    function updateActivationUI() {
        var data = activationData[activeFunc];

        // 切换按钮活跃态
        ['sigmoid', 'tanh', 'relu', 'leakyrelu'].forEach(function (id) {
            var btn = document.getElementById('btn-' + id);
            if (!btn) return;
            btn.classList.toggle('active', id === activeFunc);
        });

        // 更新描述
        var desc = document.getElementById('activation-desc');
        if (desc) {
            var formulaEl = desc.querySelector('.formula');
            var notesEl = desc.querySelector('.notes');
            if (formulaEl) formulaEl.innerHTML = data.formulaText + '<br>' + data.derivText;
            if (notesEl) notesEl.innerHTML = data.notes;
        }

        drawActivation();

        // 重新渲染 LaTeX
        if (window.MathJax && window.MathJax.typesetPromise) {
            var descElement = document.getElementById('activation-desc');
            if (descElement) MathJax.typesetPromise([descElement]);
        }
    }


    // ==================== 3. 优化器切换 ====================
    var activeOptimizer = 'momentum';

    var optimizerData = {
        momentum: {
            name: 'Momentum',
            formula: '\
                \\[ v_t = \\beta v_{t-1} + (1 - \\beta) \\nabla J(\\theta_t) \\] \
                \\[ \\theta_{t+1} = \\theta_t - \\eta \\, v_t \\] \
            ',
            notes: '在 SGD 基础上引入<strong>动量项</strong> \\(v_t\\)（通常 \\(\\beta = 0.9\\)），累积历史梯度方向，加速收敛并减少震荡。类似小球滚下曲面，惯性帮助它冲过局部极小点和平坦区域。',
        },
        rmsprop: {
            name: 'RMSprop',
            formula: '\
                \\[ s_t = \\beta s_{t-1} + (1 - \\beta) (\\nabla J(\\theta_t))^2 \\] \
                \\[ \\theta_{t+1} = \\theta_t - \\eta \\frac{\\nabla J(\\theta_t)}{\\sqrt{s_t + \\varepsilon}} \\] \
            ',
            notes: '对每个参数自适应调整学习率：梯度平方的指数移动平均 \\(s_t\\) 用于缩放步长。梯度大的参数降低学习率，梯度小的增大学习率，<strong>解决不同参数尺度不一致</strong>的问题。\\(\\varepsilon = 10^{-8}\\) 防止除零。',
        },
        adam: {
            name: 'Adam',
            formula: '\
                \\[ m_t = \\beta_1 m_{t-1} + (1 - \\beta_1) \\nabla J(\\theta_t) \\] \
                \\[ v_t = \\beta_2 v_{t-1} + (1 - \\beta_2) (\\nabla J(\\theta_t))^2 \\] \
                \\[ \\hat{m}_t = \\frac{m_t}{1 - \\beta_1^t},\\quad \\hat{v}_t = \\frac{v_t}{1 - \\beta_2^t} \\] \
                \\[ \\theta_{t+1} = \\theta_t - \\eta \\frac{\\hat{m}_t}{\\sqrt{\\hat{v}_t} + \\varepsilon} \\] \
            ',
            notes: '结合 Momentum 和 RMSprop：\\(m_t\\) 为一阶矩估计（动量），\\(v_t\\) 为二阶矩估计（自适应学习率）。<strong>偏差校正</strong>（\\(\\hat{m}_t, \\hat{v}_t\\)）解决初期估计偏差。默认 \\(\\beta_1 = 0.9, \\beta_2 = 0.999\\)，目前最广泛使用的优化器。',
        },
    };

    function initOptimizerSwitch() {
        ['momentum', 'rmsprop', 'adam'].forEach(function (id) {
            var btn = document.getElementById('btn-' + id);
            if (!btn) return;
            btn.addEventListener('click', function () {
                if (activeOptimizer === id) return;
                activeOptimizer = id;
                updateOptimizerUI();
            });
        });
        updateOptimizerUI();
    }

    function updateOptimizerUI() {
        var data = optimizerData[activeOptimizer];

        ['momentum', 'rmsprop', 'adam'].forEach(function (id) {
            var btn = document.getElementById('btn-' + id);
            if (!btn) return;
            btn.classList.toggle('active', id === activeOptimizer);
        });

        var formulaEl = document.getElementById('optimizer-formula');
        var notesEl = document.getElementById('optimizer-desc');
        if (formulaEl) formulaEl.innerHTML = data.formula;
        if (notesEl) notesEl.innerHTML = data.notes;

        if (window.MathJax && window.MathJax.typesetPromise) {
            var container = document.getElementById('optimizer-switch');
            if (container) MathJax.typesetPromise([container]);
        }
    }


    // ==================== 4. 学习率调度器切换 ====================
    var activeScheduler = 'steplr';

    var schedulerData = {
        steplr: {
            name: 'StepLR',
            func: function (t) {
                var step = 30;
                return Math.pow(0.5, Math.floor(t / step));
            },
            formulaText: '\\( \\eta_t = \\eta_0 \\cdot \\gamma^{\\lfloor t / \\text{step} \\rfloor} \\)',
            notes: '每间隔 <strong>step</strong> 个 epoch，学习率乘以衰减因子 \\(\\gamma\\)（图上 \\(\\gamma = 0.5\\)，step = 30）。适用于需要分阶段降低学习率的场景，如每 30 轮将学习率减半。',
        },
        exponentiallr: {
            name: 'ExponentialLR',
            func: function (t) {
                return Math.pow(0.97, t);
            },
            formulaText: '\\( \\eta_t = \\eta_0 \\cdot \\gamma^t \\)',
            notes: '每个 epoch 学习率乘以恒定的衰减因子 \\(\\gamma\\)（图上 \\(\\gamma = 0.97\\)），呈<strong>指数连续衰减</strong>。比 StepLR 更平滑，适合需要持续降低学习率的训练。',
        },
        cosine: {
            name: 'CosineAnnealingLR',
            func: function (t) {
                var T = 100;
                var etaMin = 0.001;
                return etaMin + 0.5 * (1 - etaMin) * (1 + Math.cos(Math.PI * t / T));
            },
            formulaText: '\\( \\eta_t = \\eta_{\\min} + \\dfrac{\\eta_0 - \\eta_{\\min}}{2}\\left(1 + \\cos\\left(\\dfrac{\\pi t}{T}\\right)\\right) \\)',
            notes: '学习率按<strong>余弦曲线</strong>从 \\(\\eta_0\\) 平滑衰减至 \\(\\eta_{\\min}\\)。在周期开始时缓慢下降，中间加速，末尾趋于平缓。常与热重启（warm restart）结合使用，适合需要充分探索的复杂损失面。',
        },
    };

    function drawScheduler() {
        var svg = d3.select('#scheduler-canvas svg');
        if (svg.empty()) return;
        var g = svg.select('g.chart-area');
        if (g.empty()) return;

        var data = schedulerData[activeScheduler];
        var w = 600, h = 300, m = {top: 25, right: 30, bottom: 40, left: 55};
        var pw = w - m.left - m.right;
        var ph = h - m.top - m.bottom;

        var xScale = d3.scaleLinear().domain([0, 100]).range([0, pw]);
        var yScale = d3.scaleLinear().domain([0, 1]).range([ph, 0]);

        var steps = 200;
        var pts = [];
        for (var i = 0; i <= steps; i++) {
            var t = 100 * i / steps;
            pts.push({x: t, y: data.func(t)});
        }

        var lineFunc = d3.line()
            .x(function (d) { return xScale(d.x); })
            .y(function (d) { return yScale(d.y); });

        g.selectAll('*').remove();

        var xAxisCall = d3.axisBottom(xScale).ticks(5);
        var yAxisCall = d3.axisLeft(yScale).ticks(5);

        g.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(0,' + ph + ')')
            .call(xAxisCall);

        g.append('g')
            .attr('class', 'axis')
            .call(yAxisCall);

        // x 轴标签
        g.append('text')
            .attr('x', pw / 2)
            .attr('y', ph + 32)
            .attr('text-anchor', 'middle')
            .attr('font-size', '13px')
            .attr('fill', '#8D6E63')
            .text('Epoch');

        // y 轴标签
        g.append('text')
            .attr('x', -36)
            .attr('y', ph / 2)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90,' + (-36) + ',' + (ph / 2) + ')')
            .attr('font-size', '13px')
            .attr('fill', '#8D6E63')
            .text('η / η₀');

        g.append('path')
            .datum(pts)
            .attr('d', lineFunc)
            .attr('fill', 'none')
            .attr('stroke', '#D84315')
            .attr('stroke-width', 2.5);
    }

    function initSchedulerSwitch() {
        var canvas = document.getElementById('scheduler-canvas');
        if (!canvas) return;

        var w = 600, h = 300, m = {top: 25, right: 30, bottom: 40, left: 55};

        var svg = d3.select('#scheduler-canvas')
            .append('svg')
            .attr('viewBox', '0 0 ' + w + ' ' + h);

        svg.append('g')
            .attr('class', 'chart-area')
            .attr('transform', 'translate(' + m.left + ',' + m.top + ')');

        drawScheduler();

        ['steplr', 'exponentiallr', 'cosine'].forEach(function (id) {
            var btn = document.getElementById('btn-' + id);
            if (!btn) return;
            btn.addEventListener('click', function () {
                if (activeScheduler === id) return;
                activeScheduler = id;
                updateSchedulerUI();
            });
        });

        updateSchedulerUI();
    }

    function updateSchedulerUI() {
        var data = schedulerData[activeScheduler];

        ['steplr', 'exponentiallr', 'cosine'].forEach(function (id) {
            var btn = document.getElementById('btn-' + id);
            if (!btn) return;
            btn.classList.toggle('active', id === activeScheduler);
        });

        var desc = document.getElementById('scheduler-desc');
        if (desc) {
            var formulaEl = desc.querySelector('.formula');
            var notesEl = desc.querySelector('.notes');
            if (formulaEl) formulaEl.innerHTML = data.formulaText;
            if (notesEl) notesEl.innerHTML = data.notes;
        }

        drawScheduler();

        if (window.MathJax && window.MathJax.typesetPromise) {
            var descElement = document.getElementById('scheduler-desc');
            if (descElement) MathJax.typesetPromise([descElement]);
        }
    }


    // ==================== 入口 ====================
    document.addEventListener('DOMContentLoaded', function () {
        initNetworkDiagram();
        initActivationSwitch();
        initOptimizerSwitch();
        initSchedulerSwitch();
    });
})();
