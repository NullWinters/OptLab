/**
 * 可视化引擎 - 基于 D3.js
 */

export class OptimizationVisualizer {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.margin = options.margin || { top: 40, right: 40, bottom: 60, left: 60 };
        this.width = options.width || document.getElementById(containerId).clientWidth;
        this.height = options.height || 500;
        
        this.plotWidth = this.width - this.margin.left - this.margin.right;
        this.plotHeight = this.height - this.margin.top - this.margin.bottom;
        
        this.currentFunc = null;
        this.currentDomain = [-5, 5];
        
        this.initSvg();
    }
    
    initSvg() {
        // 清除容器
        d3.select(`#${this.containerId}`).selectAll("*").remove();
        
        this.svg = d3.select(`#${this.containerId}`)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
            
        this.plot = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
            
        // 比例尺定义域暂设为默认，后面通过 drawFunction 更新
        this.xScale = d3.scaleLinear().range([0, this.plotWidth]);
        this.yScale = d3.scaleLinear().range([this.plotHeight, 0]);

        // 初始化各图层
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

        // 初始化坐标轴标签
        this.labelLayer = this.plot.append('g').attr('class', 'label-layer');
        this.labelLayer.append('text')
            .attr('x', this.plotWidth / 2)
            .attr('y', this.plotHeight + 40)
            .attr('text-anchor', 'middle')
            .attr('fill', '#5d4037')
            .text('x');
            
        this.labelLayer.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -this.plotHeight / 2)
            .attr('y', -45)
            .attr('text-anchor', 'middle')
            .attr('fill', '#5d4037')
            .text('f(x)');
    }
    
    drawFunction(calculateFunc, domain) {
        if (calculateFunc) this.currentFunc = calculateFunc;
        if (domain) this.currentDomain = [...domain];
        
        const func = this.currentFunc;
        const dom = this.currentDomain;

        if (!func) return;

        // 生成数据
        const data = [];
        const step = (dom[1] - dom[0]) / 200;
        let minY = Infinity, maxY = -Infinity;
        
        for (let x = dom[0]; x <= dom[1]; x += step) {
            const y = func(x);
            data.push({ x, y });
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        
        // 更新比例尺
        this.xScale.domain(dom);
        const yPadding = (maxY - minY) * 0.2 || 1;
        this.yScale.domain([minY - yPadding, maxY + yPadding]);
        
        const duration = 400;

        // 更新网格
        this.gridX.transition().duration(duration)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-opacity', 0.5)
            .call(d3.axisBottom(this.xScale).tickSize(this.plotHeight).tickFormat(''));
            
        this.gridY.transition().duration(duration)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-opacity', 0.5)
            .call(d3.axisLeft(this.yScale).tickSize(-this.plotWidth).tickFormat(''));
            
        // 更新坐标轴
        this.xAxisG.transition().duration(duration).call(d3.axisBottom(this.xScale));
        this.yAxisG.transition().duration(duration).call(d3.axisLeft(this.yScale));
            
        // 更新曲线
        const line = d3.line()
            .x(d => this.xScale(d.x))
            .y(d => this.yScale(d.y))
            .curve(d3.curveMonotoneX);
            
        this.functionPath.datum(data)
            .transition().duration(duration)
            .attr('d', line);
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
    
    updateInterval(a, b) {
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
            .style('opacity', 1);
            
        // 2. 绘制/更新边界线
        const lineData = (a !== undefined && b !== undefined) ? [
            { val: a, id: 'a', label: 'a' },
            { val: b, id: 'b', label: 'b' }
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
            .style('opacity', 1);
            
        // 3. 绘制/更新标签
        let texts = this.intervalLayer.selectAll('text.interval-text').data(lineData, d => d.id);
        texts.exit().transition().duration(duration).style('opacity', 0).remove();
        texts.enter().append('text')
            .attr('class', 'interval-text')
            .attr('x', d => this.xScale(d.val))
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('fill', '#e53935')
            .style('opacity', 0)
            .merge(texts)
            .transition().duration(duration)
            .attr('x', d => this.xScale(d.val))
            .text(d => `${d.label}=${d.val.toFixed(3)}`)
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
    
    updateTrialPoints(a_try, b_try, calculateFunc, options = { showA: true, showB: true, showCompare: true }) {
        const duration = 400;
        const points = [];
        if (options.showA) points.push({ id: 'a_try', label: 'a_try', x: a_try, color: '#f9a825' });
        if (options.showB) points.push({ id: 'b_try', label: 'b_try', x: b_try, color: '#f9a825' });
        
        // 1. 处理引导线
        let lines = this.trialPointsLayer.selectAll('line.trial-line').data(points, d => d.id);
        lines.exit().transition().duration(duration).style('opacity', 0).remove();
        lines.enter().append('line')
            .attr('class', 'trial-line')
            .attr('x1', d => this.xScale(d.x))
            .attr('x2', d => this.xScale(d.x))
            .attr('y1', this.plotHeight)
            .attr('y2', this.plotHeight) // 从底部生长
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0)
            .merge(lines)
            .transition().duration(duration)
            .attr('x1', d => this.xScale(d.x))
            .attr('x2', d => this.xScale(d.x))
            .attr('y2', d => this.yScale(calculateFunc(d.x)))
            .style('opacity', 1);

        // 2. 处理试点
        let circles = this.trialPointsLayer.selectAll('circle.trial-point').data(points, d => d.id);
        circles.exit().transition().duration(duration).attr('r', 0).remove();
        circles.enter().append('circle')
            .attr('class', 'trial-point')
            .attr('r', 0) // 从 0 变大
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('cx', d => this.xScale(d.x))
            .attr('cy', d => this.yScale(calculateFunc(d.x)))
            .merge(circles)
            .transition().duration(duration)
            .attr('cx', d => this.xScale(d.x))
            .attr('cy', d => this.yScale(calculateFunc(d.x)))
            .attr('r', 6);

        // 3. 处理试点标签
        let labels = this.trialPointsLayer.selectAll('text.trial-label').data(points, d => d.id);
        labels.exit().transition().duration(duration).style('opacity', 0).remove();
        labels.enter().append('text')
            .attr('class', 'trial-label')
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', d => d.color)
            .attr('x', d => this.xScale(d.x))
            .attr('y', d => this.yScale(calculateFunc(d.x)) - 5)
            .style('opacity', 0)
            .merge(labels)
            .transition().duration(duration)
            .attr('x', d => this.xScale(d.x))
            .attr('y', d => this.yScale(calculateFunc(d.x)) - 15)
            .text(d => `${d.label}=${d.x.toFixed(3)}`)
            .style('opacity', 1);

        // 4. 处理比较指示器
        const compareData = (options.showCompare && options.showA && options.showB) ? [ { a_try, b_try } ] : [];
        let compareText = this.trialPointsLayer.selectAll('text.compare-text').data(compareData);
        compareText.exit().transition().duration(duration).style('opacity', 0).remove();
        compareText.enter().append('text')
            .attr('class', 'compare-text')
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-weight', 'bold')
            .attr('x', d => this.xScale((d.a_try + d.b_try) / 2))
            .style('opacity', 0)
            .merge(compareText)
            .transition().duration(duration)
            .attr('x', d => this.xScale((d.a_try + d.b_try) / 2))
            .attr('fill', d => calculateFunc(d.a_try) > calculateFunc(d.b_try) ? '#e53935' : '#f9a825')
            .text(d => calculateFunc(d.a_try) > calculateFunc(d.b_try) ? 'f(a_try) > f(b_try)' : 'f(a_try) < f(b_try)')
            .style('opacity', 1);
    }
}
