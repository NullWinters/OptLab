import {smartSampling, detectDiscontinuities} from './function-utils.js';

export class OptimizationVisualizer {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        const container = document.getElementById(containerId);
        this.margin = options.margin || {top: 40, right: 30, bottom: 60, left: 50};
        this.width = options.width || (container ? container.clientWidth : 800);
        this.height = options.height || (container ? container.clientHeight : 500);

        this.plotWidth = this.width - this.margin.left - this.margin.right;
        this.plotHeight = this.height - this.margin.top - this.margin.bottom;

        this.currentFunc = null;
        this.currentDomain = [-5, 5];

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
        this.yAxisG = this.axisLayer.append('g')
            .attr('class', 'y-axis');

        this.functionLayer = this.plot.append('g').attr('class', 'function-layer');
        this.functionPath = this.functionLayer.append('path')
            .attr('fill', 'none')
            .attr('stroke', '#d84315')
            .attr('stroke-width', 2.5);

        this.intervalLayer = this.plot.append('g').attr('class', 'interval-layer');
        this.trialPointsLayer = this.plot.append('g').attr('class', 'trial-points-layer');

        this.labelLayer = this.plot.append('g').attr('class', 'label-layer');
        this.labelLayer.append('text')
            .attr('class', 'x-label')
            .attr('x', this.plotWidth / 2)
            .attr('y', this.plotHeight + 40)
            .attr('text-anchor', 'middle')
            .attr('fill', '#5d4037')
            .attr('font-size', '16px')
            .text('x');

        this.labelLayer.append('text')
            .attr('class', 'y-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -this.plotHeight / 2)
            .attr('y', -45)
            .attr('text-anchor', 'middle')
            .attr('fill', '#5d4037')
            .attr('font-size', '16px')
            .text('f(x)');
    }

    resize() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        this.width = container.clientWidth;
        this.height = container.clientHeight || 500;

        this.plotWidth = this.width - this.margin.left - this.margin.right;
        this.plotHeight = this.height - this.margin.top - this.margin.bottom;

        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);

        this.xScale.range([0, this.plotWidth]);
        this.yScale.range([this.plotHeight, 0]);

        const duration = 400;

        // 更新标签位置
        this.labelLayer.select('.x-label').transition().duration(duration)
            .attr('x', this.plotWidth / 2)
            .attr('y', this.plotHeight + 40);

        this.labelLayer.select('.y-label').transition().duration(duration)
            .attr('x', -this.plotHeight / 2);

        if (this.currentFunc) {
            this.drawFunction(this.currentFunc, this.currentDomain);
        }
    }

    drawFunction(funcIdOrExpr, domain) {
        if (funcIdOrExpr) this.currentFunc = funcIdOrExpr;
        if (domain) this.currentDomain = [...domain];

        const func = this.currentFunc;
        const dom = this.currentDomain;

        if (!func) return;

        const segments = smartSampling(func, dom[0], dom[1], 1000);

        let minY = Infinity, maxY = -Infinity;
        segments.forEach(segment => {
            segment.forEach(d => {
                if (d.y < minY) minY = d.y;
                if (d.y > maxY) maxY = d.y;
            });
        });

        const yLimit = 1e10;
        minY = Math.max(minY, -yLimit);
        maxY = Math.min(maxY, yLimit);

        this.xScale.domain(dom);
        const yPadding = (maxY - minY) * 0.2 || 1;
        this.yScale.domain([minY - yPadding, maxY + yPadding]);

        const duration = 400;

        const xTicks = this.width < 500 ? 5 : 10;
        const yTicks = this.height < 300 ? 5 : 8;

        this.gridX.transition().duration(duration)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-opacity', 0.5)
            .call(d3.axisBottom(this.xScale).ticks(xTicks).tickSize(this.plotHeight).tickFormat(''));

        this.gridY.transition().duration(duration)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-opacity', 0.5)
            .call(d3.axisLeft(this.yScale).ticks(yTicks).tickSize(-this.plotWidth).tickFormat(''));

        this.xAxisG.transition().duration(duration)
            .attr('transform', `translate(0,${this.plotHeight})`)
            .call(d3.axisBottom(this.xScale).ticks(xTicks))
            .selectAll('text').style('font-size', '12px');
        this.yAxisG.transition().duration(duration)
            .call(d3.axisLeft(this.yScale).ticks(yTicks))
            .selectAll('text').style('font-size', '12px');

        const line = d3.line()
            .x(d => this.xScale(d.x))
            .y(d => this.yScale(d.y))
            .curve(d3.curveMonotoneX)
            .defined(d => Math.abs(d.y) <= yLimit); // 过滤超出极大范围的点

        const paths = this.functionLayer.selectAll('path.curve').data(segments);

        paths.exit().remove();

        paths.enter().append('path')
            .attr('class', 'curve')
            .attr('fill', 'none')
            .attr('stroke', '#d84315')
            .attr('stroke-width', 2.5)
            .merge(paths)
            .transition().duration(duration)
            .attr('d', line);

        if (this.functionPath) this.functionPath.style('display', 'none');

        this.drawDiscontinuities(func, dom);
    }

    drawDiscontinuities(func, dom) {
        const discontinuities = detectDiscontinuities(func, dom);
        const duration = 400;

        // 绘制垂直渐近线
        const verticalAsymptotes = discontinuities.filter(d => d.type === 'vertical' || d.type === 'jump');
        const vLines = this.functionLayer.selectAll('line.asymptote').data(verticalAsymptotes);

        vLines.exit().remove();

        vLines.enter().append('line')
            .attr('class', 'asymptote')
            .attr('stroke', '#ccc')
            .attr('stroke-dasharray', '5,5')
            .style('stroke-width', '1px')
            .merge(vLines)
            .transition().duration(duration)
            .attr('x1', d => this.xScale(d.x))
            .attr('x2', d => this.xScale(d.x))
            .attr('y1', 0)
            .attr('y2', this.plotHeight);
    }

    /**
     * 缩放画布
     * @param {number} factor 缩放因子，>1 为放大（显示范围缩小），<1 为缩小（显示范围扩大）
     */
    zoom(factor) {
        const [xMin, xMax] = this.currentDomain;
        const center = (xMin + xMax) / 2;
        const halfWidth = (xMax - xMin) / (2 * factor);

        this.currentDomain = [center - halfWidth, center + halfWidth];
        this.drawFunction();
    }

    /**
     * 平移画布
     * @param {number} direction 方向，-1 为向左，1 为向右
     */
    pan(direction) {
        const [xMin, xMax] = this.currentDomain;
        const width = xMax - xMin;
        const step = width * 0.2 * direction;
        this.currentDomain = [xMin + step, xMax + step];
        this.drawFunction();
    }

    /**
     * 自动聚焦到给定区间，并留有一定的边距
     */
    autoZoom(a, b) {
        const padding = Math.abs(b - a) * 0.5;
        this.currentDomain = [Math.min(a, b) - padding, Math.max(a, b) + padding];
        this.drawFunction();
    }

    updateInterval(a, b, iteration = 0) {
        const xA = this.xScale(a);
        const xB = this.xScale(b);
        const xMin = Math.min(xA, xB);
        const xMax = Math.max(xA, xB);
        const duration = 400;

        // 1. 绘制/更新阴影区域
        const rectData = (a !== undefined && b !== undefined) ? [null] : [];
        let rect = this.intervalLayer.selectAll('rect.interval-rect').data(rectData);
        rect.exit().transition().duration(duration).style('opacity', 0).remove();
        rect.enter().append('rect')
            .attr('class', 'interval-rect')
            .attr('y', 0)
            .attr('height', this.plotHeight)
            .attr('fill', 'rgba(216, 67, 21, 0.05)')
            .attr('x', xMin)
            .attr('width', Math.max(0, xMax - xMin))
            .style('opacity', 0)
            .merge(rect)
            .transition().duration(duration)
            .attr('x', xMin)
            .attr('width', Math.max(0, xMax - xMin))
            .attr('height', this.plotHeight)
            .style('opacity', 1);

        // 2. 绘制/更新边界线
        const lineData = (a !== undefined && b !== undefined) ? [
            {val: a, id: 'a', label: 'a', iteration: iteration},
            {val: b, id: 'b', label: 'b', iteration: iteration}
        ] : [];

        let lines = this.intervalLayer.selectAll('line.interval-line').data(lineData, d => d.id);
        lines.exit().transition().duration(duration).style('opacity', 0).remove();
        lines.enter().append('line')
            .attr('class', 'interval-line')
            .attr('x1', d => this.xScale(d.val))
            .attr('x2', d => this.xScale(d.val))
            .attr('y1', 0)
            .attr('y2', this.plotHeight)
            .attr('stroke', '#e53935')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .style('opacity', 0)
            .merge(lines)
            .transition().duration(duration)
            .attr('x1', d => this.xScale(d.val))
            .attr('x2', d => this.xScale(d.val))
            .attr('y2', this.plotHeight)
            .style('opacity', 1);

        // 3. 绘制/更新标签
        let texts = this.intervalLayer.selectAll('text.interval-text').data(lineData, d => d.id);
        texts.exit().transition().duration(duration).style('opacity', 0).remove();
        texts.enter().append('text')
            .attr('class', 'interval-text')
            .attr('x', d => this.xScale(d.val))
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', '#e53935')
            .style('opacity', 0)
            .merge(texts)
            .each(function (d) {
                d3.select(this).html(`${d.label}<tspan baseline-shift="sub" font-size="0.7em">${d.iteration}</tspan>=${d.val.toFixed(3)}`);
            })
            .transition().duration(duration)
            .attr('x', d => this.xScale(d.val))
            .style('opacity', 1);
    }

    clearTrialPoints(animated = true) {
        if (animated) {
            const duration = 400;
            this.trialPointsLayer.selectAll('*').transition().duration(duration).style('opacity', 0).remove();
        } else {
            this.trialPointsLayer.selectAll('*').remove();
        }
    }

    updateTrialPoints(a_try, b_try, calculateFunc, options = {showA: true, showB: true, showCompare: true}) {
        const duration = 400;
        const points = [];
        if (options.showA) points.push({id: 'a_try', label: 'a_try', x: a_try, color: '#f9a825'});
        if (options.showB) points.push({id: 'b_try', label: 'b_try', x: b_try, color: '#f9a825'});

        this.renderPoints(points, calculateFunc, duration);

        // 4. 处理比较指示器
        const compareData = (options.showCompare && options.showA && options.showB) ? [{a_try, b_try}] : [];
        let compareText = this.trialPointsLayer.selectAll('text.compare-text').data(compareData);
        compareText.exit().transition().duration(duration).style('opacity', 0).remove();
        compareText.enter().append('text')
            .attr('class', 'compare-text')
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-weight', 'bold')
            .attr('font-size', '14px')
            .attr('x', d => this.xScale((d.a_try + d.b_try) / 2))
            .style('opacity', 0)
            .merge(compareText)
            .transition().duration(duration)
            .attr('x', d => this.xScale((d.a_try + d.b_try) / 2))
            .attr('fill', d => calculateFunc(d.a_try) > calculateFunc(d.b_try) ? '#e53935' : '#f9a825')
            .text(d => calculateFunc(d.a_try) > calculateFunc(d.b_try) ? 'f(a_try) > f(b_try)' : 'f(a_try) < f(b_try)')
            .style('opacity', 1);
    }

    updateBisectionPoints(a, b, m, calculateY, getDerivative, options = {
        showEndDerivs: false,
        showMidDeriv: false,
        showCompare: false
    }, yOffset = 10, customColor = null, labelPrefix = '') {
        const duration = 400;
        const color = customColor || '#d84315';
        const points = [];
        const prefix = labelPrefix ? `-${labelPrefix}` : '';
        if (options.showEndDerivs) {
            points.push({id: `bis-a${prefix}`, label: "f'(a)", x: a, color: color});
            points.push({id: `bis-b${prefix}`, label: "f'(b)", x: b, color: color});
        }
        if (options.showMidDeriv) {
            points.push({id: `bis-m${prefix}`, label: "f'(m)", x: m, color: color}); // 中点通常突出显示
        }

        this.renderPoints(points, calculateY, duration, x => getDerivative(x).toFixed(4), prefix);

        // 处理导数比较指示器
        const compareData = (options.showCompare && options.showMidDeriv && options.showEndDerivs) ? [{a, b, m}] : [];
        let compareText = this.trialPointsLayer.selectAll(`text.compare-text${prefix}`).data(compareData);
        compareText.exit().transition().duration(duration).style('opacity', 0).remove();
        compareText.enter().append('text')
            .attr('class', `compare-text${prefix}`)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('x', d => this.xScale(d.m))
            .attr('y', 20 + yOffset)
            .style('opacity', 0)
            .merge(compareText)
            .transition().duration(duration)
            .attr('x', d => this.xScale(d.m))
            .attr('y', 20 + yOffset)
            .attr('fill', d => {
                const dfm = getDerivative(d.m);
                if (Math.abs(dfm) < 1e-10) return customColor || '#4caf50'; // 找到最优解，若有 customColor 则使用，否则绿色
                return customColor || (dfm * getDerivative(d.a) > 0 ? '#e53935' : '#f9a825');
            })
            .text(d => {
                const dfm = getDerivative(d.m);
                const dfa = getDerivative(d.a);
                const label = (labelPrefix && Math.abs(dfm) >= 1e-10) ? `${labelPrefix}: ` : '';
                if (Math.abs(dfm) < 1e-10) return `f'(m)=0 \u2192 \u8f93\u51fa\u6781\u5c0f\u503c\u70b9`;
                const result = dfm * dfa > 0 ? '>' : '<';
                return `${label}f'(m) \u00b7 f'(a) ${result} 0`;
            })
            .style('opacity', 1);
    }

    renderPoints(points, calculateY, duration, labelFormatter = null, classSuffix = '') {
        // 1. 处理引导线
        let lines = this.trialPointsLayer.selectAll(`line.trial-line${classSuffix}`).data(points, d => d.id);
        lines.exit().transition().duration(duration).style('opacity', 0).remove();
        lines.enter().append('line')
            .attr('class', `trial-line${classSuffix}`)
            .attr('x1', d => this.xScale(d.x))
            .attr('x2', d => this.xScale(d.x))
            .attr('y1', this.plotHeight)
            .attr('y2', this.plotHeight)
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0)
            .merge(lines)
            .transition().duration(duration)
            .attr('x1', d => this.xScale(d.x))
            .attr('x2', d => this.xScale(d.x))
            .attr('y1', this.plotHeight)
            .attr('y2', d => this.yScale(calculateY(d.x)))
            .style('opacity', 1);

        // 2. 处理点
        let circles = this.trialPointsLayer.selectAll(`circle.trial-point${classSuffix}`).data(points, d => d.id);
        circles.exit().transition().duration(duration).attr('r', 0).remove();
        circles.enter().append('circle')
            .attr('class', `trial-point${classSuffix}`)
            .attr('r', 0)
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('cx', d => this.xScale(d.x))
            .attr('cy', d => this.yScale(calculateY(d.x)))
            .merge(circles)
            .transition().duration(duration)
            .attr('cx', d => this.xScale(d.x))
            .attr('cy', d => this.yScale(calculateY(d.x)))
            .attr('r', 6);

        // 3. 处理标签
        let labels = this.trialPointsLayer.selectAll(`text.trial-label${classSuffix}`).data(points, d => d.id);
        labels.exit().transition().duration(duration).style('opacity', 0).remove();
        labels.enter().append('text')
            .attr('class', `trial-label${classSuffix}`)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('fill', d => d.color)
            .attr('x', d => this.xScale(d.x))
            .attr('y', d => this.yScale(calculateY(d.x)) - 5)
            .style('opacity', 0)
            .merge(labels)
            .transition().duration(duration)
            .attr('x', d => this.xScale(d.x))
            .attr('y', d => this.yScale(calculateY(d.x)) - 15)
            .text(d => labelFormatter ? `${d.label}=${labelFormatter(d.x)}` : `${d.label}=${d.x.toFixed(3)}`)
            .style('opacity', 1);
    }
}
