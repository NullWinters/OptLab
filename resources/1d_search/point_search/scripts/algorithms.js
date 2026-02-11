/**
 * 点搜索算法类：梯度下降法、牛顿法、割线法
 */

export class GradientDescent {
    constructor(expr, x0, alpha, n) {
        this.expr = expr;
        this.x0 = x0;
        this.alpha = alpha;
        this.n = n;
        
        this.currentIteration = 0;
        this.xk = x0;
        this.isComplete = false;
        const df = this.derivative(x0);
        this.history = [{ x: x0, y: this.evaluate(x0), df: df }];

        // 如果导数几乎为0，直接停止
        if (Math.abs(df) < 1e-10) {
            this.isComplete = true;
        }
    }

    evaluate(x) {
        return math.evaluate(this.expr, { x: x });
    }

    derivative(x) {
        return math.derivative(this.expr, 'x').evaluate({ x: x });
    }

    iterate() {
        if (this.isComplete || this.currentIteration >= this.n) {
            this.isComplete = true;
            return false;
        }

        const df = this.derivative(this.xk);

        // 导数为0停止条件
        if (Math.abs(df) < 1e-10) {
            this.isComplete = true;
            return false;
        }

        const nextX = this.xk - this.alpha * df;
        
        this.xk = nextX;
        this.currentIteration++;
        
        const nextY = this.evaluate(this.xk);
        const nextDf = this.derivative(this.xk);
        this.history.push({ x: this.xk, y: nextY, df: nextDf });

        if (this.currentIteration >= this.n) {
            this.isComplete = true;
        }
        return true;
    }

    get result() {
        return this.xk;
    }
}

export class NewtonsMethod {
    constructor(expr, x0, n) {
        this.expr = expr;
        this.x0 = x0;
        this.n = n;
        
        this.currentIteration = 0;
        this.xk = x0;
        this.isComplete = false;
        const df = this.derivative(x0);
        this.history = [{ x: x0, y: this.evaluate(x0), df: df, ddf: this.secondDerivative(x0) }];

        // 如果导数几乎为0，直接停止
        if (Math.abs(df) < 1e-10) {
            this.isComplete = true;
        }
    }

    evaluate(x) {
        return math.evaluate(this.expr, { x: x });
    }

    derivative(x) {
        return math.derivative(this.expr, 'x').evaluate({ x: x });
    }

    secondDerivative(x) {
        const d1 = math.derivative(this.expr, 'x');
        return math.derivative(d1, 'x').evaluate({ x: x });
    }

    iterate() {
        if (this.isComplete || this.currentIteration >= this.n) {
            this.isComplete = true;
            return false;
        }

        const df = this.derivative(this.xk);
        
        // 导数为0停止条件
        if (Math.abs(df) < 1e-10) {
            this.isComplete = true;
            return false;
        }

        const ddf = this.secondDerivative(this.xk);
        
        // 避免除以0
        if (Math.abs(ddf) < 1e-10) {
            this.isComplete = true;
            return false;
        }

        const nextX = this.xk - df / ddf;
        
        this.xk = nextX;
        this.currentIteration++;
        
        const nextY = this.evaluate(this.xk);
        const nextDf = this.derivative(this.xk);
        const nextDdf = this.secondDerivative(this.xk);
        this.history.push({ x: this.xk, y: nextY, df: nextDf, ddf: nextDdf });

        if (this.currentIteration >= this.n) {
            this.isComplete = true;
        }
        return true;
    }

    get result() {
        return this.xk;
    }
}

export class SecantMethod {
    constructor(expr, x0, x_prev, n) {
        this.expr = expr;
        this.xk = x0;
        this.x_prev = x_prev;
        this.n = n;
        
        this.currentIteration = 0;
        this.isComplete = false;
        
        const df_prev = this.derivative(x_prev);
        const df_k = this.derivative(x0);

        // 初始状态包含 x_{-1} 和 x_0
        this.history = [
            { x: x_prev, y: this.evaluate(x_prev), df: df_prev },
            { x: x0, y: this.evaluate(x0), df: df_k }
        ];

        // 如果当前点导数几乎为0，直接停止
        if (Math.abs(df_k) < 1e-10) {
            this.isComplete = true;
        }
    }

    evaluate(x) {
        return math.evaluate(this.expr, { x: x });
    }

    derivative(x) {
        return math.derivative(this.expr, 'x').evaluate({ x: x });
    }

    iterate() {
        if (this.isComplete || this.currentIteration >= this.n) {
            this.isComplete = true;
            return false;
        }

        const df_k = this.derivative(this.xk);
        
        // 导数为0停止条件
        if (Math.abs(df_k) < 1e-10) {
            this.isComplete = true;
            return false;
        }
        const df_prev = this.derivative(this.x_prev);
        
        // 割线法公式: x_{k+1} = x_k - (x_k - x_{k-1}) * f'(x_k) / (f'(x_k) - f'(x_{k-1}))
        const denom = df_k - df_prev;
        if (Math.abs(denom) < 1e-10) {
            this.isComplete = true;
            return false;
        }

        const nextX = this.xk - (this.xk - this.x_prev) * df_k / denom;
        
        this.x_prev = this.xk;
        this.xk = nextX;
        this.currentIteration++;
        
        const nextY = this.evaluate(this.xk);
        const nextDf = this.derivative(this.xk);
        this.history.push({ x: this.xk, y: nextY, df: nextDf });

        if (this.currentIteration >= this.n) {
            this.isComplete = true;
        }
        return true;
    }

    get result() {
        return this.xk;
    }
}
