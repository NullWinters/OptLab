/**
 * 点搜索可视化引擎 - 基于 D3.js
 */

// helper: convert integer to Unicode subscript string (supports minus sign)
function toSubscript(n) {
    const map = {'-':'\u208B','0':'\u2080','1':'\u2081','2':'\u2082','3':'\u2083','4':'\u2084','5':'\u2085','6':'\u2086','7':'\u2087','8':'\u2088','9':'\u2089'};
    return String(n).split('').map(ch => map[ch] || ch).join('');
}

export class PointSearchVisualizer {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.margin = options.margin || {top: 40, right: 40, bottom: 60, left: 60};
        
        const container = document.getElementById(containerId);
        this.width = options.width || container.clientWidth;
        this.height = options.height || container.clientHeight || 400;

        this.plotWidth = this.width - this.margin.left - this.margin.right;
        this.plotHeight = this.height - this.margin.top - this.margin.bottom;

        this.currentExpr = null;
        this.currentDomain = [-5, 5];

        // 动画与历史状态
        this.duration = options.duration || 400;
        this.currentHistory = [];
        this.currentAlgorithm = null;
        this.initialized = false;

        this.initSvg();

        // 监听 resize 事件
        window.addEventListener('resize', () => this.handleResize());
    }

    handleResize() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight || 400;
        
        if (newWidth === 0 || (newWidth === this.width && newHeight === this.height)) return;

        this.width = newWidth;
        this.height = newHeight;
        this.plotWidth = this.width - this.margin.left - this.margin.right;
        this.plotHeight = this.height - this.margin.top - this.margin.bottom;

        // 更新 SVG 视图和比例尺范围
        this.svg
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

        this.xScale.range([0, this.plotWidth]);
        this.yScale.range([this.plotHeight, 0]);

        // 更新坐标轴位置
        this.xAxisG.attr('transform', `translate(0,${this.plotHeight})`);

        // 重绘内容 (resize 时不使用动画)
        if (this.currentExpr) {
            this.drawFunction(null, null, 0);
        }

        // 如果设置了回调，通知外部（如同步其他 UI 元素）
        if (this.onResize) {
            this.onResize();
        }
    }

    initSvg() {
        d3.select(`#${this.containerId}`).selectAll("*").remove();

        this.svg = d3.select(`#${this.containerId}`)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

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

        // 先创建连线图层，再创建点图层，确保点始终显示在连线之上
        this.linesLayer = this.plot.append('g').attr('class', 'lines-layer');
        this.pointsLayer = this.plot.append('g').attr('class', 'points-layer');
    }

    drawFunction(expr, domain, duration = null) {
        if (expr) this.currentExpr = expr;
        if (domain) this.currentDomain = domain;

        const t = (duration !== null) ? duration : this.duration;

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

        // 平滑更新坐标轴与网格
        this.updateAxes(t);

        const line = d3.line()
            .x(d => this.xScale(d.x))
            .y(d => this.yScale(d.y));

        // 平滑更新曲线
        if (this.initialized) {
            this.functionPath.datum(data)
                .transition().duration(t)
                .attr('d', line);
        } else {
            this.functionPath.datum(data).attr('d', line);
            this.initialized = true;
        }

        // 缩放/平移后同步更新历史点位置
        this.repositionHistory(t);
    }

    updateAxes(duration = null) {
        const t = (duration !== null) ? duration : this.duration;
        this.xAxisG.transition().duration(t).call(d3.axisBottom(this.xScale));
        this.yAxisG.transition().duration(t).call(d3.axisLeft(this.yScale));
        
        // Grid lines with transition
        this.gridX.transition().duration(t)
            .attr('transform', `translate(0,${this.plotHeight})`)
            .call(d3.axisBottom(this.xScale).tickSize(-this.plotHeight).tickFormat(''));
        this.gridY.transition().duration(t)
            .call(d3.axisLeft(this.yScale).tickSize(-this.plotWidth).tickFormat(''));
        
        this.gridLayer.selectAll(".tick line").attr("stroke", "#e0e0e0").attr("stroke-opacity", 0.7);
        this.gridLayer.selectAll(".domain").attr("stroke-width", 0);
    }

    updateHistory(history, algorithm, animated = true) {
        // 判断是否新增了迭代点（用于触发聚焦）
        const prevLen = this.currentHistory ? this.currentHistory.length : 0;

        // 保存当前状态
        this.currentHistory = history ? history.slice() : [];
        this.currentAlgorithm = algorithm || null;

        if (!history || history.length === 0) {
            this.pointsLayer.selectAll('*').remove();
            this.linesLayer.selectAll('*').remove();
            return;
        }

        // 1. 数据连接：路径 (只有一条)
        const pathSel = this.linesLayer.selectAll('path.history-path').data([history]);
        pathSel.enter()
            .append('path')
            .attr('class', 'history-path')
            .attr('fill', 'none')
            .attr('stroke', '#2196F3')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '5,5');
        pathSel.exit().remove();

        // 2. 数据连接：点
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

        // 3. 数据连接：标签
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
    repositionHistory(durationOrAnimated = true) {
        if (!this.currentHistory || this.currentHistory.length === 0) return;
        
        const history = this.currentHistory;
        const algo = this.currentAlgorithm;
        const t = (typeof durationOrAnimated === 'number') ? durationOrAnimated : (durationOrAnimated ? this.duration : 0);

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
