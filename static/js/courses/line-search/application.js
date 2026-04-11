// 一维搜索方法应用实验脚本

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

        this.history.push({x: mid, y: this.func(mid), a: this.a, b: this.b, df: dmid});

        if (Math.abs(dmid) < 1e-10) {
            this.a = mid;
            this.b = mid;
            this.isComplete = true;
            return false;
        } else if (dmid * da > 0) {
            this.a = mid;
        } else if (dmid * db > 0) {
            this.b = mid;
        } else {
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

        this.history.push({a: this.a, b: this.b, x1, x2, f1, f2});

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

        this.history.push({a: this.a, b: this.b, x1, x2, f1, f2});

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
        this.history = [{x: x0, y: func(x0), df: df(x0)}];
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
        this.history.push({x: this.xk, y: y, df: nextDf});

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
        this.history = [{x: x0, y: func(x0), df: df(x0), ddf: ddf(x0)}];
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
        this.history.push({x: this.xk, y: this.func(this.xk), df: nextDf, ddf: nextDdf});
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
            {x: x_prev, y: func(x_prev), df: df(x_prev)},
            {x: x0, y: func(x0), df: df(x0)}
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
        this.history.push({x: this.xk, y: this.func(this.xk), df: nextDf});
        if (this.currentIteration >= this.n || Math.abs(nextDf) < 1e-10) this.isComplete = true;
        return true;
    }
}

(function () {
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

    class SearchVisualizer {
        constructor(containerId) {
            this.containerId = containerId;
            this.margin = {top: 40, right: 40, bottom: 50, left: 70};
            this.container = document.getElementById(containerId);
            this.width = this.container.clientWidth;
            this.height = this.container.clientHeight || 350;

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

        resize() {
            this.width = this.container.clientWidth;
            this.height = this.container.clientHeight;
            this.plotWidth = Math.max(0, this.width - this.margin.left - this.margin.right);
            this.plotHeight = Math.max(0, this.height - this.margin.top - this.margin.bottom);

            // 只有在尺寸有效时才初始化 SVG
            if (this.width > 0 && this.height > 0) {
                this.initSvg();
                if (this.lastArgs) {
                    this.update(this.lastArgs.func, this.lastArgs.domain, this.lastArgs.history, this.lastArgs.type, this.lastArgs.algo, this.lastArgs.subStep);
                }
            }
        }

        initSvg() {
            d3.select(`#${this.containerId}`).selectAll("*").remove();
            this.svg = d3.select(`#${this.containerId}`)
                .append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("viewBox", `0 0 ${this.width} ${this.height}`)
                .style("display", "block"); // 防止 inline 元素的额外底部间距导致高度无限增长

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
            this.lastArgs = {func, domain, history, type, algo, subStep};
            this.currentFunc = func;

            // 检测并修复隐藏容器导致的尺寸为0问题
            if ((this.width <= 0 || this.height <= 0) && this.container.clientWidth > 0 && this.container.clientHeight > 0) {
                this.width = this.container.clientWidth;
                this.height = this.container.clientHeight;
                this.plotWidth = Math.max(0, this.width - this.margin.left - this.margin.right);
                this.plotHeight = Math.max(0, this.height - this.margin.top - this.margin.bottom);
                this.initSvg();
            }

            // domain 校验
            let dom = this.currentDomain || domain;
            if (!dom || !isFinite(dom[0]) || !isFinite(dom[1]) || dom[0] === dom[1]) {
                dom = [-10, 10];
            }
            this.xScale.domain(dom);

            // 自适应采样
            const rangeSamples = 100;
            let xSamples = d3.range(dom[0], dom[1], (dom[1] - dom[0]) / rangeSamples);

            const optVal = (type === "range" && algo && algo.constructor.name === "BisectionSearch") ?
                (algo.a + algo.b) / 2 : (type === "ls" ? b_fit : p_opt_val);
            if (isFinite(optVal) && optVal >= dom[0] && optVal <= dom[1]) {
                xSamples.push(optVal);
            }
            xSamples.sort((a, b) => a - b);

            // 计算 y 轴范围，增加稳健性
            const yValues = xSamples.map(x => func(x)).filter(y => isFinite(y));
            let yExtent = d3.extent(yValues);

            if (yExtent[0] === undefined) yExtent = [0, 1];
            if (yExtent[0] === yExtent[1]) yExtent = [yExtent[0] - 1, yExtent[0] + 1];

            const yPadding = (yExtent[1] - yExtent[0]) * 0.2;
            this.yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]);

            this.updateAxes();

            // 绘制曲线
            const adaptiveSamples = Math.max(200, Math.min(2000, Math.ceil(this.width)));
            const line = d3.line()
                .defined(d => isFinite(d.y) && Math.abs(d.y) < 1e25) // 过滤掉极端异常值
                .x(d => this.xScale(d.x))
                .y(d => this.yScale(d.y));

            let curvePoints = d3.range(dom[0], dom[1], (dom[1] - dom[0]) / adaptiveSamples);
            if (isFinite(optVal) && optVal >= dom[0] && optVal <= dom[1]) curvePoints.push(optVal);
            curvePoints.sort((a, b) => a - b);

            const curveData = curvePoints
                .map(x => ({x, y: func(x)}))
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
            let latest = algo ? {a: algo.a, b: algo.b} : history[history.length - 1];

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
                        trialPoints.push({
                            x: algo.a,
                            label: "f'(a)",
                            y: algo.func(algo.a),
                            df: algo.df(algo.a),
                            color: '#d84315'
                        });
                        trialPoints.push({
                            x: algo.b,
                            label: "f'(b)",
                            y: algo.func(algo.b),
                            df: algo.df(algo.b),
                            color: '#d84315'
                        });
                    }
                    if (subStep >= 2) {
                        const mid = (algo.a + algo.b) / 2;
                        trialPoints.push({x: mid, label: 'm', y: algo.func(mid), df: algo.df(mid), color: '#f9a825'});
                    }
                    if (subStep >= 3) {
                        const mid = (algo.a + algo.b) / 2;
                        const dmid = algo.df(mid);
                        const da = algo.df(algo.a);
                        if (Math.abs(dmid) < 1e-10) {
                            compareInfo = "f'(m)=0 \u2192 输出极小值点";
                        } else {
                            compareInfo = (dmid * da > 0) ? "f'(m) \u4e0e f'(a) \u540c\u53f7 \u2192 \u820d\u5f03\u5de6\u533a\u95f4" : "f'(m) \u4e0e f'(b) \u540c\u53f7 \u2192 \u820d\u5f03\u53f3\u533a\u95f4";
                        }
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
                    nextPoint = {x: algo.xk - algo.alpha * algo.df(algo.xk)};
                } else if (method === "NewtonsMethod") {
                    const df = algo.df(algo.xk);
                    const ddf = algo.ddf(algo.xk);
                    if (Math.abs(ddf) > 1e-10) nextPoint = {x: algo.xk - df / ddf};
                } else if (method === "SecantMethod") {
                    const dfk = algo.df(algo.xk);
                    const df_prev = algo.df(algo.x_prev);
                    if (Math.abs(dfk - df_prev) > 1e-10) nextPoint = {x: algo.xk - dfk * (algo.xk - algo.x_prev) / (dfk - df_prev)};
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
            speed: 1100,
            status: "未开始",
            method: "",
            // 记录本次 LS 实验的初始设置与完整迭代数据
            initialParams: {},
            targetLabel: "",
            iterationLog: []
        },
        profit: {
            algo: null,
            subStep: 0,
            isPlaying: false,
            timer: null,
            speed: 1100,
            status: "未开始",
            method: "",
            // 记录本次利润优化实验的初始设置与完整迭代数据
            initialParams: {},
            targetLabel: "",
            iterationLog: []
        },
        data: {
            source: 'default',
            uploadedFiles: [],
            headers: [],
            sample_count: 0
        }
    };

    window.AppState = AppState;

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

        function speedLabel(sliderValue) {
            const v = Number(sliderValue);
            if (!isFinite(v)) return '—';
            // slider 越大，播放越快（delay = 2100 - slider）
            if (v <= 500) return '很慢';
            if (v <= 900) return '较慢';
            if (v <= 1300) return '正常';
            if (v <= 1700) return '较快';
            return '很快';
        }

        const lsSpeedValueEl = document.getElementById('lsSpeedValue');
        const profitSpeedValueEl = document.getElementById('profitSpeedValue');

        function syncSpeedLabels() {
            const lsSlider = document.getElementById('lsSpeedSlider');
            const profitSlider = document.getElementById('profitSpeedSlider');
            if (lsSlider && lsSpeedValueEl) lsSpeedValueEl.textContent = speedLabel(lsSlider.value);
            if (profitSlider && profitSpeedValueEl) profitSpeedValueEl.textContent = speedLabel(profitSlider.value);
        }

        document.getElementById('lsSpeedSlider').addEventListener('input', (e) => {
            AppState.ls.speed = Math.round(2100 - Number(e.target.value));
            if (lsSpeedValueEl) lsSpeedValueEl.textContent = speedLabel(e.target.value);
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
            AppState.profit.speed = Math.round(2100 - Number(e.target.value));
            if (profitSpeedValueEl) profitSpeedValueEl.textContent = speedLabel(e.target.value);
            if (AppState.profit.isPlaying) {
                pausePlay('profit', true);
                togglePlay('profit');
            }
        });
        document.getElementById('profitZoomIn').addEventListener('click', () => profitViz.zoom(1.2));
        document.getElementById('profitZoomOut').addEventListener('click', () => profitViz.zoom(0.8));
        document.getElementById('profitPanLeft').addEventListener('click', () => profitViz.pan(-1));
        document.getElementById('profitPanRight').addEventListener('click', () => profitViz.pan(1));

        // 首次进入时同步一次速度文案（避免默认显示不一致）
        syncSpeedLabels();

        // 最小二乘迭代数据查看/导出
        const lsOpenBtn = document.getElementById('ls-iteration-log-open-btn');
        const lsExportBtn = document.getElementById('ls-iteration-log-export-csv-btn');
        const lsModal = document.getElementById('ls-iteration-log-modal');
        const lsCloseBtn = document.getElementById('ls-iteration-log-close');

        // 面板折叠
        document.querySelectorAll('.panel-header').forEach(header => {
            header.addEventListener('click', () => {
                const panel = header.parentElement;
                panel.classList.toggle('collapsed');
                // 动画结束后触发重绘
                setTimeout(() => {
                    if (lsViz) lsViz.resize();
                    if (profitViz) profitViz.resize();
                }, 310);
            });
        });

        window.addEventListener('resize', () => {
            if (lsViz) lsViz.resize();
            if (profitViz) profitViz.resize();
        });

        function renderLsIterationLog() {
            const tbody = document.getElementById('ls-iteration-log-body');
            const methodSpan = document.getElementById('ls-iteration-log-summary-method');
            const initSpan = document.getElementById('ls-iteration-log-summary-init');
            const targetSpan = document.getElementById('ls-iteration-log-summary-target');
            const countSpan = document.getElementById('ls-iteration-log-summary-count');
            const finalBox = document.getElementById('ls-iteration-log-final-summary');

            let log = Array.isArray(AppState.ls.iterationLog) ? AppState.ls.iterationLog : [];

            // 仅对点搜索类方法（GD / Newton / Secant）做 history 兜底；
            // 区间类方法（golden/fib/bisect）由 recordIteration 按当前区间推导 β 与 L(β)
            const methodForLs = AppState.ls.method || '';
            const isRangeMethodLs = ['golden', 'bisect', 'fib'].includes(methodForLs);

            if ((!log || !log.length) &&
                !isRangeMethodLs &&
                AppState.ls.algo &&
                Array.isArray(AppState.ls.algo.history)) {
                const algo = AppState.ls.algo;
                log = algo.history.map((h, idx) => {
                    const beta = typeof h.x === 'number' ? h.x : algo.xk;
                    const L = typeof h.y === 'number' ? h.y : algo.func(beta);
                    const dL = typeof h.df === 'number'
                        ? h.df
                        : (typeof algo.df === 'function' ? algo.df(beta) : null);
                    const ddL = typeof h.ddf === 'number' ? h.ddf : null;
                    return {
                        iteration: idx,
                        beta,
                        L,
                        dL,
                        ddL,
                        is_complete: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                        has_converged: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                        termination_reason: null,
                        result: idx === algo.history.length - 1 && algo.isComplete ? (algo.xk ?? beta) : null,
                        timestamp: ''
                    };
                });
                AppState.ls.iterationLog = log;
            }

            if (methodSpan) methodSpan.textContent = AppState.ls.method || '--';
            if (initSpan) initSpan.textContent = AppState.ls.initialParams && Object.keys(AppState.ls.initialParams).length
                ? JSON.stringify(AppState.ls.initialParams)
                : '--';
            if (targetSpan) targetSpan.textContent = AppState.ls.targetLabel || '--';
            if (countSpan) countSpan.textContent = String(log.length);

            if (!log.length) {
                if (tbody) {
                    tbody.innerHTML =
                        '<tr><td colspan="6" style="padding: 8px 4px; color: #777;">当前尚无迭代数据，请先运行一次完整拟合实验。</td></tr>';
                }
                if (finalBox) {
                    finalBox.style.display = 'none';
                    finalBox.textContent = '';
                }
                return;
            }

            const final =
                [...log].reverse().find(row => row.is_complete && row.result != null) || null;
            if (final && finalBox) {
                const betaStar = Number(final.beta).toFixed(6);
                finalBox.style.display = 'block';
                finalBox.textContent =
                    `根据记录的迭代数据，本次实验已完成：在第 ${final.iteration} 次迭代附近得到近似最优参数 β* ≈ ${betaStar}，对应 L(β*) ≈ ${Number(final.L).toFixed(6)}，梯度 ≈ ${final.dL != null ? Number(final.dL).toFixed(6) : '—'}。`;
            } else if (finalBox) {
                finalBox.style.display = 'none';
                finalBox.textContent = '';
            }

            if (tbody) {
                tbody.innerHTML = log.map(row => {
                    let statusLabel;
                    if (!row.is_complete) {
                        statusLabel = '迭代进行中';
                    } else if (row.has_converged) {
                        statusLabel = '已完成（已收敛）';
                    } else {
                        statusLabel = '已终止（未收敛）';
                    }
                    const isFinal = final && final.iteration === row.iteration;
                    const rowStyle = isFinal
                        ? 'background-color: #fff8e1; font-weight: 600;'
                        : '';
                    return `<tr style="${rowStyle}">
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${row.iteration}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${Number(row.beta).toFixed(6)}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${Number(row.L).toFixed(6)}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${row.dL != null ? Number(row.dL).toFixed(6) : '—'}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${row.ddL != null ? Number(row.ddL).toFixed(6) : '—'}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${statusLabel}</td>
</tr>`;
                }).join('');
            }
        }

        if (lsOpenBtn && lsModal && lsCloseBtn) {
            lsOpenBtn.addEventListener('click', () => {
                renderLsIterationLog();
                lsModal.style.display = 'flex';
            });
            lsCloseBtn.addEventListener('click', () => {
                lsModal.style.display = 'none';
            });
            lsModal.addEventListener('click', (e) => {
                if (e.target === lsModal) {
                    lsModal.style.display = 'none';
                }
            });
        }

        if (lsExportBtn) {
            lsExportBtn.addEventListener('click', () => {
                let log = Array.isArray(AppState.ls.iterationLog) ? AppState.ls.iterationLog : [];

                // 日志为空时用 history 回填
                const methodForLs = AppState.ls.method || '';
                const isRangeMethodLs = ['golden', 'bisect', 'fib'].includes(methodForLs);
                if ((!log || !log.length) &&
                    !isRangeMethodLs &&
                    AppState.ls.algo &&
                    Array.isArray(AppState.ls.algo.history)) {
                    const algo = AppState.ls.algo;
                    log = algo.history.map((h, idx) => {
                        const beta = typeof h.x === 'number' ? h.x : algo.xk;
                        const L = typeof h.y === 'number' ? h.y : algo.func(beta);
                        const dL = typeof h.df === 'number'
                            ? h.df
                            : (typeof algo.df === 'function' ? algo.df(beta) : null);
                        const ddL = typeof h.ddf === 'number' ? h.ddf : null;
                        return {
                            iteration: idx,
                            beta,
                            L,
                            dL,
                            ddL,
                            is_complete: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                            has_converged: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                            termination_reason: null,
                            result: idx === algo.history.length - 1 && algo.isComplete ? (algo.xk ?? beta) : null,
                            timestamp: ''
                        };
                    });
                    AppState.ls.iterationLog = log;
                }

                if (!log.length) {
                    alert('当前尚无迭代数据，请先运行一次完整拟合实验。');
                    return;
                }
                const esc = v => {
                    const s = String(v ?? '');
                    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
                };
                const summary = [
                    ['项目', '值'],
                    ['原函数/目标', 'L(β)'],
                    ['算法', AppState.ls.method || ''],
                    ['初始参数', JSON.stringify(AppState.ls.initialParams || {})],
                    []
                ];
                const header = [
                    'iteration',
                    'method',
                    'beta',
                    'L',
                    'dL',
                    'ddL',
                    'target',
                    'initial_params',
                    'is_complete',
                    'has_converged',
                    'termination_reason',
                    'result',
                    'timestamp'
                ];
                const rows = log.map(row => [
                    row.iteration,
                    AppState.ls.method,
                    row.beta,
                    row.L,
                    row.dL != null ? row.dL : '',
                    row.ddL != null ? row.ddL : '',
                    AppState.ls.targetLabel || '',
                    JSON.stringify(AppState.ls.initialParams || {}),
                    row.is_complete ? 'true' : 'false',
                    row.has_converged ? 'true' : 'false',
                    row.termination_reason || '',
                    row.result != null ? row.result : '',
                    row.timestamp || ''
                ]);
                const csvLines = [...summary, header, ...rows].map(cols => cols.map(esc).join(',')).join('\n');

                const blob = new Blob([csvLines], {type: 'text/csv;charset=utf-8;'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'line-search.application.ls-iterations.csv';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
        }

        const lsSaveToProfileBtn = document.getElementById('ls-iteration-log-save-to-profile-btn');
        if (lsSaveToProfileBtn && typeof apiPost === 'function' && typeof getStoredToken === 'function') {
            lsSaveToProfileBtn.addEventListener('click', () => {
                if (!getStoredToken()) {
                    alert('请先登录后再保存至个人中心。');
                    return;
                }
                let log = Array.isArray(AppState.ls.iterationLog) ? AppState.ls.iterationLog : [];
                const methodForLs = AppState.ls.method || '';
                const isRangeMethodLs = ['golden', 'bisect', 'fib'].includes(methodForLs);
                if ((!log || !log.length) && !isRangeMethodLs && AppState.ls.algo && Array.isArray(AppState.ls.algo.history)) {
                    const algo = AppState.ls.algo;
                    log = algo.history.map((h, idx) => ({
                        iteration: idx,
                        beta: typeof h.x === 'number' ? h.x : algo.xk,
                        L: typeof h.y === 'number' ? h.y : algo.func(typeof h.x === 'number' ? h.x : algo.xk),
                        dL: typeof h.df === 'number' ? h.df : (typeof algo.df === 'function' ? algo.df(typeof h.x === 'number' ? h.x : algo.xk) : null),
                        ddL: typeof h.ddf === 'number' ? h.ddf : null,
                        is_complete: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                        has_converged: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                        termination_reason: null,
                        result: idx === algo.history.length - 1 && algo.isComplete ? (algo.xk ?? h.x) : null,
                        timestamp: ''
                    }));
                }
                if (!log.length) {
                    alert('当前尚无迭代数据，请先运行一次完整拟合实验后再保存。');
                    return;
                }
                const methodLabels = {
                    golden: '黄金分割法',
                    fib: '斐波那契数列法',
                    bisect: '二分法',
                    gd: '梯度下降法',
                    newton: '牛顿法',
                    secant: '割线法'
                };
                const alias = window.prompt('请输入本次实验的别名（用于在个人中心识别）：', '');
                if (alias == null || String(alias).trim() === '') return;
                const payload = {
                    algorithm_name: methodLabels[methodForLs] || methodForLs || '一维搜索',
                    test_function: 'L(β)',
                    initial_state: AppState.ls.initialParams || {},
                    iteration_data: log
                };
                apiPost('/experiments/records', {
                    alias: String(alias).trim(),
                    source_page: 'line-search.application.main',
                    payload
                })
                    .then(() => alert('已保存至个人中心。'))
                    .catch(() => alert('保存失败，请检查登录状态后重试。'));
            });
        }

        // 利润优化迭代数据查看/导出
        const profitOpenBtn = document.getElementById('profit-iteration-log-open-btn');
        const profitExportBtn = document.getElementById('profit-iteration-log-export-csv-btn');
        const profitModal = document.getElementById('profit-iteration-log-modal');
        const profitCloseBtn = document.getElementById('profit-iteration-log-close');

        function renderProfitIterationLog() {
            const tbody = document.getElementById('profit-iteration-log-body');
            const methodSpan = document.getElementById('profit-iteration-log-summary-method');
            const funcSpan = document.getElementById('profit-iteration-log-summary-func');
            const costSpan = document.getElementById('profit-iteration-log-summary-cost');
            const initSpan = document.getElementById('profit-iteration-log-summary-init');
            const targetSpan = document.getElementById('profit-iteration-log-summary-target');
            const countSpan = document.getElementById('profit-iteration-log-summary-count');
            const finalBox = document.getElementById('profit-iteration-log-final-summary');

            let log = Array.isArray(AppState.profit.iterationLog) ? AppState.profit.iterationLog : [];

            // 如果迭代日志为空但算法已有历史记录，基于 history 回填一份日志，保证实验数据可查看
            if ((!log || !log.length) && AppState.profit.algo && Array.isArray(AppState.profit.algo.history)) {
                const algo = AppState.profit.algo;
                log = algo.history.map((h, idx) => ({
                    iteration: idx,
                    p: typeof h.x === 'number' ? h.x : algo.xk,
                    neg_profit: typeof h.y === 'number' ? h.y : algo.func(typeof h.x === 'number' ? h.x : algo.xk),
                    d_neg_profit: typeof h.df === 'number'
                        ? h.df
                        : (typeof algo.df === 'function' ? algo.df(typeof h.x === 'number' ? h.x : algo.xk) : null),
                    dd_neg_profit: typeof h.ddf === 'number' ? h.ddf : null,
                    is_complete: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                    has_converged: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                    termination_reason: null,
                    result: idx === algo.history.length - 1 && algo.isComplete ? (algo.xk ?? h.x) : null,
                    timestamp: ''
                }));
                AppState.profit.iterationLog = log;
            }

            if (funcSpan) funcSpan.textContent = '-π(p)';
            if (methodSpan) methodSpan.textContent = AppState.profit.method || '--';
            if (costSpan) costSpan.textContent = AppState.profit.initialParams && AppState.profit.initialParams.cost != null
                ? String(AppState.profit.initialParams.cost)
                : '--';
            if (initSpan) initSpan.textContent = AppState.profit.initialParams && Object.keys(AppState.profit.initialParams).length
                ? JSON.stringify(AppState.profit.initialParams)
                : '--';
            if (targetSpan) targetSpan.textContent = AppState.profit.targetLabel || '--';
            if (countSpan) countSpan.textContent = String(log.length);

            if (!log.length) {
                if (tbody) {
                    tbody.innerHTML =
                        '<tr><td colspan="6" style="padding: 8px 4px; color: #777;">当前尚无迭代数据，请先运行一次完整利润优化实验。</td></tr>';
                }
                if (finalBox) {
                    finalBox.style.display = 'none';
                    finalBox.textContent = '';
                }
                return;
            }

            const final =
                [...log].reverse().find(row => row.is_complete && row.result != null) || null;
            if (final && finalBox) {
                const pStar = Number(final.p).toFixed(6);
                finalBox.style.display = 'block';
                finalBox.textContent =
                    `根据记录的迭代数据，本次实验已完成：在第 ${final.iteration} 次迭代附近得到近似最优定价 p* ≈ ${pStar}，对应 -π(p*) ≈ ${Number(final.neg_profit).toFixed(6)}，一阶导 ≈ ${final.d_neg_profit != null ? Number(final.d_neg_profit).toFixed(6) : '—'}。`;
            } else if (finalBox) {
                finalBox.style.display = 'none';
                finalBox.textContent = '';
            }

            if (tbody) {
                tbody.innerHTML = log.map(row => {
                    let statusLabel;
                    if (!row.is_complete) {
                        statusLabel = '迭代进行中';
                    } else if (row.has_converged) {
                        statusLabel = '已完成（已收敛）';
                    } else {
                        statusLabel = '已终止（未收敛）';
                    }
                    const isFinal = final && final.iteration === row.iteration;
                    const rowStyle = isFinal
                        ? 'background-color: #fff8e1; font-weight: 600;'
                        : '';
                    return `<tr style="${rowStyle}">
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${row.iteration}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${Number(row.p).toFixed(6)}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${Number(row.neg_profit).toFixed(6)}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${row.d_neg_profit != null ? Number(row.d_neg_profit).toFixed(6) : '—'}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${row.dd_neg_profit != null ? Number(row.dd_neg_profit).toFixed(6) : '—'}</td>
    <td style="border-bottom: 1px solid #eee; padding: 4px;">${statusLabel}</td>
</tr>`;
                }).join('');
            }
        }

        if (profitOpenBtn && profitModal && profitCloseBtn) {
            profitOpenBtn.addEventListener('click', () => {
                renderProfitIterationLog();
                profitModal.style.display = 'flex';
            });
            profitCloseBtn.addEventListener('click', () => {
                profitModal.style.display = 'none';
            });
            profitModal.addEventListener('click', (e) => {
                if (e.target === profitModal) {
                    profitModal.style.display = 'none';
                }
            });
        }

        if (profitExportBtn) {
            profitExportBtn.addEventListener('click', () => {
                let log = Array.isArray(AppState.profit.iterationLog) ? AppState.profit.iterationLog : [];

                // 日志为空时用 history 回填
                const methodForProfit = AppState.profit.method || '';
                const isRangeMethodProfit = ['golden', 'bisect', 'fib'].includes(methodForProfit);
                if ((!log || !log.length) &&
                    !isRangeMethodProfit &&
                    AppState.profit.algo &&
                    Array.isArray(AppState.profit.algo.history)) {
                    const algo = AppState.profit.algo;
                    log = algo.history.map((h, idx) => {
                        const p = typeof h.x === 'number' ? h.x : algo.xk;
                        const negProfit = typeof h.y === 'number' ? h.y : algo.func(p);
                        const dNeg = typeof h.df === 'number'
                            ? h.df
                            : (typeof algo.df === 'function' ? algo.df(p) : null);
                        const ddNeg = typeof h.ddf === 'number' ? h.ddf : null;
                        return {
                            iteration: idx,
                            p,
                            neg_profit: negProfit,
                            d_neg_profit: dNeg,
                            dd_neg_profit: ddNeg,
                            is_complete: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                            has_converged: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                            termination_reason: null,
                            result: idx === algo.history.length - 1 && algo.isComplete ? (algo.xk ?? p) : null,
                            timestamp: ''
                        };
                    });
                    AppState.profit.iterationLog = log;
                }

                if (!log.length) {
                    alert('当前尚无迭代数据，请先运行一次完整利润优化实验。');
                    return;
                }
                const esc = v => {
                    const s = String(v ?? '');
                    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
                };
                const summary = [
                    ['项目', '值'],
                    ['原函数/目标', '-π(p)'],
                    ['算法', AppState.profit.method || ''],
                    ['初始参数', JSON.stringify(AppState.profit.initialParams || {})],
                    []
                ];
                const header = [
                    'iteration',
                    'method',
                    'p',
                    'neg_profit',
                    'd_neg_profit',
                    'dd_neg_profit',
                    'target',
                    'initial_params',
                    'is_complete',
                    'has_converged',
                    'termination_reason',
                    'result',
                    'timestamp'
                ];
                const rows = log.map(row => [
                    row.iteration,
                    AppState.profit.method,
                    row.p,
                    row.neg_profit,
                    row.d_neg_profit != null ? row.d_neg_profit : '',
                    row.dd_neg_profit != null ? row.dd_neg_profit : '',
                    AppState.profit.targetLabel || '',
                    JSON.stringify(AppState.profit.initialParams || {}),
                    row.is_complete ? 'true' : 'false',
                    row.has_converged ? 'true' : 'false',
                    row.termination_reason || '',
                    row.result != null ? row.result : '',
                    row.timestamp || ''
                ]);
                const csvLines = [...summary, header, ...rows].map(cols => cols.map(esc).join(',')).join('\n');

                const blob = new Blob([csvLines], {type: 'text/csv;charset=utf-8;'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'line-search.application.profit-iterations.csv';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
        }

        const profitSaveToProfileBtn = document.getElementById('profit-iteration-log-save-to-profile-btn');
        if (profitSaveToProfileBtn && typeof apiPost === 'function' && typeof getStoredToken === 'function') {
            profitSaveToProfileBtn.addEventListener('click', () => {
                if (!getStoredToken()) {
                    alert('请先登录后再保存至个人中心。');
                    return;
                }
                let log = Array.isArray(AppState.profit.iterationLog) ? AppState.profit.iterationLog : [];
                if ((!log || !log.length) && AppState.profit.algo && Array.isArray(AppState.profit.algo.history)) {
                    const algo = AppState.profit.algo;
                    log = algo.history.map((h, idx) => ({
                        iteration: idx,
                        p: typeof h.x === 'number' ? h.x : algo.xk,
                        neg_profit: typeof h.y === 'number' ? h.y : algo.func(typeof h.x === 'number' ? h.x : algo.xk),
                        d_neg_profit: typeof h.df === 'number' ? h.df : (typeof algo.df === 'function' ? algo.df(typeof h.x === 'number' ? h.x : algo.xk) : null),
                        dd_neg_profit: typeof h.ddf === 'number' ? h.ddf : null,
                        is_complete: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                        has_converged: idx === algo.history.length - 1 ? !!algo.isComplete : false,
                        termination_reason: null,
                        result: idx === algo.history.length - 1 && algo.isComplete ? (algo.xk ?? h.x) : null,
                        timestamp: ''
                    }));
                    AppState.profit.iterationLog = log;
                }
                if (!log.length) {
                    alert('当前尚无迭代数据，请先运行一次完整利润优化实验后再保存。');
                    return;
                }
                const methodLabels = {
                    golden: '黄金分割法',
                    fib: '斐波那契数列法',
                    bisect: '二分法',
                    gd: '梯度下降法',
                    newton: '牛顿法',
                    secant: '割线法'
                };
                const methodForProfit = AppState.profit.method || '';
                const alias = window.prompt('请输入本次实验的别名（用于在个人中心识别）：', '');
                if (alias == null || String(alias).trim() === '') return;
                const payload = {
                    algorithm_name: methodLabels[methodForProfit] || methodForProfit || '一维搜索',
                    test_function: '-π(p)',
                    initial_state: AppState.profit.initialParams || {},
                    iteration_data: log
                };
                apiPost('/experiments/records', {
                    alias: String(alias).trim(),
                    source_page: 'line-search.application.main',
                    payload
                })
                    .then(() => alert('已保存至个人中心。'))
                    .catch(() => alert('保存失败，请检查登录状态后重试。'));
            });
        }
    }

    function loadDefaultData() {
        prices = [10, 20, 30, 40, 50];
        demands = [200, 150, 110, 80, 60];
        rawData = [["价格", "需求"], [10, 200], [20, 150], [30, 110], [40, 80], [50, 60]];
        AppState.data.source = 'default';
        AppState.data.uploadedFiles = [];
        AppState.data.headers = ['价格', '需求'];
        AppState.data.sample_count = prices.length;
        if (window.ExperimentNotes && typeof window.ExperimentNotes.trackEvent === 'function') {
            window.ExperimentNotes.trackEvent('dataset_reset_default', {sample_count: prices.length});
        }
        document.getElementById('columnSelector').style.display = 'none';
        document.getElementById('applyColSelection').style.display = 'none';
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
            AppState.data.source = 'uploaded_csv';
            AppState.data.headers = headers.slice();
            AppState.data.sample_count = Math.max(0, rows.length - 1);
            AppState.data.uploadedFiles = [{
                name: file.name,
                size: file.size,
                type: file.type || 'text/csv',
                text_preview: String(content || '').slice(0, 6000)
            }];
            if (window.ExperimentNotes && typeof window.ExperimentNotes.trackEvent === 'function') {
                window.ExperimentNotes.trackEvent('upload_csv', {file_name: file.name, file_size: file.size});
            }
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
            document.getElementById('applyColSelection').style.display = 'inline-block';
            updateDataFromSelectedColumns();
        };
        reader.readAsText(file);
    }

    function updateDataFromSelectedColumns() {
        const pIdx = parseInt(document.getElementById('priceColSelect').value);
        const dIdx = parseInt(document.getElementById('demandColSelect').value);
        prices = [];
        demands = [];
        for (let i = 1; i < rawData.length; i++) {
            const p = parseFloat(rawData[i][pIdx]), d = parseFloat(rawData[i][dIdx]);
            if (!isNaN(p) && !isNaN(d)) {
                prices.push(p);
                demands.push(d);
            }
        }
        AppState.data.sample_count = prices.length;
        if (window.ExperimentNotes && typeof window.ExperimentNotes.trackEvent === 'function') {
            window.ExperimentNotes.trackEvent('apply_columns', {
                price_col: pIdx,
                demand_col: dIdx,
                sample_count: prices.length
            });
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
        A_ls = prices.reduce((acc, p) => acc + (p - x_mean) ** 2, 0);
        B_ls = prices.reduce((acc, p, i) => acc + (demands[i] - y_mean) * (p - x_mean), 0);
        b_fit = B_ls / A_ls;
        a_fit = y_mean - b_fit * x_mean;

        const cost = parseFloat(document.getElementById('costInput').value) || 0;
        document.getElementById('cDisplay').textContent = cost;
        p_opt_val = (b_fit * cost - a_fit) / (2 * b_fit);

        window.a_fit = a_fit;
        window.b_fit = b_fit;
        window.p_opt_val = p_opt_val;
    }

    function updateSliders(type) {
        const method = document.getElementById(`${type}MethodSelect`).value;
        const container = document.getElementById(`${type}Sliders`);
        container.innerHTML = '';

        const cost = parseFloat(document.getElementById('costInput').value) || 0;
        const optVal = (type === 'ls') ? b_fit : p_opt_val;
        const configs = {
            golden: [
                {id: 'a', label: '左区间 a', min: optVal - 10, max: optVal, step: 0.1, val: optVal - 1},
                {id: 'b', label: '右区间 b', min: optVal, max: optVal + 10, step: 0.1, val: optVal + 1},
                {id: 'eps', label: '精度 ε', min: 0.001, max: 0.1, step: 0.001, val: 0.01}
            ],
            fib: [
                {id: 'a', label: '左区间 a', min: optVal - 10, max: optVal, step: 0.1, val: optVal - 1},
                {id: 'b', label: '右区间 b', min: optVal, max: optVal + 10, step: 0.1, val: optVal + 1},
                {id: 'eps', label: '修正系数 ε', min: 0.001, max: 0.1, step: 0.001, val: 0.01},
                {id: 'n', label: '迭代次数 N', min: 2, max: 50, step: 1, val: 15}
            ],
            bisect: [
                {id: 'a', label: '左区间 a', min: optVal - 10, max: optVal, step: 0.1, val: optVal - 1},
                {id: 'b', label: '右区间 b', min: optVal, max: optVal + 10, step: 0.1, val: optVal + 1},
                {id: 'eps', label: '精度 ε', min: 0.001, max: 0.1, step: 0.001, val: 0.01}
            ],
            gd: [
                {id: 'x0', label: '初始值 x₀', min: optVal - 10, max: optVal + 10, step: 0.1, val: optVal - 1},
                {id: 'eta', label: '学习率 η', min: 0.001, max: 1.0, step: 0.001, val: 0.01},
                {id: 'n', label: '迭代次数 N', min: 2, max: 100, step: 1, val: 25}
            ],
            newton: [
                {id: 'x0', label: '初始值 x₀', min: optVal - 10, max: optVal + 10, step: 0.1, val: optVal - 1},
                {id: 'n', label: '迭代次数 N', min: 2, max: 100, step: 1, val: 25}
            ],
            secant: [
                {id: 'x0', label: '初始值 x₀', min: optVal - 10, max: optVal + 10, step: 0.1, val: optVal - 1},
                {id: 'x_prev', label: '初始值 x₋₁', min: optVal - 10, max: optVal + 10, step: 0.1, val: optVal - 2},
                {id: 'n', label: '迭代次数 N', min: 2, max: 100, step: 1, val: 25}
            ]
        };
        const currentConfigs = configs[method] || [];

        // 根据是否有配置项显示或隐藏滑块面板
        if (currentConfigs.length > 0) {
            container.style.display = 'grid';
        } else {
            container.style.display = 'none';
        }

        currentConfigs.forEach(conf => {
            const group = document.createElement('div');
            group.className = 'control-group';
            if (type === 'profit' && (conf.id === 'a' || conf.id === 'b' || conf.id === 'x0' || conf.id === 'x_prev')) {
                conf.min = Math.max(0, conf.min);
                conf.val = Math.max(0, conf.val);
            }
            group.innerHTML = `<label>${conf.label}: <span class="value-display" id="${type}-${conf.id}-val">${Number(conf.val).toFixed(3)}</span></label>
                <input type="range" id="${type}-${conf.id}-slider" min="${conf.min}" max="${conf.max}" step="${conf.step}" value="${conf.val}">`;
            container.appendChild(group);
            group.querySelector('input').addEventListener('input', (e) => {
                document.getElementById(`${type}-${conf.id}-val`).textContent = Number(e.target.value).toFixed(3);
                resetAlgo(type);
            });
        });
        // 延时等待 DOM 更新和 CSS :empty 生效后重新调整画布
        setTimeout(() => {
            const viz = type === 'ls' ? lsViz : profitViz;
            if (viz && typeof viz.resize === 'function') {
                viz.resize();
            }
        }, 50);
    }

    function resetAlgo(type) {
        const state = AppState[type];
        pausePlay(type, true);
        state.subStep = 0;
        state.status = "未开始";
        state.method = document.getElementById(`${type}MethodSelect`).value;
        state.iterationLog = [];

        if (type === 'ls') {
            const ps = document.getElementById('profitSection');
            if (ps) ps.style.display = 'none';
        }

        const viz = type === 'ls' ? lsViz : profitViz;
        viz.currentDomain = null; // 重置视角

        const method = state.method;
        let func, df, ddf, domain;
        if (type === 'ls') {
            const scale = A_ls || 1;
            func = (b) => (A_ls * b ** 2 - 2 * B_ls * b) / scale;
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

        // 记录本次实验的初始参数与终止条件描述
        if (type === 'ls') {
            if (['golden', 'bisect', 'fib'].includes(method)) {
                state.initialParams = {
                    a: params.a,
                    b: params.b,
                    eps: params.eps,
                    n: params.n
                };
            } else if (method === 'gd') {
                state.initialParams = {
                    x0: params.x0,
                    eta: params.eta,
                    n: params.n
                };
            } else if (method === 'newton') {
                state.initialParams = {
                    x0: params.x0,
                    n: params.n
                };
            } else if (method === 'secant') {
                state.initialParams = {
                    x0: params.x0,
                    x_prev: params.x_prev,
                    n: params.n
                };
            }
        } else {
            const cost = parseFloat(document.getElementById('costInput').value) || 0;
            if (['golden', 'bisect', 'fib'].includes(method)) {
                state.initialParams = {
                    a: params.a,
                    b: params.b,
                    eps: params.eps,
                    n: params.n,
                    cost
                };
            } else if (method === 'gd') {
                state.initialParams = {
                    x0: params.x0,
                    eta: params.eta,
                    n: params.n,
                    cost
                };
            } else if (method === 'newton') {
                state.initialParams = {
                    x0: params.x0,
                    n: params.n,
                    cost
                };
            } else if (method === 'secant') {
                state.initialParams = {
                    x0: params.x0,
                    x_prev: params.x_prev,
                    n: params.n,
                    cost
                };
            }
        }

        if (['golden', 'bisect'].includes(method)) {
            state.targetLabel = `目标精度 ε = ${params.eps}`;
        } else if (method === 'fib') {
            state.targetLabel = `修正系数 ε = ${params.eps}；迭代次数 N = ${params.n}`;
        } else if (method === 'gd') {
            state.targetLabel = `学习率 η = ${params.eta}；最大迭代次数 N = ${params.n}`;
        } else {
            state.targetLabel = `最大迭代次数 N = ${params.n}`;
        }

        updateViz(type);
        updateUIButtons(type);
    }

    function createAlgo(method, func, df, ddf, params) {
        switch (method) {
            case 'bisect':
                return new BisectionSearch(func, df, params.a, params.b, params.eps);
            case 'golden':
                return new GoldenSectionSearch(func, params.a, params.b, params.eps);
            case 'fib':
                return new FibonacciSearch(func, params.a, params.b, params.eps, params.n);
            case 'gd':
                return new GradientDescent(func, df, params.x0, params.eta, params.n);
            case 'newton':
                return new NewtonsMethod(func, df, ddf, params.x0, params.n);
            case 'secant':
                return new SecantMethod(func, df, params.x0, params.x_prev, params.n);
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
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
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
                const moved = algo.iterate();
                const justCompleted = !moved && algo.isComplete;
                if (moved || justCompleted) {
                    recordIteration(type);
                }
                state.subStep = 0;
                completedCycle = true;
            }
        } else {
            if (state.subStep === 2) {
                const moved = algo.iterate();
                const justCompleted = !moved && algo.isComplete;
                if (moved || justCompleted) {
                    recordIteration(type);
                }
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
                document.getElementById('funcDisplay').textContent = `D(p) = ${cur_a.toFixed(2)} ${val >= 0 ? '+' : '-'} ${Math.abs(val).toFixed(2)}p`;

                if (algo.isComplete && state.subStep === 0) {
                    b_search = val;
                    a_search = cur_a;
                    document.getElementById('profitSection').style.display = 'block';
                    document.getElementById('aDisplayForProfit').textContent = a_search.toFixed(2);
                    document.getElementById('signDisplayForProfit').textContent = b_search >= 0 ? '+' : '-';
                    document.getElementById('bDisplayForProfit').textContent = Math.abs(b_search).toFixed(2);

                    // 立即触发第二部分画布的有效重绘
                    if (profitViz) profitViz.resize();
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

    function recordIteration(type) {
        const state = AppState[type];
        const algo = state.algo;
        if (!algo) return;
        const history = algo.history || [];
        if (!history.length) return;
        const last = history[history.length - 1];
        const method = state.method;

        // 统一时间戳
        const timestamp = new Date().toISOString();

        if (type === 'ls') {
            // β 轴上的搜索，根据方法类型区分区间类与点搜索类
            let beta;
            let L;
            let dL = null;
            let ddL = null;

            if (['golden', 'bisect', 'fib'].includes(method)) {
                // 对区间类方法，用当前区间中点作为代表 βₖ
                if (typeof algo.a === 'number' && typeof algo.b === 'number') {
                    beta = (algo.a + algo.b) / 2;
                } else {
                    beta = typeof algo.x === 'number' ? algo.x : (algo.xk ?? 0);
                }
                L = algo.func(beta);

                // 利用 LS 的解析形式计算梯度与二阶导数，避免依赖 history 结构
                const scale = A_ls || 1;
                dL = (2 * A_ls * beta - 2 * B_ls) / scale;
                ddL = (2 * A_ls) / scale;
            } else {
                // 点搜索类方法（GD / Newton / Secant）直接取 history 中的点
                beta = typeof last.x === 'number' ? last.x : algo.xk;
                L = typeof last.y === 'number' ? last.y : algo.func(beta);
                dL = typeof last.df === 'number'
                    ? last.df
                    : (typeof algo.df === 'function' ? algo.df(beta) : null);
                ddL = typeof last.ddf === 'number'
                    ? last.ddf
                    : null;
            }

            state.iterationLog.push({
                iteration: algo.currentIteration || algo.k || 0,
                beta,
                L,
                dL,
                ddL,
                is_complete: algo.isComplete,
                has_converged: !!algo.isComplete, // 应用实验中统一视为收敛结束
                termination_reason: null,
                result: algo.isComplete ? (algo.xk ?? beta) : null,
                timestamp
            });
        } else {
            // p 轴上的搜索（负利润），同样区分区间类与点搜索类
            let p;
            let negProfit;
            let dNeg = null;
            let ddNeg = null;

            if (['golden', 'bisect', 'fib'].includes(method)) {
                if (typeof algo.a === 'number' && typeof algo.b === 'number') {
                    p = (algo.a + algo.b) / 2;
                } else {
                    p = typeof algo.x === 'number' ? algo.x : (algo.xk ?? 0);
                }
                negProfit = algo.func(p);

                // 用 df/ddf 计算
                if (typeof algo.df === 'function') {
                    dNeg = algo.df(p);
                }
                if (typeof algo.ddf === 'function') {
                    ddNeg = algo.ddf(p);
                }
            } else {
                p = typeof last.x === 'number' ? last.x : algo.xk;
                negProfit = typeof last.y === 'number' ? last.y : algo.func(p);
                dNeg = typeof last.df === 'number'
                    ? last.df
                    : (typeof algo.df === 'function' ? algo.df(p) : null);
                ddNeg = typeof last.ddf === 'number'
                    ? last.ddf
                    : null;
            }

            state.iterationLog.push({
                iteration: algo.currentIteration || algo.k || 0,
                p,
                neg_profit: negProfit,
                d_neg_profit: dNeg,
                dd_neg_profit: ddNeg,
                is_complete: algo.isComplete,
                has_converged: !!algo.isComplete,
                termination_reason: null,
                result: algo.isComplete ? (algo.xk ?? p) : null,
                timestamp
            });
        }
    }

    window.onload = init;
})();
