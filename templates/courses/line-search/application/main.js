/**
 * 一维搜索方法应用实验脚本
 */

// --- 1. 算法类实现 ---

class BisectionSearch {
    constructor(func, df, a, b, eps = 1e-3) {
        this.func = func;
        this.df = df;
        this.a = a;
        this.b = b;
        this.eps = eps;
        this.history = [];
        this.isComplete = false;
        this.currentIteration = 0;
    }
    iterate() {
        if (this.isComplete || (this.b - this.a) < this.eps) {
            this.isComplete = true;
            return false;
        }
        const mid = (this.a + this.b) / 2;
        const dmid = this.df(mid);
        const da = this.df(this.a);
        const db = this.df(this.b);

        this.history.push({ x: mid, y: this.func(mid), a: this.a, b: this.b, df: dmid });

        if (Math.abs(dmid) < 1e-10) {
            this.a = 0;
            this.b = 0;
            this.isComplete = true;
            return false;
        } else if (dmid * da > 0) {
            this.a = mid;
        } else if (dmid * db > 0) {
            this.b = mid;
        } else {
            // 理论上单谷函数不应进入此分支
            this.isComplete = true;
            return false;
        }

        this.currentIteration++;
        if ((this.b - this.a) < this.eps) this.isComplete = true;
        return true;
    }
}

class GoldenSectionSearch {
    constructor(func, a, b, eps = 1e-3) {
        this.func = func;
        this.a = a;
        this.b = b;
        this.eps = eps;
        this.rho = (3 - Math.sqrt(5)) / 2;
        this.history = [];
        this.isComplete = false;
        this.currentIteration = 0;
    }
    iterate() {
        if (this.isComplete || (this.b - this.a) < this.eps) {
            this.isComplete = true;
            return false;
        }
        const l = this.b - this.a;
        const x1 = this.a + this.rho * l;
        const x2 = this.b - this.rho * l;
        const f1 = this.func(x1);
        const f2 = this.func(x2);

        this.history.push({ a: this.a, b: this.b, x1, x2, f1, f2 });

        if (f1 > f2) {
            this.a = x1;
        } else if (f1 < f2) {
            this.b = x2;
        } else {
            this.a = x1;
            this.b = x2;
        }

        this.currentIteration++;
        if ((this.b - this.a) < this.eps) this.isComplete = true;
        return true;
    }
}

class FibonacciSearch {
    constructor(func, a, b, eps = 1e-3, n = 15) {
        this.func = func;
        this.a = a;
        this.b = b;
        this.eps = eps;
        this.n = n;
        this.fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811, 514229, 832040, 1346269];
        this.k = 1;
        this.history = [];
        this.isComplete = false;
    }
    iterate() {
        if (this.isComplete || this.k >= this.n) {
            this.isComplete = true;
            return false;
        }
        const l = this.b - this.a;
        let rho = 1 - this.fib[this.n - this.k] / this.fib[this.n - this.k + 1];
        if (Math.abs(rho - 0.5) < 1e-10) rho = 0.5 - this.eps;

        const x1 = this.a + rho * l;
        const x2 = this.b - rho * l;
        const f1 = this.func(x1);
        const f2 = this.func(x2);
        
        this.history.push({ a: this.a, b: this.b, x1, x2, f1, f2 });
        
        if (f1 > f2) {
            this.a = x1;
        } else if (f1 < f2) {
            this.b = x2;
        } else {
            this.a = x1;
            this.b = x2;
        }
        
        this.k++;
        if (this.k >= this.n) this.isComplete = true;
        return true;
    }
}

class GradientDescent {
    constructor(func, df, x0, alpha, n = 20) {
        this.func = func;
        this.df = df;
        this.xk = x0;
        this.alpha = alpha;
        this.n = n;
        this.history = [{ x: x0, y: func(x0), df: df(x0) }];
        this.isComplete = false;
        this.currentIteration = 0;
    }
    iterate() {
        if (this.isComplete || this.currentIteration >= this.n) {
            this.isComplete = true;
            return false;
        }
        const d = this.df(this.xk);
        if (!isFinite(d)) {
            this.isComplete = true;
            return false;
        }
        this.xk = this.xk - this.alpha * d;
        this.currentIteration++;
        const y = this.func(this.xk);
        const nextDf = this.df(this.xk);
        this.history.push({ x: this.xk, y: y, df: nextDf });
        
        if (this.currentIteration >= this.n || !isFinite(this.xk) || !isFinite(y)) {
            this.isComplete = true;
        }
        return true;
    }
}

class NewtonsMethod {
    constructor(func, df, ddf, x0, n = 20) {
        this.func = func;
        this.df = df;
        this.ddf = ddf;
        this.xk = x0;
        this.n = n;
        this.history = [{ x: x0, y: func(x0), df: df(x0), ddf: ddf(x0) }];
        this.isComplete = false;
        this.currentIteration = 0;
    }
    iterate() {
        const d = this.df(this.xk);
        if (this.isComplete || this.currentIteration >= this.n || Math.abs(d) < 1e-10) {
            this.isComplete = true;
            return false;
        }
        const dd = this.ddf(this.xk);
        if (Math.abs(dd) < 1e-10) {
            this.isComplete = true;
            return false;
        }
        this.xk = this.xk - d / dd;
        this.currentIteration++;
        const nextDf = this.df(this.xk);
        const nextDdf = this.ddf(this.xk);
        this.history.push({ x: this.xk, y: this.func(this.xk), df: nextDf, ddf: nextDdf });
        if (this.currentIteration >= this.n || Math.abs(nextDf) < 1e-10) this.isComplete = true;
        return true;
    }
}

class SecantMethod {
    constructor(func, df, x0, x_prev, n = 20) {
        this.func = func;
        this.df = df;
        this.xk = x0;
        this.x_prev = x_prev;
        this.n = n;
        this.history = [
            { x: x_prev, y: func(x_prev), df: df(x_prev) },
            { x: x0, y: func(x0), df: df(x0) }
        ];
        this.isComplete = false;
        this.currentIteration = 0;
    }
    iterate() {
        const dfk = this.df(this.xk);
        if (this.isComplete || this.currentIteration >= this.n || Math.abs(dfk) < 1e-10) {
            this.isComplete = true;
            return false;
        }
        const df_prev = this.df(this.x_prev);
        if (Math.abs(dfk - df_prev) < 1e-10) {
            this.isComplete = true;
            return false;
        }
        const nextX = this.xk - dfk * (this.xk - this.x_prev) / (dfk - df_prev);
        this.x_prev = this.xk;
        this.xk = nextX;
        this.currentIteration++;
        const nextDf = this.df(this.xk);
        this.history.push({ x: this.xk, y: this.func(this.xk), df: nextDf });
        if (this.currentIteration >= this.n || Math.abs(nextDf) < 1e-10) this.isComplete = true;
        return true;
    }
}

// --- 2. 可视化类实现 ---

(function() {
    // Helper: convert integer to Unicode subscript string (supports minus sign)
    function toSubscript(n) {
        const map = {'-':'\u208B','0':'\u2080','1':'\u2081','2':'\u2082','3':'\u2083','4':'\u2084','5':'\u2085','6':'\u2086','7':'\u2087','8':'\u2088','9':'\u2089'};
        return String(n).split('').map(ch => map[ch] || ch).join('');
    }

    class SearchVisualizer {
        constructor(containerId) {
            this.containerId = containerId;
            this.margin = { top: 40, right: 40, bottom: 50, left: 70 };
            this.container = document.getElementById(containerId);
            this.width = this.container.clientWidth;
            this.height = 350; // 固定高度
            
            this.plotWidth = this.width - this.margin.left - this.margin.right;
            this.plotHeight = this.height - this.margin.top - this.margin.bottom;
            
            this.duration = 400;
            this.currentDomain = null;
            this.currentFunc = null;
            this.lastArgs = null;

            // Define methods as instance properties to ensure they are always present and correctly bound
            this.zoom = (factor) => {
                if (!this.currentDomain) return;
                const [x0, x1] = this.currentDomain;
                const center = (x0 + x1) / 2;
                const halfWidth = (x1 - x0) / (2 * factor);
                this.currentDomain = [center - halfWidth, center + halfWidth];
                if (this.lastArgs) {
                    this.update(this.lastArgs.func, this.lastArgs.domain, this.lastArgs.history, this.lastArgs.type, this.lastArgs.algo, this.lastArgs.subStep);
                }
            };

            this.pan = (direction) => {
                if (!this.currentDomain) return;
                const [x0, x1] = this.currentDomain;
                const shift = (x1 - x0) * 0.2 * direction;
                this.currentDomain = [x0 + shift, x1 + shift];
                if (this.lastArgs) {
                    this.update(this.lastArgs.func, this.lastArgs.domain, this.lastArgs.history, this.lastArgs.type, this.lastArgs.algo, this.lastArgs.subStep);
                }
            };
            
            this.initSvg();
        }

        initSvg() {
            d3.select(`#${this.containerId}`).selectAll("*").remove();
            this.svg = d3.select(`#${this.containerId}`)
                .append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("viewBox", `0 0 ${this.width} ${this.height}`);
            
            this.plot = this.svg.append("g")
                .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
            
            this.xScale = d3.scaleLinear().range([0, this.plotWidth]);
            this.yScale = d3.scaleLinear().range([this.plotHeight, 0]);

            // 图层管理
            this.gridLayer = this.plot.append("g").attr("class", "grid-layer");
            this.axisLayer = this.plot.append("g").attr("class", "axis-layer");
            this.functionLayer = this.plot.append("g").attr("class", "function-layer");
            this.intervalLayer = this.plot.append("g").attr("class", "interval-layer");
            this.pointsLayer = this.plot.append("g").attr("class", "points-layer");

            // 轴容器
            this.xAxisG = this.axisLayer.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(0, ${this.plotHeight})`);
            this.yAxisG = this.axisLayer.append("g")
                .attr("class", "y-axis");

            // 函数路径
            this.functionPath = this.functionLayer.append("path")
                .attr("fill", "none")
                .attr("stroke", "var(--primary-color)")
                .attr("stroke-width", 2.5);
                
            // 轴标签
            this.plot.append("text")
                .attr("x", this.plotWidth)
                .attr("y", this.plotHeight + 35)
                .attr("text-anchor", "end")
                .attr("fill", "#8d6e63")
                .attr("font-size", "12px")
                .text("x");
                
            this.plot.append("text")
                .attr("x", -10)
                .attr("y", -15)
                .attr("text-anchor", "end")
                .attr("fill", "#8d6e63")
                .attr("font-size", "12px")
                .text("f(x)");
        }

        autoZoom(points) {
            if (!points || points.length === 0) return;
            const xMin = d3.min(points);
            const xMax = d3.max(points);
            const span = Math.abs(xMax - xMin);
            const padding = span * 0.3 || 2;
            this.currentDomain = [xMin - padding, xMax + padding];
        }

        updateAxes(duration = this.duration) {
            const t = d3.transition().duration(duration);
            
            this.xAxisG.transition(t).call(d3.axisBottom(this.xScale).ticks(8));
            
            // 针对极端大数据集的 Y 轴格式化
            const yAxis = d3.axisLeft(this.yScale)
                .ticks(6)
                .tickFormat(d => {
                    const absD = Math.abs(d);
                    if (absD === 0) return "0";
                    if (absD < 1e-3 || absD > 1e6) return d3.format(".2e")(d);
                    return d3.format(".2s")(d);
                });
            this.yAxisG.transition(t).call(yAxis);
            
            // 网格更新
            let gridX = this.gridLayer.selectAll("line.grid-x").data(this.xScale.ticks(8));
            gridX.exit().remove();
            gridX.enter().append("line").attr("class", "grid-x")
                .attr("stroke", "#eee")
                .attr("y1", 0)
                .attr("y2", this.plotHeight)
                .merge(gridX)
                .transition(t)
                .attr("x1", d => this.xScale(d))
                .attr("x2", d => this.xScale(d));

            let gridY = this.gridLayer.selectAll("line.grid-y").data(this.yScale.ticks(6));
            gridY.exit().remove();
            gridY.enter().append("line").attr("class", "grid-y")
                .attr("stroke", "#eee")
                .attr("x1", 0)
                .attr("x2", this.plotWidth)
                .merge(gridY)
                .transition(t)
                .attr("y1", d => this.yScale(d))
                .attr("y2", d => this.yScale(d));
        }

        update(func, domain, history = [], type = "point", algo = null, subStep = 0) {
            this.lastArgs = { func, domain, history, type, algo, subStep };
            this.currentFunc = func;
            
            // 检测并修复隐藏容器导致的尺寸为0问题
            if (this.width <= 0 && this.container.clientWidth > 0) {
                this.width = this.container.clientWidth;
                this.plotWidth = this.width - this.margin.left - this.margin.right;
                this.initSvg();
            }
            
            // 确保 domain 合法且有跨度
            let dom = this.currentDomain || domain;
            if (!dom || !isFinite(dom[0]) || !isFinite(dom[1]) || dom[0] === dom[1]) {
                dom = [-10, 10];
            }
            this.xScale.domain(dom);
            
            // 1. 进一步优化的自适应采样：引入解析极小值点强制采样，防止遗漏极窄波谷
            const rangeSamples = 100;
            let xSamples = d3.range(dom[0], dom[1], (dom[1] - dom[0]) / rangeSamples);
            
            const optVal = (type === "range" && algo && algo.constructor.name === "BisectionSearch") ? 
                          (algo.a + algo.b)/2 : (type === "ls" ? b_fit : p_opt_val);
            if (isFinite(optVal) && optVal >= dom[0] && optVal <= dom[1]) {
                xSamples.push(optVal);
            }
            xSamples.sort((a,b) => a - b);
            
            // 计算 y 轴范围，增加稳健性
            const yValues = xSamples.map(x => func(x)).filter(y => isFinite(y));
            let yExtent = d3.extent(yValues);
            
            if (yExtent[0] === undefined) yExtent = [0, 1];
            if (yExtent[0] === yExtent[1]) yExtent = [yExtent[0] - 1, yExtent[0] + 1];

            const yPadding = (yExtent[1] - yExtent[0]) * 0.2;
            this.yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]);

            this.updateAxes();

            // 2. 绘制函数曲线：使用 adaptiveSamples 并处理极端值
            const adaptiveSamples = Math.max(200, Math.min(2000, Math.ceil(this.width)));
            const line = d3.line()
                .defined(d => isFinite(d.y) && Math.abs(d.y) < 1e25) // 过滤掉极端异常值
                .x(d => this.xScale(d.x))
                .y(d => this.yScale(d.y));
            
            let curvePoints = d3.range(dom[0], dom[1], (dom[1] - dom[0]) / adaptiveSamples);
            if (isFinite(optVal) && optVal >= dom[0] && optVal <= dom[1]) curvePoints.push(optVal);
            curvePoints.sort((a,b) => a - b);

            const curveData = curvePoints
                .map(x => ({ x, y: func(x) }))
                .filter(d => isFinite(d.y));

            this.functionPath.datum(curveData)
                .transition().duration(this.duration)
                .attr("d", line);

            if (type === "range") {
                this.pointsLayer.selectAll("circle.search-point").remove();
                this.pointsLayer.selectAll("text.point-label").remove();
                this.intervalLayer.selectAll("path.search-path").remove();
                this.updateRangeHistory(history, func, algo, subStep);
            } else {
                this.intervalLayer.selectAll("rect.interval-rect").remove();
                this.intervalLayer.selectAll("line.boundary").remove();
                this.intervalLayer.selectAll("text.boundary-label").remove();
                this.pointsLayer.selectAll("line.trial-line").remove();
                this.pointsLayer.selectAll("circle.trial-point").remove();
                this.pointsLayer.selectAll("text.trial-label").remove();
                this.pointsLayer.selectAll("text.compare-info").remove();
                this.updatePointHistory(history, algo, subStep);
            }
        }

        updateRangeHistory(history, func, algo, subStep = 0) {
            const duration = this.duration;
            let latest = algo ? { a: algo.a, b: algo.b } : history[history.length - 1];
            
            const intervalData = latest ? [latest] : [];
            let rect = this.intervalLayer.selectAll("rect.interval-rect").data(intervalData);
            rect.exit().remove();
            rect.enter().append("rect").attr("class", "interval-rect")
                .attr("fill", "#d84315")
                .attr("fill-opacity", 0.08)
                .attr("y", 0)
                .attr("height", this.plotHeight)
                .merge(rect)
                .transition().duration(duration)
                .attr("x", d => this.xScale(Math.min(d.a, d.b)))
                .attr("width", d => Math.max(0, Math.abs(this.xScale(d.b) - this.xScale(d.a))))
                .style("opacity", 1);

            const boundaryData = latest ? [{x: latest.a, label: 'a'}, {x: latest.b, label: 'b'}] : [];
            let bLines = this.intervalLayer.selectAll("line.boundary").data(boundaryData, d => d.label);
            bLines.exit().remove();
            bLines.enter().append("line").attr("class", "boundary")
                .attr("stroke", "#e53935")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "4,4")
                .attr("y1", 0)
                .attr("y2", this.plotHeight)
                .merge(bLines)
                .transition().duration(duration)
                .attr("x1", d => this.xScale(d.x))
                .attr("x2", d => this.xScale(d.x))
                .style("opacity", 1);

            let bLabels = this.intervalLayer.selectAll("text.boundary-label").data(boundaryData, d => d.label);
            bLabels.exit().remove();
            bLabels.enter().append("text").attr("class", "boundary-label")
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("fill", "#e53935")
                .attr("y", -10)
                .merge(bLabels)
                .transition().duration(duration)
                .attr("x", d => this.xScale(d.x))
                .text(d => `${d.label}=${d.x.toFixed(3)}`)
                .style("opacity", 1);

            let trialPoints = [];
            let compareInfo = "";
            if (algo) {
                const method = algo.constructor.name;
                if (method === "BisectionSearch") {
                    if (subStep >= 1) {
                        trialPoints.push({x: algo.a, label: "f'(a)", y: algo.func(algo.a), df: algo.df(algo.a), color: '#d84315'});
                        trialPoints.push({x: algo.b, label: "f'(b)", y: algo.func(algo.b), df: algo.df(algo.b), color: '#d84315'});
                    }
                    if (subStep >= 2) {
                        const mid = (algo.a + algo.b) / 2;
                        trialPoints.push({x: mid, label: 'm', y: algo.func(mid), df: algo.df(mid), color: '#f9a825'});
                    }
                    if (subStep >= 3) {
                        const mid = (algo.a + algo.b) / 2;
                        const dmid = algo.df(mid);
                        const da = algo.df(algo.a);
                        compareInfo = (dmid * da > 0) ? "f'(m) 与 f'(a) 同号 → 舍弃左区间" : "f'(m) 与 f'(b) 同号 → 舍弃右区间";
                    }
                } else {
                    const l = algo.b - algo.a;
                    let rho;
                    if (method === "GoldenSectionSearch") {
                        rho = algo.rho;
                    } else {
                        rho = 1 - algo.fib[algo.n - algo.k] / algo.fib[algo.n - algo.k + 1];
                        if (Math.abs(rho - 0.5) < 1e-10) rho = 0.5 - algo.eps;
                    }
                    const x1 = algo.a + rho * l;
                    const x2 = algo.b - rho * l;
                    if (subStep >= 1) trialPoints.push({x: x1, label: 'x\u2081', y: algo.func(x1), color: '#f9a825'});
                    if (subStep >= 2) trialPoints.push({x: x2, label: 'x\u2082', y: algo.func(x2), color: '#f9a825'});
                    if (subStep >= 3) {
                        const f1 = algo.func(x1);
                        const f2 = algo.func(x2);
                        compareInfo = f1 < f2 ? "f(x\u2081) < f(x\u2082) → 舍弃右区间" : "f(x\u2081) > f(x\u2082) → 舍弃左区间";
                    }
                }
            }

            let tLines = this.pointsLayer.selectAll("line.trial-line").data(trialPoints, d => d.label);
            tLines.exit().remove();
            tLines.enter().append("line").attr("class", "trial-line")
                .attr("stroke", d => d.color).attr("stroke-width", 1).attr("stroke-dasharray", "3,3")
                .attr("x1", d => this.xScale(d.x)).attr("x2", d => this.xScale(d.x))
                .attr("y1", this.plotHeight).attr("y2", this.plotHeight)
                .merge(tLines).transition().duration(duration)
                .attr("x1", d => this.xScale(d.x)).attr("x2", d => this.xScale(d.x)).attr("y2", d => this.yScale(d.y));

            let circles = this.pointsLayer.selectAll("circle.trial-point").data(trialPoints, d => d.label);
            circles.exit().remove();
            circles.enter().append("circle").attr("class", "trial-point")
                .attr("r", 5).attr("stroke", "white").attr("stroke-width", 1.5).attr("fill", d => d.color)
                .merge(circles).transition().duration(duration).attr("cx", d => this.xScale(d.x)).attr("cy", d => this.yScale(d.y));

            let labels = this.pointsLayer.selectAll("text.trial-label").data(trialPoints, d => d.label);
            labels.exit().remove();
            labels.enter().append("text").attr("class", "trial-label")
                .attr("text-anchor", "middle").attr("font-size", "12px").attr("font-weight", "bold").attr("fill", d => d.color)
                .attr("y", d => this.yScale(d.y) - 10)
                .merge(labels).transition().duration(duration).attr("x", d => this.xScale(d.x)).attr("y", d => this.yScale(d.y) - 10)
                .text(d => {
                    let txt = `${d.label}=${d.x.toFixed(3)}`;
                    if (d.df !== undefined) txt += ` (f'=${d.df.toFixed(3)})`;
                    return txt;
                });
                
            let compText = this.pointsLayer.selectAll("text.compare-info").data(compareInfo ? [compareInfo] : []);
            compText.exit().remove();
            compText.enter().append("text").attr("class", "compare-info")
                .attr("text-anchor", "middle").attr("font-size", "14px").attr("font-weight", "bold").attr("fill", "#d84315")
                .attr("y", 30).attr("x", this.plotWidth / 2)
                .merge(compText).text(d => d);
        }

        updatePointHistory(history, algo, subStep = 0) {
            const duration = this.duration;
            let displayHistory = [...history];
            let nextPoint = null;
            if (algo && subStep === 1 && !algo.isComplete) {
                const method = algo.constructor.name;
                if (method === "GradientDescent") {
                    nextPoint = { x: algo.xk - algo.alpha * algo.df(algo.xk) };
                } else if (method === "NewtonsMethod") {
                    const df = algo.df(algo.xk);
                    const ddf = algo.ddf(algo.xk);
                    if (Math.abs(ddf) > 1e-10) nextPoint = { x: algo.xk - df / ddf };
                } else if (method === "SecantMethod") {
                    const dfk = algo.df(algo.xk);
                    const df_prev = algo.df(algo.x_prev);
                    if (Math.abs(dfk - df_prev) > 1e-10) nextPoint = { x: algo.xk - dfk * (algo.xk - algo.x_prev) / (dfk - df_prev) };
                }
                if (nextPoint) {
                    nextPoint.y = algo.func(nextPoint.x);
                    nextPoint.isNext = true;
                }
            }
            const dataToDraw = nextPoint ? [...displayHistory, nextPoint] : displayHistory;

            const lineGen = d3.line().x(d => this.xScale(d.x)).y(d => this.yScale(d.y));
            let path = this.intervalLayer.selectAll("path.search-path").data([dataToDraw]);
            path.enter().append("path").attr("class", "search-path")
                .attr("fill", "none").attr("stroke", "#f9a825").attr("stroke-dasharray", "4,4")
                .merge(path).transition().duration(duration).attr("d", lineGen);

            let circles = this.pointsLayer.selectAll("circle.search-point").data(dataToDraw, (d, i) => i);
            circles.exit().remove();
            circles.enter().append("circle").attr("class", "search-point")
                .attr("stroke", "white").attr("stroke-width", 1.5).attr("r", 0)
                .merge(circles).transition().duration(duration).attr("r", (d, i) => (i === dataToDraw.length - 1) ? 7 : 5)
                .attr("fill", (d, i) => {
                    if (d.isNext) return "#f9a825";
                    return (i === dataToDraw.length - 1) ? "#c62828" : "#f9a825";
                })
                .attr("cx", d => this.xScale(d.x)).attr("cy", d => this.yScale(d.y));

            let labels = this.pointsLayer.selectAll("text.point-label").data(dataToDraw, (d, i) => i);
            const method = algo ? algo.constructor.name : "";
            labels.exit().remove();
            labels.enter().append("text").attr("class", "point-label")
                .attr("text-anchor", "middle").attr("font-size", "11px")
                .merge(labels).transition().duration(duration).attr("x", d => this.xScale(d.x)).attr("y", d => this.yScale(d.y) - 12)
                .text((d, i) => {
                    if (d.isNext) return "x_next";
                    if (method === "SecantMethod") return `x${toSubscript(i - 1)}`;
                    return `x${toSubscript(i)}`;
                });
        }
    }

    let prices = [];
    let demands = [];
    let rawData = [];
    let a_fit = 0, b_fit = 0; // 解析解
    let p_opt_val = 0; // 解析最优价格
    let A_ls = 0, B_ls = 0; // LS 优化项
    let x_mean = 0, y_mean = 0; // 均值
    let b_search = 0, a_search = 0; // 搜索解结果 (LS)

    let lsViz, profitViz;
    
    // 状态管理
    const AppState = {
        ls: {
            algo: null,
            subStep: 0,
            isPlaying: false,
            timer: null,
            speed: 1000,
            status: "未开始"
        },
        profit: {
            algo: null,
            subStep: 0,
            isPlaying: false,
            timer: null,
            speed: 1000,
            status: "未开始"
        }
    };

    function init() {
        lsViz = new SearchVisualizer("lsCanvas");
        profitViz = new SearchVisualizer("profitCanvas");
        loadDefaultData();
        setupEventListeners();
    }

    function setupEventListeners() {
        document.getElementById('dataFile').addEventListener('change', handleFileUpload);
        document.getElementById('loadDefaultBtn').addEventListener('click', loadDefaultData);
        document.getElementById('costInput').addEventListener('input', () => {
            updateAnalyticalResults();
            resetAlgo('profit');
        });
        document.getElementById('applyColSelection').addEventListener('click', updateDataFromSelectedColumns);

        // LS 控制
        document.getElementById('lsPlayBtn').addEventListener('click', () => togglePlay('ls'));
        document.getElementById('lsPauseBtn').addEventListener('click', () => pausePlay('ls'));
        document.getElementById('lsStepBtn').addEventListener('click', () => stepAlgo('ls'));
        document.getElementById('lsResetBtn').addEventListener('click', () => resetAlgo('ls'));
        document.getElementById('lsMethodSelect').addEventListener('change', () => {
            updateSliders('ls');
            resetAlgo('ls');
        });
        document.getElementById('lsSpeedSlider').addEventListener('input', (e) => {
            AppState.ls.speed = 2100 - parseInt(e.target.value);
            if (AppState.ls.isPlaying) {
                pausePlay('ls', true);
                togglePlay('ls');
            }
        });
        document.getElementById('lsZoomIn').addEventListener('click', () => lsViz.zoom(1.2));
        document.getElementById('lsZoomOut').addEventListener('click', () => lsViz.zoom(0.8));
        document.getElementById('lsPanLeft').addEventListener('click', () => lsViz.pan(-1));
        document.getElementById('lsPanRight').addEventListener('click', () => lsViz.pan(1));

        // Profit 控制
        document.getElementById('profitPlayBtn').addEventListener('click', () => togglePlay('profit'));
        document.getElementById('profitPauseBtn').addEventListener('click', () => pausePlay('profit'));
        document.getElementById('profitStepBtn').addEventListener('click', () => stepAlgo('profit'));
        document.getElementById('profitResetBtn').addEventListener('click', () => resetAlgo('profit'));
        document.getElementById('profitMethodSelect').addEventListener('change', () => {
            updateSliders('profit');
            resetAlgo('profit');
        });
        document.getElementById('profitSpeedSlider').addEventListener('input', (e) => {
            AppState.profit.speed = 2100 - parseInt(e.target.value);
            if (AppState.profit.isPlaying) {
                pausePlay('profit', true);
                togglePlay('profit');
            }
        });
        document.getElementById('profitZoomIn').addEventListener('click', () => profitViz.zoom(1.2));
        document.getElementById('profitZoomOut').addEventListener('click', () => profitViz.zoom(0.8));
        document.getElementById('profitPanLeft').addEventListener('click', () => profitViz.pan(-1));
        document.getElementById('profitPanRight').addEventListener('click', () => profitViz.pan(1));
    }

    function loadDefaultData() {
        prices = [10, 20, 30, 40, 50];
        demands = [200, 150, 110, 80, 60];
        rawData = [["价格", "需求"], [10,200], [20,150], [30,110], [40,80], [50,60]];
        document.getElementById('columnSelector').style.display = 'none';
        updateAll();
    }

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target.result;
            const lines = content.split(/\r?\n/).filter(l => l.trim());
            const rows = lines.map(l => l.split(',').map(s => s.trim()));
            if (rows.length < 2) return;
            rawData = rows;
            const headers = rows[0];
            const priceSelect = document.getElementById('priceColSelect');
            const demandSelect = document.getElementById('demandColSelect');
            priceSelect.innerHTML = demandSelect.innerHTML = '';
            headers.forEach((h, i) => {
                priceSelect.add(new Option(h, i));
                demandSelect.add(new Option(h, i));
            });
            priceSelect.value = 0;
            demandSelect.value = 1;
            document.getElementById('columnSelector').style.display = 'block';
            updateDataFromSelectedColumns();
        };
        reader.readAsText(file);
    }

    function updateDataFromSelectedColumns() {
        const pIdx = parseInt(document.getElementById('priceColSelect').value);
        const dIdx = parseInt(document.getElementById('demandColSelect').value);
        prices = []; demands = [];
        for(let i=1; i<rawData.length; i++) {
            const p = parseFloat(rawData[i][pIdx]), d = parseFloat(rawData[i][dIdx]);
            if(!isNaN(p) && !isNaN(d)) { prices.push(p); demands.push(d); }
        }
        updateAll();
    }

    function updateAll() {
        renderTable();
        updateAnalyticalResults();
        updateSliders('ls');
        updateSliders('profit');
        resetAlgo('ls');
        resetAlgo('profit');
    }

    function renderTable() {
        let html = '';
        const n = prices.length;
        const maxDisplay = 100;
        
        if (n <= maxDisplay) {
            prices.forEach((p, i) => {
                html += `<tr><td>${p}</td><td>${demands[i]}</td></tr>`;
            });
        } else {
            // 采样显示：前 50 条
            for (let i = 0; i < 50; i++) {
                html += `<tr><td>${prices[i]}</td><td>${demands[i]}</td></tr>`;
            }
            // 中间省略
            html += `<tr><td colspan="2" style="text-align:center; color:#888; background:#fafafa;">... 已省略 ${n - 100} 条数据 ...</td></tr>`;
            // 后 50 条
            for (let i = n - 50; i < n; i++) {
                html += `<tr><td>${prices[i]}</td><td>${demands[i]}</td></tr>`;
            }
        }
        
        const dataTableBody = document.getElementById('dataTableBody');
        if (dataTableBody) {
            dataTableBody.innerHTML = html;
        }
        document.getElementById('sampleCount').textContent = n;
    }

    function updateAnalyticalResults() {
        const n = prices.length;
        if (n < 2) return;
        x_mean = prices.reduce((a, b) => a + b, 0) / n;
        y_mean = demands.reduce((a, b) => a + b, 0) / n;
        A_ls = prices.reduce((acc, p) => acc + (p - x_mean)**2, 0);
        B_ls = prices.reduce((acc, p, i) => acc + (demands[i] - y_mean) * (p - x_mean), 0);
        b_fit = B_ls / A_ls;
        a_fit = y_mean - b_fit * x_mean;
        
        const cost = parseFloat(document.getElementById('costInput').value) || 0;
        document.getElementById('cDisplay').textContent = cost;
        p_opt_val = (b_fit * cost - a_fit) / (2 * b_fit);
    }

    function updateSliders(type) {
        const method = document.getElementById(`${type}MethodSelect`).value;
        const container = document.getElementById(`${type}Sliders`);
        container.innerHTML = '';
        const cost = parseFloat(document.getElementById('costInput').value) || 0;
        const optVal = (type === 'ls') ? b_fit : p_opt_val;
        const configs = {
            golden: [
                { id: 'a', label: '左区间 a', min: optVal - 10, max: optVal, step: 0.1, val: optVal - 1 },
                { id: 'b', label: '右区间 b', min: optVal, max: optVal + 10, step: 0.1, val: optVal + 1 },
                { id: 'eps', label: '精度 ε', min: 0.001, max: 0.1, step: 0.001, val: 0.01 }
            ],
            fib: [
                { id: 'a', label: '左区间 a', min: optVal - 10, max: optVal, step: 0.1, val: optVal - 1 },
                { id: 'b', label: '右区间 b', min: optVal, max: optVal + 10, step: 0.1, val: optVal + 1 },
                { id: 'eps', label: '修正系数 ε', min: 0.001, max: 0.1, step: 0.001, val: 0.01 },
                { id: 'n', label: '迭代次数 N', min: 2, max: 50, step: 1, val: 15 }
            ],
            bisect: [
                { id: 'a', label: '左区间 a', min: optVal - 10, max: optVal, step: 0.1, val: optVal - 1 },
                { id: 'b', label: '右区间 b', min: optVal, max: optVal + 10, step: 0.1, val: optVal + 1 },
                { id: 'eps', label: '精度 ε', min: 0.001, max: 0.1, step: 0.001, val: 0.01 }
            ],
            gd: [
                { id: 'x0', label: '初始值 x₀', min: optVal - 10, max: optVal + 10, step: 0.1, val: optVal - 1 },
                { id: 'eta', label: '学习率 η', min: 0.001, max: 1.0, step: 0.001, val: 0.01 },
                { id: 'n', label: '迭代次数 N', min: 2, max: 100, step: 1, val: 25 }
            ],
            newton: [
                { id: 'x0', label: '初始值 x₀', min: optVal - 10, max: optVal + 10, step: 0.1, val: optVal - 1 },
                { id: 'n', label: '迭代次数 N', min: 2, max: 100, step: 1, val: 25 }
            ],
            secant: [
                { id: 'x0', label: '初始值 x₀', min: optVal - 10, max: optVal + 10, step: 0.1, val: optVal - 1 },
                { id: 'x_prev', label: '初始值 x₋₁', min: optVal - 10, max: optVal + 10, step: 0.1, val: optVal - 2 },
                { id: 'n', label: '迭代次数 N', min: 2, max: 100, step: 1, val: 25 }
            ]
        };
        const currentConfigs = configs[method] || [];
        currentConfigs.forEach(conf => {
            const group = document.createElement('div');
            group.className = 'control-group';
            if (type === 'profit' && (conf.id === 'a' || conf.id === 'b' || conf.id === 'x0' || conf.id === 'x_prev')) {
                conf.min = Math.max(0, conf.min); conf.val = Math.max(0, conf.val);
            }
            group.innerHTML = `<label>${conf.label}: <span class="value-display" id="${type}-${conf.id}-val">${Number(conf.val).toFixed(3)}</span></label>
                <input type="range" id="${type}-${conf.id}-slider" min="${conf.min}" max="${conf.max}" step="${conf.step}" value="${conf.val}">`;
            container.appendChild(group);
            group.querySelector('input').addEventListener('input', (e) => {
                document.getElementById(`${type}-${conf.id}-val`).textContent = Number(e.target.value).toFixed(3);
                resetAlgo(type);
            });
        });
    }

    function resetAlgo(type) {
        const state = AppState[type];
        pausePlay(type, true);
        state.subStep = 0;
        state.status = "未开始";
        
        if (type === 'ls') {
            const ps = document.getElementById('profitSection');
            if (ps) ps.style.display = 'none';
        }
        
        const viz = type === 'ls' ? lsViz : profitViz;
        viz.currentDomain = null; // 重置视角
        
        const method = document.getElementById(`${type}MethodSelect`).value;
        let func, df, ddf, domain;
        if (type === 'ls') {
            const scale = A_ls || 1;
            func = (b) => (A_ls * b**2 - 2 * B_ls * b) / scale;
            df = (b) => (2 * A_ls * b - 2 * B_ls) / scale;
            ddf = (b) => (2 * A_ls) / scale;
            domain = [b_fit - 10, b_fit + 10];
        } else {
            const cost = parseFloat(document.getElementById('costInput').value) || 0;
            const scale = Math.abs(b_fit) || 1;
            func = (p) => -((p - cost) * (a_fit + b_fit * p)) / scale;
            df = (p) => -((a_fit + b_fit * p) + (p - cost) * b_fit) / scale;
            ddf = (p) => -(2 * b_fit) / scale;
            domain = [0, Math.max(p_opt_val * 2, 20)];
        }
        const params = {};
        document.querySelectorAll(`[id^="${type}-"][id$="-slider"]`).forEach(s => {
            params[s.id.split('-')[1]] = parseFloat(s.value);
        });
        state.algo = createAlgo(method, func, df, ddf, params);
        updateViz(type);
        updateUIButtons(type);
    }

    function createAlgo(method, func, df, ddf, params) {
        switch(method) {
            case 'bisect': return new BisectionSearch(func, df, params.a, params.b, params.eps);
            case 'golden': return new GoldenSectionSearch(func, params.a, params.b, params.eps);
            case 'fib': return new FibonacciSearch(func, params.a, params.b, params.eps, params.n);
            case 'gd': return new GradientDescent(func, df, params.x0, params.eta, params.n);
            case 'newton': return new NewtonsMethod(func, df, ddf, params.x0, params.n);
            case 'secant': return new SecantMethod(func, df, params.x0, params.x_prev, params.n);
        }
    }

    function togglePlay(type) {
        const state = AppState[type];
        if (state.algo.isComplete && state.subStep === 0) return;
        state.isPlaying = true;
        state.status = "播放中";
        updateUIButtons(type);
        state.timer = setInterval(() => {
            if (!stepAlgo(type)) {
                pausePlay(type, true);
                updateUIButtons(type);
            }
        }, state.speed);
    }

    function pausePlay(type, silent = false) {
        const state = AppState[type];
        state.isPlaying = false;
        if (state.timer) { clearInterval(state.timer); state.timer = null; }
        if (!silent) {
            if (state.algo.isComplete && state.subStep === 0) {
                state.status = "已完成";
            } else {
                state.status = "已暂停";
            }
            updateUIButtons(type);
            updateViz(type);
        }
    }

    function stepAlgo(type) {
        const state = AppState[type];
        const algo = state.algo;
        if (algo.isComplete && state.subStep === 0) return false;

        state.subStep++;
        const method = document.getElementById(`${type}MethodSelect`).value;
        const isRange = ['bisect', 'golden', 'fib'].includes(method);
        
        let completedCycle = false;
        if (isRange) {
            if (state.subStep === 4) {
                algo.iterate();
                state.subStep = 0;
                completedCycle = true;
            }
        } else {
            if (state.subStep === 2) {
                algo.iterate();
                state.subStep = 0;
                completedCycle = true;
            }
        }

        if (algo.isComplete && state.subStep === 0) {
            state.status = "已完成";
        } else if (state.isPlaying) {
            state.status = "播放中";
        } else {
            state.status = "已暂停";
        }

        updateViz(type);
        updateUIButtons(type);
        return !algo.isComplete || !completedCycle;
    }

    function updateViz(type) {
        const state = AppState[type];
        const algo = state.algo;
        const viz = type === 'ls' ? lsViz : profitViz;
        const method = document.getElementById(`${type}MethodSelect`).value;
        const isRange = ['bisect', 'golden', 'fib'].includes(method);
        
        let domain;
        if (type === 'ls') domain = [b_fit - 10, b_fit + 10];
        else {
            const cost = parseFloat(document.getElementById('costInput').value) || 0;
            domain = [0, Math.max(p_opt_val * 2, 20)];
        }

        // 自动缩放
        if (isRange) {
            viz.autoZoom([algo.a, algo.b]);
        } else {
            const points = algo.history.map(h => h.x);
            points.push(algo.xk);
            if (points.length < 2) {
                const r = (domain[1] - domain[0]) * 0.2;
                viz.autoZoom([algo.xk - r, algo.xk + r]);
            } else {
                viz.autoZoom(points);
            }
        }

        viz.update(algo.func, domain, algo.history, isRange ? "range" : "point", algo, state.subStep);
        
        const resSpan = document.getElementById(`${type}SearchRes`);
        const stepSpan = document.getElementById(`${type}StepInfo`);
        if (algo.history.length > 0 || state.subStep > 0) {
            const val = isRange ? (algo.a + algo.b) / 2 : algo.xk;
            resSpan.textContent = val.toFixed(4);
            stepSpan.textContent = `${state.status} (第 ${algo.currentIteration || algo.k || 0} 轮, 子步 ${state.subStep})`;
            
            if (type === 'ls') {
                const cur_a = y_mean - val * x_mean;
                document.getElementById('lsInterceptRes').textContent = cur_a.toFixed(4);
                document.getElementById('funcDisplay').textContent = `D(p) = ${cur_a.toFixed(2)} ${val>=0?'+':'-'} ${Math.abs(val).toFixed(2)}p`;
                
                if (algo.isComplete && state.subStep === 0) {
                    b_search = val;
                    a_search = cur_a;
                    document.getElementById('profitSection').style.display = 'block';
                    document.getElementById('aDisplayForProfit').textContent = a_search.toFixed(2);
                    document.getElementById('signDisplayForProfit').textContent = b_search >= 0 ? '+' : '-';
                    document.getElementById('bDisplayForProfit').textContent = Math.abs(b_search).toFixed(2);
                    
                    // 立即触发第二部分画布的有效重绘
                    updateViz('profit');
                }
            } else {
                const cost = parseFloat(document.getElementById('costInput').value) || 0;
                const profit = (val - cost) * (a_search + b_search * val);
                document.getElementById('profitRes').textContent = profit.toFixed(4);
            }
        } else {
            resSpan.textContent = "--";
            stepSpan.textContent = state.status;
            if (type === 'ls') {
                document.getElementById('lsInterceptRes').textContent = "--";
                document.getElementById('funcDisplay').textContent = "--";
            } else {
                document.getElementById('profitRes').textContent = "--";
            }
        }
    }

    function updateUIButtons(type) {
        const state = AppState[type];
        const isStart = state.status === "未开始";
        const isComplete = state.algo.isComplete && state.subStep === 0;

        document.getElementById(`${type}PlayBtn`).disabled = state.isPlaying || isComplete;
        document.getElementById(`${type}PauseBtn`).disabled = !state.isPlaying;
        document.getElementById(`${type}StepBtn`).disabled = state.isPlaying || isComplete;
        document.getElementById(`${type}ResetBtn`).disabled = isStart;
    }

    window.onload = init;
})();
