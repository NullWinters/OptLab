import * as THREE from 'three';

// 线性SVM可视化 (D3.js)
function initLinearSVM() {
    const margin = {top: 20, right: 20, bottom: 20, left: 20};
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#linear-svm-canvas")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 生成线性可分数据
    let data = [];
    const n = 20;
    // 类1: 红色圆点
    for (let i = 0; i < n; i++) {
        data.push({x: Math.random() * 0.45, y: Math.random() * 0.8 + 0.1, label: 1});
    }
    // 类2: 蓝色方点
    for (let i = 0; i < n; i++) {
        data.push({x: Math.random() * 0.45 + 0.55, y: Math.random() * 0.8 + 0.1, label: -1});
    }

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    // 绘制数据点
    svg.selectAll(".point")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 5)
        .attr("fill", d => d.label === 1 ? "#ef5350" : "#42a5f5");

    // 绘制简化的决策边界 (这里仅为演示，实际SVM需要求解)
    // w1*x + w2*y + b = 0 => y = -(w1*x + b) / w2
    // 手动给定一个大致合适的边界
    const drawBoundary = (C) => {
        svg.selectAll(".boundary").remove();

        // 模拟随C变化的边界
        // C 越大，罚项越重，间隔通常越窄，边界越稳定
        const offset = (C - 50) / 1000;
        const marginWidth = 0.05 + (100 - C) / 1000;

        const line = d3.line()
            .x(d => xScale(d[0]))
            .y(d => yScale(d[1]));

        const b = 0.5 + offset;
        const boundaryPoints = [[b, 0], [b + 0.1, 1]];
        const upperPoints = [[b - marginWidth, 0], [b - marginWidth + 0.1, 1]];
        const lowerPoints = [[b + marginWidth, 0], [b + marginWidth + 0.1, 1]];

        svg.append("path")
            .datum(boundaryPoints)
            .attr("class", "boundary")
            .attr("d", line)
            .attr("stroke", "#333")
            .attr("stroke-width", 2);

        svg.append("path")
            .datum(upperPoints)
            .attr("class", "boundary")
            .attr("d", line)
            .attr("stroke", "#999")
            .attr("stroke-dasharray", "5,5");

        svg.append("path")
            .datum(lowerPoints)
            .attr("class", "boundary")
            .attr("d", line)
            .attr("stroke", "#999")
            .attr("stroke-dasharray", "5,5");

        // 高亮“支持向量”
        svg.selectAll(".sv").remove();
        // 简单模拟：落在边界附近或边界内的点
        const svs = data.filter(d => {
            const boundaryXAtY = 0.1 * d.y + b;
            if (d.label === 1) {
                return d.x >= (boundaryXAtY - marginWidth - 0.02);
            } else {
                return d.x <= (boundaryXAtY + marginWidth + 0.02);
            }
        });

        svg.selectAll(".sv")
            .data(svs)
            .enter()
            .append("circle")
            .attr("class", "sv")
            .attr("cx", d => xScale(d.x))
            .attr("cy", d => yScale(d.y))
            .attr("r", 8)
            .attr("fill", "none")
            .attr("stroke", "#ffa726")
            .attr("stroke-width", 2);
    };

    drawBoundary(50);

    d3.select("#c-slider").on("input", function () {
        d3.select("#c-value").text(this.value);
    });

    d3.select("#btn-confirm-c").on("click", () => {
        const cValue = +d3.select("#c-slider").property("value");
        drawBoundary(cValue);
    });
}

// 核技巧可视化 (Three.js)
function initKernelTrick() {
    // 左侧2D视图 (D3)
    const init2D = () => {
        const margin = {top: 20, right: 20, bottom: 20, left: 20};
        const width = 300 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;
        const svg = d3.select("#kernel-2d")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const data = [];
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.25 + 0.1;
            data.push({x: Math.cos(angle) * r, y: Math.sin(angle) * r, label: 1});
        }
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.25 + 0.6;
            data.push({x: Math.cos(angle) * r, y: Math.sin(angle) * r, label: -1});
        }

        const x = d3.scaleLinear().domain([-1, 1]).range([0, width]);
        const y = d3.scaleLinear().domain([-1, 1]).range([height, 0]);

        // 渲染横纵坐标系，原点位于中心
        svg.append("g")
            .attr("transform", `translate(0, ${height / 2})`)
            .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
            .attr("color", "#999");
        svg.append("g")
            .attr("transform", `translate(${width / 2}, 0)`)
            .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0))
            .attr("color", "#999");

        svg.selectAll(".dot")
            .data(data)
            .enter()
            .append("circle")
            .attr("class", "dot")
            .attr("cx", d => x(d.x))
            .attr("cy", d => y(d.y))
            .attr("r", 3)
            .attr("fill", d => d.label === 1 ? "#ef5350" : "#42a5f5")
            .attr("opacity", 0.8);

        return data;
    };

    const data2d = init2D();

    // 右侧3D视图 (Three.js)
    const init3D = () => {
        const container = document.getElementById('kernel-3d');
        const width = container.clientWidth;
        const height = container.clientHeight;

        const scene = new THREE.Scene();
        window.scene = scene; // 暴露给全局，方便 AI 侧栏感知 3D 场景
        scene.background = new THREE.Color(0xf9f9f9);
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        // 映射函数 (多项式核模拟: z = x^2 + y^2)
        data2d.forEach(d => {
            const geometry = new THREE.SphereGeometry(0.05, 16, 16);
            const material = new THREE.MeshBasicMaterial({color: d.label === 1 ? 0xef5350 : 0x42a5f5});
            const sphere = new THREE.Mesh(geometry, material);
            const nx = d.x * 4;
            const ny = d.y * 4;
            const nz = (nx * nx + ny * ny) * 0.5 - 1;
            sphere.position.set(nx, ny, nz);
            scene.add(sphere);
        });

        // 3D 坐标系
        const axesHelper = new THREE.AxesHelper(3);
        scene.add(axesHelper);

        // 分割平面
        const planeGeo = new THREE.PlaneGeometry(5, 5);
        const planeMat = new THREE.MeshBasicMaterial({
            color: 0xaaaaaa,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.position.z = 0.5;
        scene.add(plane);

        camera.position.z = 5;
        camera.position.y = 2;
        camera.lookAt(0, 0, 0);

        function animate() {
            requestAnimationFrame(animate);
            scene.rotation.y += 0.01;
            renderer.render(scene, camera);
        }

        animate();
    };

    init3D();
}

// SMO算法迭代可视化 (D3.js)
function initSMO() {
    const margin = {top: 20, right: 20, bottom: 20, left: 20};
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#smo-canvas")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    // 使用同样的数据集
    let data = [];
    for (let i = 0; i < 15; i++) {
        data.push({id: i, x: Math.random() * 0.4, y: Math.random() * 0.8 + 0.1, label: 1});
    }
    for (let i = 0; i < 15; i++) {
        data.push({id: i + 15, x: Math.random() * 0.4 + 0.6, y: Math.random() * 0.8 + 0.1, label: -1});
    }

    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 5)
        .attr("fill", d => d.label === 1 ? "#ef5350" : "#42a5f5");

    let iteration = 0;
    let timer = null;

    const step = () => {
        iteration++;
        if (iteration > 20) {
            clearInterval(timer);
            return;
        }

        // 随机选择两个点模拟优化
        const idx1 = Math.floor(Math.random() * 30);
        let idx2 = Math.floor(Math.random() * 30);
        while (idx1 === idx2) idx2 = Math.floor(Math.random() * 30);

        svg.selectAll(".highlight-point").remove();
        svg.selectAll("circle")
            .filter(d => d.id === idx1 || d.id === idx2)
            .clone(true)
            .attr("class", "highlight-point")
            .attr("r", 10)
            .attr("fill", "none")
            .attr("stroke", "#ffd600")
            .attr("stroke-width", 3);

        // 更新边界 (模拟)
        svg.selectAll(".smo-boundary").remove();
        const offset = (Math.random() - 0.5) * 0.1 / (iteration * 0.5 + 1);
        const line = d3.line().x(d => xScale(d[0])).y(d => yScale(d[1]));
        const boundaryPoints = [[0.48 + offset, 0], [0.52 - offset, 1]];

        svg.append("path")
            .datum(boundaryPoints)
            .attr("class", "smo-boundary")
            .attr("d", line)
            .attr("stroke", "#333")
            .attr("stroke-width", 2);
    };

    d3.select("#play-smo").on("click", () => {
        iteration = 0;
        if (timer) clearInterval(timer);
        timer = setInterval(step, 500);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initLinearSVM();
    initKernelTrick();
    initSMO();
});
