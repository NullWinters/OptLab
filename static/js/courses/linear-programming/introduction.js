document.addEventListener("DOMContentLoaded", function() {
    const container = d3.select("#lp-viz");
    const width = container.node().getBoundingClientRect().width || 400;
    const height = 300;
    const margin = {top: 20, right: 30, bottom: 40, left: 40};

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const xScale = d3.scaleLinear().domain([-1, 7]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain([-1, 6]).range([height - margin.bottom, margin.top]);

    const xAxis = d3.axisBottom(xScale).ticks(5);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    svg.append("g")
        .attr("transform", `translate(0, ${yScale(0)})`)
        .call(xAxis);

    svg.append("g")
        .attr("transform", `translate(${xScale(0)}, 0)`)
        .call(yAxis);

    const points = [
        {x: 0, y: 0},
        {x: 5, y: 0},
        {x: 4, y: 2},
        {x: 0, y: 4}
    ];

    const polyStr = points.map(p => `${xScale(p.x)},${yScale(p.y)}`).join(" ");

    svg.append("polygon")
        .attr("points", polyStr)
        .attr("fill", "#FFE0B2")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "#FF8F00")
        .attr("stroke-width", 2);

    svg.append("line")
        .attr("x1", xScale(-0.5))
        .attr("y1", yScale(4.25))
        .attr("x2", xScale(6.5))
        .attr("y2", yScale(0.75))
        .attr("stroke", "#D84315")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4");

    svg.append("line")
        .attr("x1", xScale(2.5))
        .attr("y1", yScale(5))
        .attr("x2", xScale(5.5))
        .attr("y2", yScale(-1))
        .attr("stroke", "#D84315")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4");

    svg.selectAll(".dot")
        .data(points)
        .enter().append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 5)
        .attr("fill", "#D84315")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

    const objectiveColor = "#2E7D32";

    svg.append("line")
        .attr("x1", xScale(0))
        .attr("y1", yScale(2))
        .attr("x2", xScale(3))
        .attr("y2", yScale(0))
        .attr("stroke", objectiveColor)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");

    svg.append("line")
        .attr("x1", xScale(0))
        .attr("y1", yScale(4.66))
        .attr("x2", xScale(6))
        .attr("y2", yScale(0.66))
        .attr("stroke", objectiveColor)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");

    svg.append("defs").append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 5)
        .attr("refY", 0)
        .attr("markerWidth", 4)
        .attr("markerHeight", 4)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", objectiveColor);

    svg.append("line")
        .attr("x1", xScale(1.5))
        .attr("y1", yScale(1))
        .attr("x2", xScale(2.5))
        .attr("y2", yScale(2.5))
        .attr("stroke", objectiveColor)
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrow)");

    svg.append("text")
        .attr("x", xScale(2.6))
        .attr("y", yScale(2.6))
        .attr("fill", objectiveColor)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text("max z");

    initObservationViz();
});

function initObservationViz() {
    const constraints = [
        { id: 1, name: "C1", x1: 1, x2: 5, b: 40, slack: 3, color: "#FB8C00" },
        { id: 2, name: "C2", x1: 2, x2: 1, b: 20, slack: 4, color: "#D84315" },
        { id: 3, name: "C3", x1: 1, x2: 1, b: 12, slack: 5, color: "#8D6E63" }
    ];

    const vertices = [
        { x: 0, y: 0, basic: [3, 4, 5], nonBasic: [1, 2], sigma: { 1: 3, 2: 5 } },
        { x: 10, y: 0, basic: [1, 3, 5], nonBasic: [2, 4], sigma: { 2: 3.5, 4: -1.5 } },
        { x: 8, y: 4, basic: [1, 2, 3], nonBasic: [4, 5], sigma: { 4: 2, 5: -7 } },
        { x: 5, y: 7, basic: [1, 2, 4], nonBasic: [3, 5], sigma: { 3: -1.5, 5: -2.5 } },
        { x: 0, y: 8, basic: [2, 4, 5], nonBasic: [1, 3], sigma: { 1: 2, 3: -1 } }
    ];

    const vertexAdjacency = {
        0: { 1: 1, 2: 4 },
        1: { 2: 2, 4: 0 },
        2: { 4: 3, 5: 1 },
        3: { 3: 2, 5: 4 },
        4: { 1: 3, 3: 0 }
    };

    let currentStateIndex = 0;
    let isAnimating = false;

    const container = d3.select("#observation-viz");
    if (container.empty()) return;

    const width = container.node().getBoundingClientRect().width || 400;
    const height = 400;
    const margin = { top: 30, right: 30, bottom: 40, left: 50 };

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const xScale = d3.scaleLinear().domain([-2, 22]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain([-2, 14]).range([height - margin.bottom, margin.top]);

    // 坐标轴
    svg.append("g")
        .attr("transform", `translate(0, ${yScale(0)})`)
        .call(d3.axisBottom(xScale).ticks(10));
    svg.append("g")
        .attr("transform", `translate(${xScale(0)}, 0)`)
        .call(d3.axisLeft(yScale).ticks(8));

    // 绘制可行域
    const polyPoints = [
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 8, y: 4 }, { x: 5, y: 7 }, { x: 0, y: 8 }
    ];
    svg.append("polygon")
        .attr("points", polyPoints.map(p => `${xScale(p.x)},${yScale(p.y)}`).join(" "))
        .attr("fill", "#FFE0B2")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "#FF8F00")
        .attr("stroke-width", 1);

    // 绘制约束线
    constraints.forEach(c => {
        let x1_start = -2, x2_start = (c.b - c.x1 * x1_start) / c.x2;
        let x1_end = 22, x2_end = (c.b - c.x1 * x1_end) / c.x2;

        svg.append("line")
            .attr("id", `line-obs-${c.name}`)
            .attr("x1", xScale(x1_start))
            .attr("y1", yScale(x2_start))
            .attr("x2", xScale(x1_end))
            .attr("y2", yScale(x2_end))
            .attr("stroke", c.color)
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "4,2")
            .attr("opacity", 0.7);
    });

    // 目标函数等值线
    const objLine = svg.append("line")
        .attr("stroke", "#2E7D32")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0.5);

    function updateObjLine(x, y) {
        const z = 3 * x + 5 * y;
        let x1_s = -1, x2_s = (z - 3 * x1_s) / 5;
        let x1_e = 15, x2_e = (z - 3 * x1_e) / 5;
        objLine.attr("x1", xScale(x1_s)).attr("y1", yScale(x2_s))
               .attr("x2", xScale(x1_e)).attr("y2", yScale(x2_e));
    }

    // 当前点
    const currentDot = svg.append("circle")
        .attr("r", 8)
        .attr("fill", "#D84315")
        .attr("stroke", "#fff")
        .attr("stroke-width", 3);

    function updateUI() {
        const state = vertices[currentStateIndex];
        const x1 = state.x;
        const x2 = state.y;
        const f = 3 * x1 + 5 * x2;

        currentDot.transition().duration(800)
            .attr("cx", xScale(x1))
            .attr("cy", yScale(x2));

        updateObjLine(x1, x2);

        document.getElementById("coord-val").innerHTML = `\\((${x1.toFixed(1)}, ${x2.toFixed(1)})\\)`;
        document.getElementById("obj-val").innerHTML = `\\(f = ${f.toFixed(1)}\\)`;

        const x3 = 40 - (x1 + 5 * x2);
        const x4 = 20 - (2 * x1 + x2);
        const x5 = 12 - (x1 + x2);
        const vals = [x1, x2, x3, x4, x5];

        let html = "<tr><td>取值</td>";
        vals.forEach((v, i) => {
            const isBasic = state.basic.includes(i + 1);
            html += `<td class="${isBasic ? 'is-basic' : 'non-basic'}">${v.toFixed(1)}</td>`;
        });
        html += "</tr><tr><td>状态</td>";
        vals.forEach((v, i) => {
            const isBasic = state.basic.includes(i + 1);
            html += `<td class="${isBasic ? 'is-basic' : 'non-basic'}">${isBasic ? '基' : '非基'}</td>`;
        });
        html += "</tr>";
        document.getElementById("vars-body").innerHTML = html;

        constraints.forEach(c => {
            const slackVal = [x3, x4, x5][c.id - 1];
            const line = d3.select(`#line-obs-${c.name}`);
            if (Math.abs(slackVal) < 0.1) {
                line.attr("stroke-width", 3).attr("opacity", 1).attr("stroke-dasharray", null);
            } else {
                line.attr("stroke-width", 1.5).attr("opacity", 0.7).attr("stroke-dasharray", "4,2");
            }
        });

        // 动态生成入基变量按钮
        const actionButtonsContainer = document.getElementById("action-buttons");
        if (actionButtonsContainer) {
            actionButtonsContainer.innerHTML = state.nonBasic.map(vIdx => `
                <button class="action-btn" data-var="x${vIdx}" onclick="iterate('x${vIdx}')">x${vIdx} 入基</button>
            `).join("");
        }

        const actionBtns = document.querySelectorAll(".action-btn");
        actionBtns.forEach(btn => {
            btn.disabled = isAnimating;
        });

        if (currentStateIndex === 3) {
            const stepsDiv = document.getElementById("algebraic-steps");
            const currentSteps = stepsDiv.innerHTML;
            if (!currentSteps.includes("已达到最优解")) {
                stepsDiv.innerHTML += "<br><b>已达到最优解 (5, 7)。</b><br>检验数均非正，目标函数 $f = 50$。";
            }
        }

        if (window.MathJax) MathJax.typesetPromise();
    }

    window.iterate = function(enteringVar) {
        if (isAnimating) return;
        const enteringIdx = parseInt(enteringVar.substring(1));
        const nextIndex = vertexAdjacency[currentStateIndex]?.[enteringIdx];

        if (nextIndex !== undefined) {
            const currentV = vertices[currentStateIndex];
            const nextV = vertices[nextIndex];

            // 找出离基变量 (在 currentV.basic 中但不在 nextV.basic 中的)
            const leavingIdx = currentV.basic.find(b => !nextV.basic.includes(b));

            let stepInfo = `<b>从 (${currentV.x}, ${currentV.y}) 移动到 (${nextV.x}, ${nextV.y})</b><br>`;
            stepInfo += `选择 $x_${enteringIdx}$ 为入基变量，确定 $x_${leavingIdx}$ 为离基变量。<br>`;

            const prevF = 3 * currentV.x + 5 * currentV.y;
            const nextF = 3 * nextV.x + 5 * nextV.y;
            if (nextF > prevF) {
                stepInfo += `目标函数值从 ${prevF} 增加到 ${nextF}。`;
            } else if (nextF < prevF) {
                stepInfo += `目标函数值从 ${prevF} 减少到 ${nextF}。`;
            } else {
                stepInfo += `目标函数值保持为 ${nextF}。`;
            }

            currentStateIndex = nextIndex;
            document.getElementById("algebraic-steps").innerHTML = stepInfo;
            updateUI();
        }
    };

    document.getElementById("reset-btn").onclick = function() {
        currentStateIndex = 0;
        document.getElementById("algebraic-steps").innerText = "等待操作...";
        updateUI();
    };

    document.getElementById("auto-btn").onclick = async function() {
        if (isAnimating) return;
        isAnimating = true;
        this.disabled = true;

        // 如果已在最优解，先重置回起点
        if (currentStateIndex === 3) {
            currentStateIndex = 0;
            document.getElementById("algebraic-steps").innerText = "自动演示重置...";
            updateUI();
            await new Promise(r => setTimeout(r, 1000));
        }

        document.getElementById("algebraic-steps").innerText = "自动演示开始...";
        updateUI();

        while (currentStateIndex !== 3) {
            const state = vertices[currentStateIndex];
            // 找到最佳入基变量 (sigma 最大的正数)
            let bestVarIdx = -1;
            let maxSigma = 0;
            for (let vIdx in state.sigma) {
                if (state.sigma[vIdx] > maxSigma) {
                    maxSigma = state.sigma[vIdx];
                    bestVarIdx = vIdx;
                }
            }

            if (bestVarIdx === -1) break; // 已无更优方向

            isAnimating = false;
            window.iterate(`x${bestVarIdx}`);
            isAnimating = true;
            updateUI();

            await new Promise(r => setTimeout(r, 2000));
        }

        isAnimating = false;
        this.disabled = false;
        updateUI();
    };

    updateUI();
}
