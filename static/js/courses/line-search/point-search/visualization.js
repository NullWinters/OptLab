function toSubscript(n) {
    const map = {
        '-': '\u208B',
        '0': '\u2080',
        '1': '\u2081',
        '2': '\u2082',
        '3': '\u2083',
        '4': '\u2084',
        '5': '\u2085',
        '6': '\u2086',
        '7': '\u2087',
        '8': '\u2088',
        '9': '\u2089'
    };
    return String(n).split('').map(ch => map[ch] || ch).join('');
}

export class PointSearchVisualizer {
    constructor(containerId, options = {}) {
        const container = document.getElementById(containerId);
        this.containerId = containerId;
        this.margin = options.margin || {top: 40, right: 40, bottom: 80, left: 60};
        this.width = options.width || container.clientWidth;
        this.height = options.height || container.clientHeight || 340;

        this.updateDimensions();

        this.currentExpr = null;
        this.currentDomain = [-5, 5];

        this.duration = options.duration || 400;
        this.currentHistory = [];
        this.currentAlgorithm = null;
        this.initialized = false;

        this.initSvg();
    }

    initSvg() {
        d3.select(`#${this.containerId}`).selectAll("*").remove();

        this.svg = d3.select(`#${this.containerId}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        this.plot = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleLinear().range([0, this.plotWidth]);
        this.yScale = d3.scaleLinear().range([this.plotHeight, 0]);

        this.gridLayer = this.plot.append('g').attr('class', 'grid-layer');
        this.gridX = this.gridLayer.append('g').attr('class', 'grid-x');
        this.gridY = this.gridLayer.append('g').attr('class', 'grid-y');

        this.axisLayer = this.plot.append('g').attr('class', 'axis-layer');
        this.xAxisG = this.axisLayer.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${this.plotHeight})`);
        this.yAxisG = this.axisLayer.append('g').attr('class', 'y-axis');

        this.functionLayer = this.plot.append('g').attr('class', 'function-layer');
        this.functionPath = this.functionLayer.append('path')
            .attr('fill', 'none')
            .attr('stroke', '#d84315')
            .attr('stroke-width', 2);

        this.linesLayer = this.plot.append('g').attr('class', 'lines-layer');
        this.pointsLayer = this.plot.append('g').attr('class', 'points-layer');
    }

    updateDimensions() {
        this.plotWidth = this.width - this.margin.left - this.margin.right;
        this.plotHeight = this.height - this.margin.top - this.margin.bottom;
    }

    resize() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        this.width = container.clientWidth;
        this.height = container.clientHeight || 340;
        this.updateDimensions();

        this.svg
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

        this.xScale.range([0, this.plotWidth]);
        this.yScale.range([this.plotHeight, 0]);

        if (this.currentExpr) {
            this.drawFunction(this.currentExpr, this.currentDomain);
        }
    }

    drawFunction(expr, domain) {
        if (expr) this.currentExpr = expr;
        if (domain) this.currentDomain = domain;

        const xValues = d3.range(this.currentDomain[0], this.currentDomain[1], (this.currentDomain[1] - this.currentDomain[0]) / 200);
        const data = xValues.map(x => {
            try {
                return {x, y: math.evaluate(this.currentExpr, {x})};
            } catch (e) {
                return {x, y: NaN};
            }
        }).filter(d => !isNaN(d.y) && isFinite(d.y));

        const yExtent = d3.extent(data, d => d.y);
        const yPadding = (yExtent[1] - yExtent[0]) * 0.1 || 1;

        this.xScale.domain(this.currentDomain);
        this.yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]);

        this.updateAxes(this.duration);

        const line = d3.line()
            .x(d => this.xScale(d.x))
            .y(d => this.yScale(d.y));

        if (this.initialized) {
            this.functionPath.datum(data)
                .transition().duration(this.duration)
                .attr('d', line);
        } else {
            this.functionPath.datum(data).attr('d', line);
            this.initialized = true;
        }

        this.repositionHistory(true);
    }

    updateAxes(duration = this.duration) {
        this.xAxisG.transition().duration(duration)
            .attr('transform', `translate(0,${this.plotHeight})`)
            .call(d3.axisBottom(this.xScale));
        this.yAxisG.transition().duration(duration).call(d3.axisLeft(this.yScale));

        this.gridX.transition().duration(duration)
            .attr('transform', `translate(0,${this.plotHeight})`)
            .call(d3.axisBottom(this.xScale).tickSize(-this.plotHeight).tickFormat(''));
        this.gridY.transition().duration(duration)
            .call(d3.axisLeft(this.yScale).tickSize(-this.plotWidth).tickFormat(''));

        this.gridLayer.selectAll(".tick line").attr("stroke", "#e0e0e0").attr("stroke-opacity", 0.7);
        this.gridLayer.selectAll(".domain").attr("stroke-width", 0);
    }

    updateHistory(history, algorithm, animated = true) {
        const prevLen = this.currentHistory ? this.currentHistory.length : 0;

        // 保存当前状态
        this.currentHistory = history ? history.slice() : [];
        this.currentAlgorithm = algorithm || null;

        if (!history || history.length === 0) {
            this.pointsLayer.selectAll('*').remove();
            this.linesLayer.selectAll('*').remove();
            return;
        }

        const pathSel = this.linesLayer.selectAll('path.history-path').data([history]);
        pathSel.enter()
            .append('path')
            .attr('class', 'history-path')
            .attr('fill', 'none')
            .attr('stroke', '#2196F3')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '5,5');
        pathSel.exit().remove();

        const circles = this.pointsLayer.selectAll('circle.iter-point').data(history, (d, i) => i);
        if (animated) {
            circles.exit().transition().duration(200).attr('r', 0).remove();
        } else {
            circles.exit().remove();
        }
        const circlesEnter = circles.enter()
            .append('circle')
            .attr('class', 'iter-point')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5);
        if (animated) {
            circlesEnter
                .attr('r', 0)
                .attr('fill', '#f44336')
                .attr('cx', d => this.xScale(d.x))
                .attr('cy', d => this.yScale(d.y));
        } else {
            circlesEnter
                .attr('r', (d, i) => (i === history.length - 1 ? 6 : 5))
                .attr('fill', '#f44336')
                .attr('cx', d => this.xScale(d.x))
                .attr('cy', d => this.yScale(d.y));
        }

        const labels = this.pointsLayer.selectAll('text.iter-label').data(history, (d, i) => i);
        if (animated) {
            labels.exit().transition().duration(200).style('opacity', 0).remove();
        } else {
            labels.exit().remove();
        }
        const labelsEnter = labels.enter()
            .append('text')
            .attr('class', 'iter-label')
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px');
        if (animated) {
            labelsEnter
                .style('opacity', 0)
                .attr('x', d => this.xScale(d.x))
                .attr('y', d => this.yScale(d.y) - 10);
        } else {
            labelsEnter
                .style('opacity', 1)
                .attr('x', d => this.xScale(d.x))
                .attr('y', d => this.yScale(d.y) - 10)
                .text((d, i) => {
                    if (this.currentAlgorithm === 'secant') {
                        const idx = (i === 0) ? -1 : (i - 1);
                        return `x${toSubscript(idx)}`;
                    } else {
                        return `x${toSubscript(i)}`;
                    }
                });
        }

        // 4. 统一调用重定位与样式更新（含过渡/或瞬时更新）
        this.repositionHistory(animated);

        // 5. 如果是新增点，执行自动缩放或聚焦逻辑
        if (history.length > prevLen) {
            this.ensureScaleForLatestPair();
            this.focusOnLatest();
        }
    }

    // 聚焦到最新迭代点（保持当前视窗宽度，平移居中）
    focusOnLatest() {
        if (!this.currentHistory || this.currentHistory.length === 0) return;
        const lastX = this.currentHistory[this.currentHistory.length - 1].x;
        const [x0, x1] = this.xScale.domain();
        const half = (x1 - x0) / 2;
        const newDomain = [lastX - half, lastX + half];
        this.drawFunction(this.currentExpr, newDomain);
    }

    // 根据最近两个迭代点的间距自适应缩放：
    // 与当前可视宽度比较，计算放大/缩小倍率并调整定义域
    ensureScaleForLatestPair() {
        if (!this.currentHistory || this.currentHistory.length < 2) return;
        const last = this.currentHistory[this.currentHistory.length - 1];
        const prev = this.currentHistory[this.currentHistory.length - 2];
        const dx = Math.abs(last.x - prev.x);
        if (!isFinite(dx) || dx <= 0) return;

        const [x0, x1] = this.xScale.domain();
        const width = x1 - x0;
        if (!isFinite(width) || width <= 0) return;

        // 目标比例阈值
        const lowRatio = 0.1;   // 若 dx < 10% 可视宽度，则放大
        const highRatio = 0.6;  // 若 dx > 60% 可视宽度，则缩小（扩大视野）

        if (dx < width * lowRatio) {
            const targetWidth = Math.max(dx / lowRatio, width * 0.02);
            const center = last.x;
            const newDomain = [center - targetWidth / 2, center + targetWidth / 2];
            this.drawFunction(this.currentExpr, newDomain);
            return;
        }

        if (dx > width * highRatio) {
            const minx = Math.min(last.x, prev.x);
            const maxx = Math.max(last.x, prev.x);
            const targetWidth = dx / highRatio;
            const center = (minx + maxx) / 2;
            const half = targetWidth / 2;
            const newDomain = [center - half, center + half];
            this.drawFunction(this.currentExpr, newDomain);
        }
    }

    autoZoom(points, options = {}) {
        if (!points || points.length === 0) return;
        const dragging = !!options.dragging;

        const [xMin, xMax] = this.xScale.domain();
        const range = (xMax - xMin) || 1;
        const marginFrac = 0.1; // 初始拖动时希望点距边缘至少 10% 视口宽度
        const margin = range * marginFrac;

        const xs = points.map(p => p.x).filter(x => isFinite(x));
        if (xs.length === 0) return;
        const pMin = d3.min(xs);
        const pMax = d3.max(xs);
        const lastX = xs[xs.length - 1];

        if (dragging) {
            // 拖动初始点：只向触边方向延伸，避免不断放大
            let newMin = xMin;
            let newMax = xMax;
            if (pMin <= xMin + margin) newMin = pMin - margin;
            if (pMax >= xMax - margin) newMax = pMax + margin;
            if (newMin !== xMin || newMax !== xMax) {
                this.drawFunction(this.currentExpr, [newMin, newMax]);
            }
            return;
        }

        // 非拖动：保持原有自动扩展逻辑，并留足边距
        const needExpandLeft = lastX <= xMin + margin || pMin < xMin;
        const needExpandRight = lastX >= xMax - margin || pMax > xMax;
        if (needExpandLeft || needExpandRight) {
            const span = Math.max(pMax - pMin, range * 0.5, 1e-6);
            const pad = Math.max(span * 0.5, margin, 2);
            const newDomain = [pMin - pad, pMax + pad];
            this.drawFunction(this.currentExpr, newDomain);
        }
    }

    pan(direction) {
        const [x0, x1] = this.xScale.domain();
        const shift = (x1 - x0) * 0.2 * direction;
        this.drawFunction(this.currentExpr, [x0 + shift, x1 + shift]);
    }

    zoom(factor) {
        const [x0, x1] = this.xScale.domain();
        const center = (x0 + x1) / 2;
        const halfWidth = (x1 - x0) / (2 * factor);
        this.drawFunction(this.currentExpr, [center - halfWidth, center + halfWidth]);
    }

    // 在缩放/平移或更新历史时，根据当前比例尺与状态，平滑更新已绘制的迭代点、连线与样式
    repositionHistory(animated = true) {
        if (!this.currentHistory || this.currentHistory.length === 0) return;

        const history = this.currentHistory;
        const algo = this.currentAlgorithm;
        const t = animated ? this.duration : 0;

        // 1. 更新连线
        const lineGen = d3.line()
            .x(d => this.xScale(d.x))
            .y(d => this.yScale(d.y));

        this.linesLayer.selectAll('path.history-path')
            .transition().duration(t)
            .attr('d', lineGen(history));

        // 2. 更新点（位置、半径与颜色）
        this.pointsLayer.selectAll('circle.iter-point')
            .transition().duration(t)
            .attr('cx', d => this.xScale(d.x))
            .attr('cy', d => this.yScale(d.y))
            .attr('r', (d, i) => (i === history.length - 1 ? 6 : 5))
            .attr('fill', '#f44336');

        // 3. 更新标签（位置、文本与显示状态）
        this.pointsLayer.selectAll('text.iter-label')
            .transition().duration(t)
            .attr('x', d => this.xScale(d.x))
            .attr('y', d => this.yScale(d.y) - 10)
            .style('opacity', 1)
            .text((d, i) => {
                if (algo === 'secant') {
                    const idx = (i === 0) ? -1 : (i - 1);
                    return `x${toSubscript(idx)}`;
                } else {
                    return `x${toSubscript(i)}`;
                }
            });
    }
}
