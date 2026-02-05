/**
 * 函数计算工具库 - 集成 math.js
 */

// 预设函数库
export const FunctionLibrary = {
    quadratic: {
        id: "quadratic",
        name: "二次函数",
        formula: "f(x) = x^2 - 4x + 4",
        expression: "x^2 - 4*x + 4",
        calculate: (x) => x * x - 4 * x + 4,
        domain: [-5, 5]
    },
    
    sinusoid: {
        id: "sinusoid",
        name: "正弦函数",
        formula: "f(x) = sin(x) + 0.1x^2",
        expression: "sin(x) + 0.1*x^2",
        calculate: (x) => Math.sin(x) + 0.1 * x * x,
        domain: [-5, 5]
    },
    
    rosenbrock: {
        id: "rosenbrock",
        name: "Rosenbrock函数（一维）",
        formula: "f(x) = 100(x-1)^2 + (1-x)^2",
        expression: "100*(x-1)^2 + (1-x)^2",
        calculate: (x) => 100 * Math.pow(x - 1, 2) + Math.pow(1 - x, 2),
        domain: [-2, 3]
    }
};

/**
 * 安全计算函数值
 * @param {string|Function} expr 表达式或函数
 * @param {number} x 自变量值
 * @returns {number} 结果
 */
export function safeEvaluate(expr, x) {
    try {
        if (typeof expr === 'function') {
            return expr(x);
        }
        // 使用 math.js 进行解析
        return math.evaluate(expr, { x: x });
    } catch (e) {
        return NaN;
    }
}

/**
 * 智能采样函数，处理间断点
 * @param {string|string} funcIdOrExpr 函数ID或表达式
 * @param {number} start 起点
 * @param {number} end 终点
 * @param {number} points 总采样点数
 * @returns {Array} 分段的数据点数组
 */
export function smartSampling(funcIdOrExpr, start, end, points = 1000) {
    let expr = funcIdOrExpr;
    if (FunctionLibrary[funcIdOrExpr]) {
        expr = FunctionLibrary[funcIdOrExpr].expression || FunctionLibrary[funcIdOrExpr].calculate;
    }

    const segments = [];
    let currentSegment = [];
    const step = (end - start) / points;

    for (let i = 0; i <= points; i++) {
        const x = start + i * step;
        const y = safeEvaluate(expr, x);

        if (isNaN(y) || !isFinite(y) || Math.abs(y) > 1e10) {
            if (currentSegment.length > 0) {
                segments.push(currentSegment);
                currentSegment = [];
            }
        } else {
            currentSegment.push({ x, y });
        }
    }

    if (currentSegment.length > 0) {
        segments.push(currentSegment);
    }

    return segments;
}

/**
 * 自动间断点检测
 * @param {string|string} funcIdOrExpr 函数ID或表达式
 * @param {Array} domain 定义域 [start, end]
 * @param {number} epsilon 检测精度
 * @returns {Array} 间断点信息数组
 */
export function detectDiscontinuities(funcIdOrExpr, domain, epsilon = 1e-6) {
    let expr = funcIdOrExpr;
    if (FunctionLibrary[funcIdOrExpr]) {
        expr = FunctionLibrary[funcIdOrExpr].expression || FunctionLibrary[funcIdOrExpr].calculate;
    }

    const discontinuities = [];
    const [start, end] = domain;
    const samples = 500;
    const step = (end - start) / samples;

    for (let i = 0; i <= samples; i++) {
        const x = start + i * step;
        const y = safeEvaluate(expr, x);
        const yLeft = safeEvaluate(expr, x - epsilon);
        const yRight = safeEvaluate(expr, x + epsilon);

        if (isNaN(y) && !isNaN(yLeft) && !isNaN(yRight)) {
            // 可去间断点
            discontinuities.push({ x, type: 'removable' });
        } else if (!isNaN(yLeft) && !isNaN(yRight) && Math.abs(yLeft - yRight) > 10) { // 阈值可调
            // 跳跃间断点
            discontinuities.push({ x, type: 'jump', yLeft, yRight });
        } else if (isNaN(y) && (isNaN(yLeft) || isNaN(yRight))) {
            // 无穷间断点或未定义区间
            discontinuities.push({ x, type: 'vertical' });
        }
    }

    return discontinuities;
}

/**
 * 计算指定函数在x处的值
 */
export function calculateFunction(x, funcIdOrExpr) {
    let expr = funcIdOrExpr;
    if (FunctionLibrary[funcIdOrExpr]) {
        expr = FunctionLibrary[funcIdOrExpr].expression || FunctionLibrary[funcIdOrExpr].calculate;
    }
    return safeEvaluate(expr, x);
}

/**
 * 检查单谷性 (简化版本)
 */
export function isUnimodal(funcIdOrExpr, a, b, samples = 100) {
    const step = (b - a) / samples;
    let decreasing = true;
    let hasValley = false;
    let prevY = calculateFunction(a, funcIdOrExpr);
    
    for (let i = 1; i <= samples; i++) {
        const x = a + i * step;
        const y = calculateFunction(x, funcIdOrExpr);
        
        if (isNaN(y) || !isFinite(y)) continue;

        if (decreasing && y > prevY) {
            decreasing = false;
            hasValley = true;
        } else if (!decreasing && y < prevY) {
            return false;
        }
        
        prevY = y;
    }
    
    return hasValley;
}
