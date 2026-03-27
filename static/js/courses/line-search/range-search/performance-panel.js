export class PerformanceMetrics {
    static calculate(goldenHistory, fibHistory, bisHistory) {
        if (!goldenHistory || !fibHistory || !bisHistory ||
            goldenHistory.length === 0 || fibHistory.length === 0 || bisHistory.length === 0) {
            return null;
        }

        const gLast = goldenHistory[goldenHistory.length - 1];
        const fLast = fibHistory[fibHistory.length - 1];
        const bLast = bisHistory[bisHistory.length - 1];

        const gIters = goldenHistory.length - 1;
        const fIters = fibHistory.length - 1;
        const bIters = bisHistory.length - 1;

        const gFinalInterval = Math.abs(gLast.b - gLast.a);
        const fFinalInterval = Math.abs(fLast.b - fLast.a);
        const bFinalInterval = Math.abs(bLast.b - bLast.a);

        const iterWinner = (gIters <= fIters && gIters <= bIters) ? 'golden' :
            (fIters <= gIters && fIters <= bIters) ? 'fibonacci' : 'bisection';

        const precWinner = (gFinalInterval <= fFinalInterval && gFinalInterval <= bFinalInterval) ? 'golden' :
            (fFinalInterval <= gFinalInterval && fFinalInterval <= bFinalInterval) ? 'fibonacci' : 'bisection';

        return {
            iterations: {
                golden: gIters,
                fibonacci: fIters,
                bisection: bIters,
                winner: iterWinner
            },
            precision: {
                golden: gFinalInterval.toExponential(4),
                fibonacci: fFinalInterval.toExponential(4),
                bisection: bFinalInterval.toExponential(4),
                winner: precWinner
            }
        };
    }
}

