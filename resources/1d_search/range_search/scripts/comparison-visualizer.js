import { OptimizationVisualizer } from './visualization.js';

export class ComparisonVisualizer extends OptimizationVisualizer {
    constructor(containerId, options = {}) {
        super(containerId, options);
        this.initComparisonLayers();
    }

    initComparisonLayers() {
        this.goldenLayer = this.plot.append('g').attr('class', 'golden-layer');
        this.fibonacciLayer = this.plot.append('g').attr('class', 'fibonacci-layer');
        
        // 用于收敛速度图的图层
        this.convergenceLayer = this.plot.append('g').attr('class', 'convergence-layer').style('display', 'none');
    }

    // 绘制双轨迹对比
    drawDualTrajectories(goldenHistory, fibHistory, calculateFunc) {
        this.convergenceLayer.style('display', 'none');
        this.functionLayer.style('display', 'block');
        this.intervalLayer.style('display', 'block');
        this.trialPointsLayer.style('display', 'block');
        this.axisLayer.style('display', 'block');
        this.labelLayer.style('display', 'block');

        // 这里我们可以根据需求决定如何展示双轨迹
        // 方案一：只展示当前的区间，但用两种颜色标识
        
        const lastG = (goldenHistory && goldenHistory.length > 0) ? goldenHistory[goldenHistory.length - 1] : null;
        this.drawInterval(lastG ? lastG.a : undefined, lastG ? lastG.b : undefined, '#d84315', 'G', 0);

        const lastF = (fibHistory && fibHistory.length > 0) ? fibHistory[fibHistory.length - 1] : null;
        this.drawInterval(lastF ? lastF.a : undefined, lastF ? lastF.b : undefined, '#f9a825', 'F', 20); // 偏移一点文字位置
    }

    drawInterval(a, b, color, labelPrefix, textOffset) {
        const xA = this.xScale(a);
        const xB = this.xScale(b);
        const xMin = Math.min(xA, xB);
        const xMax = Math.max(xA, xB);
        const duration = 400;
        
        // 1. 矩形阴影
        const rectData = (a !== undefined && b !== undefined) ? [null] : [];
        let rect = this.intervalLayer.selectAll(`rect.interval-rect-${labelPrefix}`).data(rectData);
        rect.exit().transition().duration(duration).style('opacity', 0).remove();
        rect.enter().append('rect')
            .attr('class', `interval-rect-${labelPrefix}`)
            .attr('y', 0)
            .attr('height', this.plotHeight)
            .attr('fill', color)
            .attr('fill-opacity', 0.1)
            .attr('x', xMin)
            .attr('width', Math.max(0, xMax - xMin))
            .style('opacity', 0)
            .merge(rect)
            .transition().duration(duration)
            .attr('x', xMin)
            .attr('width', Math.max(0, xMax - xMin))
            .style('opacity', 1);
            
        // 2. 边界线和标签
        const lineData = (a !== undefined && b !== undefined) ? [
            { val: a, id: 'a', label: `${labelPrefix}-a` },
            { val: b, id: 'b', label: `${labelPrefix}-b` }
        ] : [];
        
        let lines = this.intervalLayer.selectAll(`line.interval-line-${labelPrefix}`).data(lineData, d => d.id);
        lines.exit().transition().duration(duration).style('opacity', 0).remove();
        lines.enter().append('line')
            .attr('class', `interval-line-${labelPrefix}`)
            .attr('x1', d => this.xScale(d.val))
            .attr('x2', d => this.xScale(d.val))
            .attr('y1', 0)
            .attr('y2', this.plotHeight)
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', (d, i) => i === 0 ? 'none' : '5,5')
            .style('opacity', 0)
            .merge(lines)
            .transition().duration(duration)
            .attr('x1', d => this.xScale(d.val))
            .attr('x2', d => this.xScale(d.val))
            .style('opacity', 1);

        let texts = this.intervalLayer.selectAll(`text.interval-text-${labelPrefix}`).data(lineData, d => d.id);
        texts.exit().transition().duration(duration).style('opacity', 0).remove();
        texts.enter().append('text')
            .attr('class', `interval-text-${labelPrefix}`)
            .attr('x', d => this.xScale(d.val))
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', color)
            .attr('y', -10 - textOffset)
            .style('opacity', 0)
            .merge(texts)
            .transition().duration(duration)
            .attr('x', d => this.xScale(d.val))
            .attr('y', -10 - textOffset)
            .text(d => `${d.label}=${d.val.toFixed(3)}`)
            .style('opacity', 1);
    }

    // 绘制收敛速度对比 (区间长度随迭代次数变化)
    drawConvergenceComparison(goldenHistory, fibHistory, yScaleType = 'log', onYLabelClick = null) {
        // 切换层级显示
        this.functionLayer.style('display', 'none');
        this.intervalLayer.style('display', 'none');
        this.trialPointsLayer.style('display', 'none');
        this.axisLayer.style('display', 'none');
        this.labelLayer.style('display', 'none');
        this.convergenceLayer.style('display', 'block');

        // 准备数据
        const gData = goldenHistory.map((d, i) => ({ x: i, y: Math.abs(d.b - d.a) }));
        const fData = fibHistory.map((d, i) => ({ x: i, y: Math.abs(d.b - d.a) }));
        this.gData = gData;
        this.fData = fData;

        const maxIter = Math.max(gData.length, fData.length, 1);
        const maxLen = Math.max(
            gData.length > 0 ? gData[0].y : 0,
            fData.length > 0 ? fData[0].y : 0,
            0.1
        );

        // 初始化容器
        if (!this.convRoot) {
            this.convRoot = this.convergenceLayer.append('g').attr('class', 'conv-root');
            this.convXAxisG = this.convRoot.append('g').attr('class', 'conv-x-axis')
                .attr('transform', `translate(0,${this.plotHeight})`);
            this.convYAxisG = this.convRoot.append('g').attr('class', 'conv-y-axis');
            this.convPathsG = this.convRoot.append('g').attr('class', 'conv-paths');

            this.convGoldenPath = this.convPathsG.append('path')
                .attr('fill', 'none').attr('stroke', '#d84315').attr('stroke-width', 2);
            this.convFibPath = this.convPathsG.append('path')
                .attr('fill', 'none').attr('stroke', '#f9a825').attr('stroke-width', 2);

            this.convLegendG = this.convRoot.append('g').attr('class', 'conv-legend')
                .attr('transform', `translate(${this.plotWidth - 120}, 20)`);
            this.convLegendG.append('rect').attr('width', 15).attr('height', 15).attr('fill', '#d84315');
            this.convLegendG.append('text').attr('x', 20).attr('y', 12).text('黄金分割法').attr('font-size', '12px');
            this.convLegendG.append('rect').attr('x', 0).attr('y', 25).attr('width', 15).attr('height', 15).attr('fill', '#f9a825');
            this.convLegendG.append('text').attr('x', 20).attr('y', 37).text('斐波那契法').attr('font-size', '12px');

            this.convXLabel = this.convRoot.append('text')
                .attr('x', this.plotWidth / 2)
                .attr('y', this.plotHeight + 35)
                .attr('text-anchor', 'middle')
                .attr('fill', '#5d4037')
                .text('迭代次数 k');

            this.convYLabel = this.convRoot.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('x', -this.plotHeight / 2)
                .attr('y', -45)
                .attr('text-anchor', 'middle')
                .attr('fill', '#5d4037')
                .style('cursor', 'pointer')
                .style('text-decoration', 'underline');
        }

        // 初始化或更新比例尺
        if (!this.convXScale) {
            this.convXScale = d3.scaleLinear().domain([0, maxIter]).range([0, this.plotWidth]);
        } else {
            const dom = this.convXScale.domain();
            const newMax = Math.max(dom[1], maxIter);
            this.convXScale.domain([dom[0], newMax]);
        }

        this.convYScaleType = yScaleType || this.convYScaleType || 'log';
        if (this.convYScaleType === 'log') {
            this.convYScale = d3.scaleLog().domain([1e-7, maxLen]).range([this.plotHeight, 0]).base(10);
        } else {
            this.convYScale = d3.scaleLinear().domain([0, maxLen]).range([this.plotHeight, 0]);
        }

        const duration = 400;
        this.convXAxisG.transition().duration(duration).call(d3.axisBottom(this.convXScale));
        this.convYAxisG.transition().duration(duration)
            .call(this.convYScaleType === 'log' ? d3.axisLeft(this.convYScale).ticks(10, "~e") : d3.axisLeft(this.convYScale));

        // 轴标签与事件
        const labelText = `区间长度 |b-a| (${this.convYScaleType === 'log' ? '对数刻度' : '普通刻度'})`;
        this.convYLabel.text(labelText);
        if (onYLabelClick) {
            this.convYLabel.on('click', onYLabelClick);
        } else {
            this.convYLabel.on('click', null);
        }

        // 折线
        const line = d3.line()
            .x(d => this.convXScale(d.x))
            .y(d => this.convYScale(Math.max(d.y, 1e-7)));

        this.convGoldenPath.datum(gData).transition().duration(duration).attr('d', line);
        this.convFibPath.datum(fData).transition().duration(duration).attr('d', line);
    }

    /**
     * 切换收敛视图的 Y 轴刻度（线性/对数），带过渡动画
     * @returns {string} 新的刻度类型 ('log' | 'linear')
     */
    animateToggleConvergenceScale() {
        const newType = this.convYScaleType === 'log' ? 'linear' : 'log';
        const maxLen = Math.max(
            this.gData && this.gData.length > 0 ? this.gData[0].y : 0,
            this.fData && this.fData.length > 0 ? this.fData[0].y : 0,
            0.1
        );
        const duration = 500;

        if (newType === 'log') {
            this.convYScale = d3.scaleLog().domain([1e-7, maxLen]).range([this.plotHeight, 0]).base(10);
        } else {
            this.convYScale = d3.scaleLinear().domain([0, maxLen]).range([this.plotHeight, 0]);
        }
        this.convYScaleType = newType;

        const line = d3.line()
            .x(d => this.convXScale(d.x))
            .y(d => this.convYScale(Math.max(d.y, 1e-7)));

        this.convYAxisG.transition().duration(duration)
            .call(newType === 'log' ? d3.axisLeft(this.convYScale).ticks(10, "~e") : d3.axisLeft(this.convYScale));
        this.convGoldenPath.transition().duration(duration).attr('d', line);
        this.convFibPath.transition().duration(duration).attr('d', line);

        this.convYLabel.text(`区间长度 |b-a| (${newType === 'log' ? '对数刻度' : '普通刻度'})`);
        return newType;
    }

    /**
     * 收敛视图缩放（水平）
     * @param {number} factor >1 放大，<1 缩小
     */
    zoomConvergence(factor) {
        if (!this.convXScale) return;
        const [min, max] = this.convXScale.domain();
        const center = (min + max) / 2;
        const half = (max - min) / (2 * factor);
        const newDom = [center - half, center + half];
        this.convXScale.domain(newDom);
        const duration = 300;
        this.convXAxisG.transition().duration(duration).call(d3.axisBottom(this.convXScale));
        const line = d3.line().x(d => this.convXScale(d.x)).y(d => this.convYScale(Math.max(d.y, 1e-7)));
        this.convGoldenPath.transition().duration(duration).attr('d', line);
        this.convFibPath.transition().duration(duration).attr('d', line);
    }

    /**
     * 收敛视图平移（水平）
     * @param {number} direction -1 向左，1 向右
     */
    panConvergence(direction) {
        if (!this.convXScale) return;
        const [min, max] = this.convXScale.domain();
        const width = max - min;
        const step = width * 0.2 * direction;
        const newDom = [min + step, max + step];
        this.convXScale.domain(newDom);
        const duration = 300;
        this.convXAxisG.transition().duration(duration).call(d3.axisBottom(this.convXScale));
        const line = d3.line().x(d => this.convXScale(d.x)).y(d => this.convYScale(Math.max(d.y, 1e-7)));
        this.convGoldenPath.transition().duration(duration).attr('d', line);
        this.convFibPath.transition().duration(duration).attr('d', line);
    }

    clearComparisonLayers() {
        this.goldenLayer.selectAll('*').remove();
        this.fibonacciLayer.selectAll('*').remove();
    }

    updateDualTrialPoints(gPoints, fPoints, calculateFunc, options) {
        // 不再全局清空，交给各子方法进行数据驱动更新
        this.drawAlgorithmTrialPoints(gPoints, calculateFunc, '#d84315', 'G', options, 0);
        this.drawAlgorithmTrialPoints(fPoints, calculateFunc, '#f9a825', 'F', options, 15);
    }

    drawAlgorithmTrialPoints(points, calculateFunc, color, labelPrefix, options, yOffset) {
        const duration = 400;
        const pts = [];
        if (points && options.showA) pts.push({ id: `${labelPrefix}-a`, label: `${labelPrefix}-a`, x: points.a_try });
        if (points && options.showB) pts.push({ id: `${labelPrefix}-b`, label: `${labelPrefix}-b`, x: points.b_try });
        
        // 1. 引导线
        let lines = this.trialPointsLayer.selectAll(`line.trial-line-${labelPrefix}`).data(pts, d => d.id);
        lines.exit().transition().duration(duration).style('opacity', 0).remove();
        lines.enter().append('line')
            .attr('class', `trial-line-${labelPrefix}`)
            .attr('x1', d => this.xScale(d.x)).attr('x2', d => this.xScale(d.x))
            .attr('y1', this.plotHeight)
            .attr('y2', this.plotHeight)
            .attr('stroke', color).attr('stroke-width', 1.2).attr('stroke-dasharray', '3,3')
            .style('opacity', 0)
            .merge(lines)
            .transition().duration(duration)
            .attr('x1', d => this.xScale(d.x)).attr('x2', d => this.xScale(d.x))
            .attr('y2', d => this.yScale(calculateFunc(d.x)))
            .style('opacity', 1);
            
        // 2. 点
        let circles = this.trialPointsLayer.selectAll(`circle.trial-point-${labelPrefix}`).data(pts, d => d.id);
        circles.exit().transition().duration(duration).attr('r', 0).remove();
        circles.enter().append('circle')
            .attr('class', `trial-point-${labelPrefix}`)
            .attr('r', 0)
            .attr('fill', color).attr('stroke', '#fff').attr('stroke-width', 1)
            .attr('cx', d => this.xScale(d.x)).attr('cy', d => this.yScale(calculateFunc(d.x)))
            .merge(circles)
            .transition().duration(duration)
            .attr('cx', d => this.xScale(d.x)).attr('cy', d => this.yScale(calculateFunc(d.x)))
            .attr('r', 4);
            
        // 3. 标签
        let labels = this.trialPointsLayer.selectAll(`text.trial-label-${labelPrefix}`).data(pts, d => d.id);
        labels.exit().transition().duration(duration).style('opacity', 0).remove();
        labels.enter().append('text')
            .attr('class', `trial-label-${labelPrefix}`)
            .attr('text-anchor', 'middle').attr('font-size', '10px').attr('fill', color)
            .attr('x', d => this.xScale(d.x))
            .attr('y', d => this.yScale(calculateFunc(d.x)) - 5 - yOffset)
            .style('opacity', 0)
            .merge(labels)
            .transition().duration(duration)
            .attr('x', d => this.xScale(d.x))
            .attr('y', d => this.yScale(calculateFunc(d.x)) - 8 - yOffset)
            .text(d => `${d.label}=${d.x.toFixed(3)}`)
            .style('opacity', 1);

        // 4. 比较指示器
        const compareData = (points && options.showCompare && options.showA && options.showB) ? [ points ] : [];
        let compareText = this.trialPointsLayer.selectAll(`text.compare-text-${labelPrefix}`).data(compareData);
        compareText.exit().transition().duration(duration).style('opacity', 0).remove();
        compareText.enter().append('text')
            .attr('class', `compare-text-${labelPrefix}`)
            .attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', 'bold').attr('fill', color)
            .attr('x', d => this.xScale((d.a_try + d.b_try) / 2))
            .attr('y', 20 + yOffset)
            .style('opacity', 0)
            .merge(compareText)
            .transition().duration(duration)
            .attr('x', d => this.xScale((d.a_try + d.b_try) / 2))
            .attr('y', 20 + yOffset)
            .text(d => {
                const fa = calculateFunc(d.a_try);
                const fb = calculateFunc(d.b_try);
                return `${labelPrefix}: f(a) ${fa > fb ? '>' : (fa < fb ? '<' : '=')} f(b)`;
            })
            .style('opacity', 1);
    }
}
