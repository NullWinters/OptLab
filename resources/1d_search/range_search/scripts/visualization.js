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
     * 自动聚焦到给定区间，并留有一定的边距
     */
    autoZoom(a, b) {
        const padding = Math.abs(b - a) * 0.5;
        this.currentDomain = [Math.min(a, b) - padding, Math.max(a, b) + padding];
        this.drawFunction();
    }
    
    updateInterval(a, b) {
        this.intervalLayer.selectAll('*').remove();
        
        const xA = this.xScale(a);
        const xB = this.xScale(b);
        const xMin = Math.min(xA, xB);
        const xMax = Math.max(xA, xB);
        
        // 绘制阴影区域
        this.intervalLayer.append('rect')
            .attr('class', 'interval-viz')
            .attr('x', xMin)
            .attr('y', 0)
            .attr('width', xMax - xMin)
            .attr('height', this.plotHeight)
            .attr('fill', 'rgba(216, 67, 21, 0.05)');
            
        // 绘制边界线
        [a, b].forEach((val, i) => {
            const x = this.xScale(val);
            this.intervalLayer.append('line')
                .attr('class', 'interval-viz')
                .attr('x1', x)
                .attr('x2', x)
                .attr('y1', 0)
                .attr('y2', this.plotHeight)
                .attr('stroke', '#e53935')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5');
                
            this.intervalLayer.append('text')
                .attr('class', 'interval-viz')
                .attr('x', x)
                .attr('y', -10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('fill', '#e53935')
                .text(`${i === 0 ? 'a' : 'b'}=${val.toFixed(3)}`);
        });
    }
    
    clearTrialPoints() {
        this.trialPointsLayer.selectAll('*').remove();
    }
    
    updateTrialPoints(a_try, b_try, calculateFunc, options = { showA: true, showB: true, showCompare: true }) {
        this.clearTrialPoints();
        
        const points = [];
        if (options.showA) points.push({ label: 'a_try', x: a_try, color: '#f9a825' });
        if (options.showB) points.push({ label: 'b_try', x: b_try, color: '#f9a825' });
        
        points.forEach(p => {
            const x = this.xScale(p.x);
            const y = this.yScale(calculateFunc(p.x));
            
            // 垂直线
            this.trialPointsLayer.append('line')
                .attr('class', 'trial-viz')
                .attr('x1', x)
                .attr('x2', x)
                .attr('y1', this.plotHeight)
                .attr('y2', y)
                .attr('stroke', p.color)
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '3,3');
                
            // 点
            this.trialPointsLayer.append('circle')
                .attr('class', 'trial-viz')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', 6)
                .attr('fill', p.color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);
                
            // 标签
            this.trialPointsLayer.append('text')
                .attr('class', 'trial-viz')
                .attr('x', x)
                .attr('y', y - 15)
                .attr('text-anchor', 'middle')
                .attr('font-size', '11px')
                .attr('fill', p.color)
                .text(`${p.label}=${p.x.toFixed(3)}`);
        });
        
        // 比较指示器
        if (options.showCompare && options.showA && options.showB) {
            const fa = calculateFunc(a_try);
            const fb = calculateFunc(b_try);
            const midX = this.xScale((a_try + b_try) / 2);
            
            this.trialPointsLayer.append('text')
                .attr('class', 'trial-viz')
                .attr('x', midX)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .attr('font-weight', 'bold')
                .attr('fill', fa > fb ? '#e53935' : '#f9a825')
                .text(fa > fb ? 'f(a_try) > f(b_try)' : 'f(a_try) < f(b_try)');
        }
    }
}
