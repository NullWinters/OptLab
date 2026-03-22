/**
 * 二分法算法实现
 */

export class BisectionSearch {
    constructor(funcOrExpr, a, b, epsilon = 0.001) {
        this.funcOrExpr = funcOrExpr;
        this.a = a;
        this.b = b;
        this.epsilon = epsilon;

        // 算法状态
        this.currentIteration = 0;
        this.history = [];
        this.isComplete = false;
        this.hasConverged = false;
        this.terminationReason = null; // 'converged'
        this.result = null;

        // 预解析导函数 (如果输入是字符串表达式)
        if (typeof funcOrExpr === 'string') {
            this.expr = funcOrExpr;
            try {
                this.derivativeExpr = math.derivative(funcOrExpr, 'x');
            } catch (e) {
                // 捕获 math.js 无法处理 ConditionalNode (三元运算符) 的错误
                console.warn("Symbolic differentiation failed, falling back to numerical differentiation:", e.message);
                this.derivativeExpr = null;
            }
        } else {
            // 如果是函数，我们可能需要使用数值微分，但由于项目已经引入 math.js 且支持自定义表达式，
            // 我们优先考虑表达式。如果是预设函数，我们需要对应的表达式。
            this.expr = null;
        }
    }

    // 计算导数
    getDerivative(x) {
        if (this.derivativeExpr) {
            try {
                return this.derivativeExpr.evaluate({x: x});
            } catch (e) {
                console.error("Error evaluating derivative expression:", e);
                // 失败后继续尝试数值微分
            }
        }

        // 数值微分
        const h = 1e-7;
        try {
            const f = (val) => {
                if (typeof this.funcOrExpr === 'function') {
                    return this.funcOrExpr(val);
                }
                return math.evaluate(this.funcOrExpr, {x: val});
            };
            return (f(x + h) - f(x - h)) / (2 * h);
        } catch (e) {
            console.error("Numerical differentiation failed:", e);
            return 0;
        }
    }

    // 执行一次迭代
    iterate() {
        if (this.isComplete) {
            return false;
        }

        const l = this.b - this.a;

        // 检查停止条件
        if (Math.abs(l) < this.epsilon) {
            this.isComplete = true;
            this.hasConverged = true;
            this.terminationReason = 'converged';
            this.result = (this.a + this.b) / 2;
            return false;
        }

        const m = (this.a + this.b) / 2;
        const df_m = this.getDerivative(m);
        const df_a = this.getDerivative(this.a);
        const df_b = this.getDerivative(this.b);

        let decision = '';
        if (Math.abs(df_m) < 1e-10) {
            decision = '导数为0，找到极小值点';
            this.isComplete = true;
            this.hasConverged = true;
            this.terminationReason = 'converged';
            this.result = m;
        } else if (df_m * df_a > 0) {
            decision = '导数与左端点同号，舍弃左半区间';
        } else {
            decision = '导数与右端点同号，舍弃右半区间';
        }

        // 记录历史
        this.history.push({
            iteration: this.currentIteration + 1,
            a: this.a,
            b: this.b,
            m: m,
            df_m: df_m,
            df_a: df_a,
            df_b: df_b,
            interval_length: l,
            decision: decision
        });

        if (this.isComplete) return false;

        // 更新区间
        if (df_m * df_a > 0) {
            this.a = m;
        } else {
            this.b = m;
        }

        this.currentIteration++;
        return true;
    }

    // 获取当前的关键点（中点）
    getMidpoint() {
        return (this.a + this.b) / 2;
    }

    // 重置算法
    reset(a, b, epsilon) {
        this.a = a;
        this.b = b;
        this.epsilon = epsilon;
        this.currentIteration = 0;
        this.history = [];
        this.isComplete = false;
        this.result = null;
    }
}
