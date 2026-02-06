/**
 * 黄金分割法算法实现
 */

export class GoldenSectionSearch {
    constructor(func, a, b, epsilon = 0.001) {
        this.func = func;
        this.a = a;
        this.b = b;
        this.epsilon = epsilon;

        // 黄金分割比例 ρ = (3 - Math.sqrt(5)) / 2 ≈ 0.382
        this.rho = (3 - Math.sqrt(5)) / 2;

        // 算法状态
        this.currentIteration = 0;
        this.history = [];
        this.isComplete = false;
        this.result = null;
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
            this.result = (this.a + this.b) / 2;
            return false;
        }

        const {a_try, b_try} = this.getTrialPoints();

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

        // 记录历史 (在更新区间之前)
        this.history.push({
            iteration: this.currentIteration + 1,
            a: this.a,
            b: this.b,
            a_try: a_try,
            b_try: b_try,
            fa: fa,
            fb: fb,
            r: this.rho,
            interval_length: l,
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

        return true;
    }

    getTrialPoints() {
        const l = this.b - this.a;
        const a_try = this.a + this.rho * l;
        const b_try = this.b - this.rho * l;
        return {a_try, b_try};
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
