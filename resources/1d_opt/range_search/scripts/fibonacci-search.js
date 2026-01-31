/**
 * 斐波那契搜索法算法实现
 */

export class FibonacciSearch {
    constructor(func, a, b, epsilon = 0.001, maxIterations = 20) {
        this.func = func;
        this.a = a;
        this.b = b;
        this.epsilon = epsilon;
        this.maxIterations = maxIterations;
        
        // 生成斐波那契数列
        this.F = this.generateFibonacci(maxIterations + 2);
        
        // 算法状态
        this.currentIteration = 0;
        this.history = [];
        this.isComplete = false;
        this.result = null;
    }
    
    // 生成斐波那契数列
    generateFibonacci(n) {
        const F = [1, 1];
        for (let i = 2; i <= n; i++) {
            F[i] = F[i - 1] + F[i - 2];
        }
        return F;
    }
    
    // 计算当前迭代的分割比例
    getCurrentRatio() {
        const N = this.maxIterations;
        const k = this.currentIteration;
        
        // ρ_k = 1 - F_{N-k}/F_{N-k+1}
        let rho = 1 - (this.F[N - k] / this.F[N - k + 1]);
        
        // 当 ρ_k = 0.5 时，修正为 0.5 - ε
        if (Math.abs(rho - 0.5) < 1e-10) {
            rho = 0.5 - this.epsilon;
        }
        
        return rho;
    }

    // 执行一次迭代
    iterate() {
        if (this.isComplete) {
            return false;
        }

        const N = this.maxIterations;
        const k = this.currentIteration;

        // 若 k=N，输出结果
        if (k >= N) {
            this.isComplete = true;
            this.result = (this.a + this.b) / 2;
            return false;
        }
        
        const { a_try, b_try } = this.getTrialPoints();
        const rho = this.getCurrentRatio();
        
        // 计算函数值
        const fa = this.func(a_try);
        const fb = this.func(b_try);
        
        let decision = '';
        if (fa > fb) {
            decision = '舍弃左区间 [a, a_try]';
        } else if (fa < fb) {
            decision = '舍弃右区间 [b_try, b]';
        } else {
            decision = '同时舍弃两端';
        }
        
        // 记录历史
        this.history.push({
            iteration: k + 1,
            a: this.a,
            b: this.b,
            a_try: a_try,
            b_try: b_try,
            fa: fa,
            fb: fb,
            r: rho,
            F_ratio: `1 - F_{${N - k}}/F_{${N - k + 1}}`,
            interval_length: this.b - this.a,
            decision: decision
        });
        
        // 更新区间
        if (fa > fb) {
            this.a = a_try; // 舍弃左区间
        } else if (fa < fb) {
            this.b = b_try; // 舍弃右区间
        } else {
            this.a = a_try;
            this.b = b_try;
        }
        
        this.currentIteration++;
        
        // 检查是否完成
        if (this.currentIteration >= N) {
            this.isComplete = true;
            this.result = (this.a + this.b) / 2;
        }
        
        return true;
    }

    getTrialPoints() {
        const l = this.b - this.a;
        const rho = this.getCurrentRatio();
        const a_try = this.a + rho * l;
        const b_try = this.b - rho * l;
        return { a_try, b_try };
    }
    
    // 重置算法
    reset(a, b, epsilon, maxIterations = 20) {
        this.a = a;
        this.b = b;
        this.epsilon = epsilon;
        this.maxIterations = maxIterations;
        this.F = this.generateFibonacci(maxIterations + 2);
        this.currentIteration = 0;
        this.history = [];
        this.isComplete = false;
        this.result = null;
    }
    
    // 计算最优迭代次数
    static calculateOptimalIterations(initialLength, epsilon) {
        let n = 2;
        let F = [1, 1];
        
        while (F[F.length - 1] < initialLength / epsilon) {
            F.push(F[F.length - 1] + F[F.length - 2]);
            n++;
        }
        
        return Math.max(2, n - 2); 
    }
}
