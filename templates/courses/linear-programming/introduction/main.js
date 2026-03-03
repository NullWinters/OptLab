document.addEventListener("DOMContentLoaded", function() {
    const container = d3.select("#lp-viz");
    const width = container.node().getBoundingClientRect().width || 400;
    const height = 300;
    const margin = {top: 20, right: 30, bottom: 40, left: 40};

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    // 比例尺
    const xScale = d3.scaleLinear().domain([-1, 7]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain([-1, 6]).range([height - margin.bottom, margin.top]);

    // 坐标轴
    const xAxis = d3.axisBottom(xScale).ticks(5);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    svg.append("g")
        .attr("transform", `translate(0, ${yScale(0)})`)
        .call(xAxis);

    svg.append("g")
        .attr("transform", `translate(${xScale(0)}, 0)`)
        .call(yAxis);

    // 可行域多边形点
    // 约束: x1 + 2x2 <= 8; 2x1 + x2 <= 10; x1,x2 >= 0
    // 顶点: (0,0), (5,0), (4,2), (0,4)
    const points = [
        {x: 0, y: 0},
        {x: 5, y: 0},
        {x: 4, y: 2},
        {x: 0, y: 4}
    ];

    const polyStr = points.map(p => `${xScale(p.x)},${yScale(p.y)}`).join(" ");

    // 绘制可行域
    svg.append("polygon")
        .attr("points", polyStr)
        .attr("fill", "#FFE0B2")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "#FF8F00")
        .attr("stroke-width", 2);

    // 绘制约束线 (延长线)
    // L1: x1 + 2x2 = 8 => x2 = (8 - x1)/2
    svg.append("line")
        .attr("x1", xScale(-0.5))
        .attr("y1", yScale(4.25))
        .attr("x2", xScale(6.5))
        .attr("y2", yScale(0.75))
        .attr("stroke", "#D84315")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4");

    // L2: 2x1 + x2 = 10 => x2 = 10 - 2x1
    svg.append("line")
        .attr("x1", xScale(2.5))
        .attr("y1", yScale(5))
        .attr("x2", xScale(5.5))
        .attr("y2", yScale(-1))
        .attr("stroke", "#D84315")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4");

    // 绘制极点
    svg.selectAll(".dot")
        .data(points)
        .enter().append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 5)
        .attr("fill", "#D84315")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

    // 目标函数等值线示例 z = 2x1 + 3x2
    // z = 6 => 2x1 + 3x2 = 6 => x2 = 2 - (2/3)x1
    // z = 12 => 2x1 + 3x2 = 12 => x2 = 4 - (2/3)x1
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

    // 箭头表示优化方向
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
});
