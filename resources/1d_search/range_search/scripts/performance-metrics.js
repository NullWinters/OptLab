export class PerformanceMetrics {
    static calculate(goldenHistory, fibHistory) {
        if (!goldenHistory || !fibHistory || goldenHistory.length === 0 || fibHistory.length === 0) {
            return null;
        }

        const gLast = goldenHistory[goldenHistory.length - 1];
        const fLast = fibHistory[fibHistory.length - 1];

        const gIters = goldenHistory.length - 1;
        const fIters = fibHistory.length - 1;

        const gFinalInterval = Math.abs(gLast.b - gLast.a);
        const fFinalInterval = Math.abs(fLast.b - fLast.a);

        return {
            iterations: {
                golden: gIters,
                fibonacci: fIters,
                winner: gIters < fIters ? 'golden' : (fIters < gIters ? 'fibonacci' : 'draw'),
                ratio: fIters > 0 ? (gIters / fIters).toFixed(2) : '-'
            },
            precision: {
                golden: gFinalInterval.toExponential(4),
                fibonacci: fFinalInterval.toExponential(4),
                winner: gFinalInterval < fFinalInterval ? 'golden' : 'fibonacci'
            }
        };
    }
}
