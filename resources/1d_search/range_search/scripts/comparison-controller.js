import {GoldenSectionSearch} from './golden-section.js';
import {FibonacciSearch} from './fibonacci-search.js';
import {BisectionSearch} from './bisection-search.js';

export class ComparisonController {
    constructor() {
        this.algorithms = {
            golden: null,
            fibonacci: null,
            bisection: null
        };
        this.histories = {
            golden: [],
            fibonacci: [],
            bisection: []
        };
        this.isPlaying = false;
        this.syncMode = 'synchronous'; // 'independent' or 'synchronous'
    }

    initAlgorithms(config) {
        const {func, expr, a, b, goldenEps, fibEps, fibN, bisEps} = config;

        this.algorithms.golden = new GoldenSectionSearch(func, a, b, goldenEps);
        this.algorithms.fibonacci = new FibonacciSearch(func, a, b, fibEps, fibN);
        this.algorithms.bisection = new BisectionSearch(expr || func, a, b, bisEps);

        this.resetHistories();
        this.recordStep('golden');
        this.recordStep('fibonacci');
        this.recordStep('bisection');
    }

    resetHistories() {
        this.histories.golden = [];
        this.histories.fibonacci = [];
        this.histories.bisection = [];
    }

    recordStep(type) {
        const algo = this.algorithms[type];
        this.histories[type].push({
            a: algo.a,
            b: algo.b,
            iter: algo.currentIteration
        });
    }

    step(type) {
        const algo = this.algorithms[type];
        if (algo && !algo.isComplete) {
            algo.iterate();
            this.recordStep(type);
            return true;
        }
        return false;
    }

    stepBoth() {
        const gMoved = this.step('golden');
        const fMoved = this.step('fibonacci');
        const bMoved = this.step('bisection');
        return gMoved || fMoved || bMoved;
    }

    reset() {
        this.isPlaying = false;
        if (this.algorithms.golden) {
            // 重新初始化，或者在类里加个 reset 方法
            // 这里简单处理，需要重新调用 initAlgorithms
        }
    }
}
