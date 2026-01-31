/**
 * 函数计算工具库
 */

// 预设函数库
export const FunctionLibrary = {
    quadratic: {
        id: "quadratic",
        name: "二次函数",
        formula: "f(x) = x² - 4x + 4",
        calculate: (x) => x * x - 4 * x + 4,
        derivative: (x) => 2 * x - 4,
        minPoint: 2,
        minValue: 0,
        domain: [-5, 5]
    },
    
    sinusoid: {
        id: "sinusoid",
        name: "正弦函数",
        formula: "f(x) = sin(x) + 0.1x²",
        calculate: (x) => Math.sin(x) + 0.1 * x * x,
        derivative: (x) => Math.cos(x) + 0.2 * x,
        domain: [-5, 5]
    },
    
    rosenbrock: {
        id: "rosenbrock",
        name: "Rosenbrock函数（一维）",
        formula: "f(x) = 100(x-1)² + (1-x)²",
        calculate: (x) => 100 * Math.pow(x - 1, 2) + Math.pow(1 - x, 2),
        derivative: (x) => 202 * x - 200,
        minPoint: 1,
        minValue: 0,
        domain: [-2, 3]
    }
};

// 计算指定函数在x处的值
export function calculateFunction(x, functionType) {
    const func = FunctionLibrary[functionType];
    if (!func) {
        console.warn(`未知函数类型: ${functionType}，使用默认二次函数`);
        return FunctionLibrary.quadratic.calculate(x);
    }
    return func.calculate(x);
}

// 生成函数数据点
export function generateFunctionData(functionType, start, end, step = 0.01) {
    const data = [];
    for (let x = start; x <= end; x += step) {
        data.push({
            x: x,
            y: calculateFunction(x, functionType)
        });
    }
    return data;
}

// 检查函数在区间[a,b]上是否为单谷函数
export function isUnimodal(functionType, a, b, samples = 100) {
    const step = (b - a) / samples;
    let decreasing = true;
    let hasValley = false;
    let prevY = calculateFunction(a, functionType);
    
    for (let i = 1; i <= samples; i++) {
        const x = a + i * step;
        const y = calculateFunction(x, functionType);
        
        if (decreasing && y > prevY) {
            decreasing = false;
            hasValley = true;
        } else if (!decreasing && y < prevY) {
            // 出现第二个谷底
            return false;
        }
        
        prevY = y;
    }
    
    return hasValley;
}
