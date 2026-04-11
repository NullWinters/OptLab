import * as THREE from '../../vendors/three/three.module.js';

window.THREE = THREE;

const $ = id => document.getElementById(id);
const statusEl = $('dataset-status');
const accEl = $('split-acc');

function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#c62828' : '#8f6a4f';
}

function setAccuracyText(text) {
    if (!accEl) return;
    accEl.textContent = text;
}

function refreshCurrentMapText() {
    const el = $('current-map-text');
    if (!el) return;
    const toTex = (expr) => String(expr || '')
        .replace(/\s+/g, '')
        .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
        .replace(/\^2/g, '^2')
        .replace(/\*/g, '');

    const mapX = toTex(state.mapExpr.x);
    const mapY = toTex(state.mapExpr.y);
    const mapZ = toTex(state.mapExpr.z);
    el.innerHTML = `当前映射：\\(\\phi(x, y) = (${mapX}, ${mapY}, ${mapZ})\\)`;

    refreshKernelText();

    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        window.MathJax.typesetPromise([el]).catch(() => {
        });
    }
}

const state = {
    headers: [],
    rows: [],
    points: [],
    pointsMesh: null,
    targetMapped: [],
    currentMapped: [],
    mapExpr: {
        x: 'x^2',
        y: 'y^2',
        z: 'sqrt(2)*x*y'
    },
    minX: 0,
    maxX: 1,
    minY: 0,
    maxY: 1,
    datasetSource: 'default_builtin',
    datasetMeta: null,
    uploadedFiles: [],
    lastUploadedCsvText: '',
    processLog: [],
    latestAccuracy: null,
    lastPlaneParams: {z: 0, yaw: 0, pitch: 0},
    autoFitTimer: null,
};

function trackNoteEvent(type, data) {
    if (window.ExperimentNotes && typeof window.ExperimentNotes.trackEvent === 'function') {
        window.ExperimentNotes.trackEvent(type, data || {});
    }
}

function pushProcessStep(step, detail) {
    state.processLog.push({
        step,
        detail: detail || {},
        timestamp: new Date().toISOString()
    });
    if (state.processLog.length > 300) {
        state.processLog.shift();
    }
}


const MAPPING_PRESETS = {
    quadratic_monomial: {x: 'x^2', y: 'x*y', z: 'y^2'},
    linear_combo: {x: 'x', y: 'y', z: 'x + y'},
    mixed_order: {x: 'x', y: 'y', z: 'x*y'},
    polar_like: {x: 'x', y: 'y', z: 'sqrt(x^2 + y^2)'}
};

const KERNEL_PRESETS = {
    quadratic_monomial: {
        simplified: 'K(u,v) = u_x^2 v_x^2 + u_x u_y v_x v_y + u_y^2 v_y^2',
        expansion: 'u_x^2 v_x^2 + u_x u_y v_x v_y + u_y^2 v_y^2'
    },
    linear_combo: {
        simplified: 'K(u,v) = u_x v_x + u_y v_y + (u_x+u_y)(v_x+v_y)',
        expansion: 'u_x v_x + u_y v_y + (u_x+u_y)(v_x+v_y)'
    },
    mixed_order: {
        simplified: 'K(u,v) = u_x v_x + u_y v_y + u_x u_y v_x v_y',
        expansion: 'u_x v_x + u_y v_y + u_x u_y v_x v_y'
    },
    polar_like: {
        simplified: 'K(u,v) = u_x v_x + u_y v_y + \\|u\\|\\|v\\|',
        expansion: 'u_x v_x + u_y v_y + \\sqrt{u_x^2+u_y^2}\\sqrt{v_x^2+v_y^2}'
    }
};

function generateKernelExpansion(xExpr, yExpr, zExpr) {
    const replaceVarsU = (expr) => {
        return expr
            .replace(/\bx\b/g, 'u_x')
            .replace(/\by\b/g, 'u_y');
    };

    const replaceVarsV = (expr) => {
        return expr
            .replace(/\bx\b/g, 'v_x')
            .replace(/\by\b/g, 'v_y');
    };

    const phi1_u = replaceVarsU(xExpr);
    const phi1_v = replaceVarsV(xExpr);
    const phi2_u = replaceVarsU(yExpr);
    const phi2_v = replaceVarsV(yExpr);
    const phi3_u = replaceVarsU(zExpr);
    const phi3_v = replaceVarsV(zExpr);

    const toTexKernel = (expr) => String(expr || '')
        .replace(/\s+/g, '')
        .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
        .replace(/\^2/g, '^2');

    const term1 = toTexKernel(`(${phi1_u})(${phi1_v})`);
    const term2 = toTexKernel(`(${phi2_u})(${phi2_v})`);
    const term3 = toTexKernel(`(${phi3_u})(${phi3_v})`);

    return `${term1} + ${term2} + ${term3}`;
}

function findPresetKey(mapExpr) {
    for (const [key, preset] of Object.entries(MAPPING_PRESETS)) {
        if (preset.x === mapExpr.x && preset.y === mapExpr.y && preset.z === mapExpr.z) {
            return key;
        }
    }
    return null;
}

function refreshKernelText() {
    const el = $('current-kernel-text');
    if (!el) return;

    const presetKey = findPresetKey(state.mapExpr);

    if (presetKey && KERNEL_PRESETS[presetKey]) {
        const kernelInfo = KERNEL_PRESETS[presetKey];
        el.innerHTML = `当前核函数：\\(${kernelInfo.simplified}\\)`;
    } else {
        const expansion = generateKernelExpansion(state.mapExpr.x, state.mapExpr.y, state.mapExpr.z);
        el.innerHTML = `当前核函数：\\(K(u,v) = \\phi(u) \\cdot \\phi(v) = ${expansion}\\)`;
    }

    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        window.MathJax.typesetPromise([el]).catch(() => {
        });
    }
}

if (typeof window.THREE === 'undefined') {
    setStatus('Three.js 加载失败，请刷新页面或检查静态资源路径。', true);
    throw new Error('THREE is not available');
}

// ---------- Three.js ----------
const container = $('scene');
const scene = new THREE.Scene();
window.scene = scene; // 暴露给全局，方便 AI 侧栏感知 3D 场景
scene.background = new THREE.Color(0xfff9f2);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);

let renderer;
try {
    renderer = new THREE.WebGLRenderer({antialias: true});
} catch (err) {
    setStatus(`WebGL 初始化失败：${err.message}`, true);
    throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.domElement.id = 'kernel-trick-webgl-canvas';
renderer.domElement.setAttribute('data-ai-label', '三维可视化画布(WebGL)');
container.appendChild(renderer.domElement);

const cameraArm = {
    radius: 16,
    theta: Math.PI * 0.25,
    phi: Math.PI * 0.34,
    target: new THREE.Vector3(0, 0, 0)
};

function updateCameraFromArm() {
    cameraArm.phi = Math.min(Math.PI - 0.1, Math.max(0.1, cameraArm.phi));
    cameraArm.radius = Math.min(40, Math.max(4, cameraArm.radius));

    const sinPhi = Math.sin(cameraArm.phi);
    camera.position.set(
        cameraArm.target.x + cameraArm.radius * sinPhi * Math.cos(cameraArm.theta),
        cameraArm.target.y + cameraArm.radius * Math.cos(cameraArm.phi),
        cameraArm.target.z + cameraArm.radius * sinPhi * Math.sin(cameraArm.theta)
    );
    camera.lookAt(cameraArm.target);
}

updateCameraFromArm();

let isDragging = false;
let lastX = 0;
let lastY = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    cameraArm.theta -= dx * 0.006;
    cameraArm.phi -= dy * 0.006;
    updateCameraFromArm();
});

renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    cameraArm.radius *= (1 + e.deltaY * 0.0012);
    updateCameraFromArm();
}, {passive: false});

const hemi = new THREE.HemisphereLight(0xfff3dd, 0xd8a67a, 1.15);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.65);
dir.position.set(4, 10, 6);
scene.add(dir);

const grid = new THREE.GridHelper(12, 12, 0xe3b997, 0xf3dcc8);
scene.add(grid);

const axes = new THREE.AxesHelper(4);
axes.name = "坐标轴";
scene.add(axes);

const planeGeom = new THREE.PlaneGeometry(10, 10, 1, 1);
const planeMat = new THREE.MeshStandardMaterial({
    color: 0xf29f67,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
    roughness: 0.5,
    metalness: 0.0
});
const plane = new THREE.Mesh(planeGeom, planeMat);
plane.name = "分类超平面";
plane.rotation.x = Math.PI / 2;
scene.add(plane);

function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();

function animate() {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();

// ---------- CSV ----------
$('csv-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    state.datasetSource = 'uploaded_csv';
    state.lastUploadedCsvText = text;
    state.uploadedFiles = [{
        name: file.name,
        size: file.size,
        type: file.type || 'text/csv',
        text_preview: text.slice(0, 6000)
    }];
    state.datasetMeta = {
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || 'text/csv'
    };
    pushProcessStep('upload_csv', {file_name: file.name, file_size: file.size});
    trackNoteEvent('upload_csv', {file_name: file.name, file_size: file.size});
    parseCsv(text);
});

const PRESET_DATASETS = {
    xor: `x,y,label
-2,-2,A
2,2,A
-1.2,0.8,B
-0.8,1.2,B
0.7,0.9,A
-0.9,-0.8,A
1.5,-0.6,B
-2.0,1.1,B
-2,1.8,B
1.4,-1.1,B
-0.8,-0.7,A
-0.2,-0.1,A
1.1,-1.5,B
1.8,-1.1,B
0.9,0.8,A
-0.5,-0.3,A`,
    rings: `x,y,label
2.3,0.1,A
1.8,1.2,A
0.9,2.0,A
-0.7,2.1,A
-1.9,1.1,A
-2.2,-0.2,A
-1.5,-1.5,A
-0.2,-2.3,A
1.3,-1.8,A
2.1,-0.9,A
0.8,0.1,B
0.4,0.5,B
-0.3,0.7,B
-0.7,0.1,B
-0.4,-0.6,B
0.5,-0.5,B`
};

$('load-preset-btn').addEventListener('click', () => {
    const key = $('preset-dataset').value;
    state.datasetSource = 'preset';
    state.datasetMeta = {preset: key};
    state.uploadedFiles = [];
    state.lastUploadedCsvText = PRESET_DATASETS[key] || '';
    pushProcessStep('load_preset', {preset: key});
    trackNoteEvent('dataset_preset_change', {preset: key});
    parseCsv(PRESET_DATASETS[key]);
    const ok = visualizeFromSelection(false);
    if (ok) {
        setStatus('已加载预设数据集并完成三维渲染，可点击“升维动画”观察核技巧。');
    }
});

function parseCsv(text) {
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (lines.length < 2) {
        setStatus('CSV 数据不足，请至少包含表头和一行数据。', true);
        return;
    }

    const headers = lines[0].split(',').map(x => x.trim());
    if (headers.length < 3) {
        setStatus('CSV 至少需要 3 列数据（x、y、label）。', true);
        return;
    }

    const rows = lines.slice(1).map(line => line.split(',').map(x => x.trim()));
    state.headers = headers;
    state.rows = rows;
    pushProcessStep('parse_csv', {headers_count: headers.length, rows_count: rows.length, headers});
    fillSelectors(headers);
    setStatus(`已读取 ${rows.length} 条数据，请确认列映射并加载可视化。`);
}

function guessColumnIndexes(headers) {
    const normalized = headers.map(h => String(h || '').toLowerCase().trim());
    const pickByWords = (words) => normalized.findIndex(h => words.some(w => h.includes(w)));
    const xIdx = pickByWords(['x', '横坐标', 'feature1', 'f1']);
    const yIdx = pickByWords(['y', '纵坐标', 'feature2', 'f2']);
    const labelIdx = pickByWords(['label', 'class', 'target', '类别', '标签']);
    return {
        xIdx: xIdx >= 0 ? xIdx : 0,
        yIdx: yIdx >= 0 && yIdx !== xIdx ? yIdx : Math.min(1, headers.length - 1),
        labelIdx: labelIdx >= 0 && labelIdx !== xIdx && labelIdx !== yIdx ? labelIdx : Math.min(2, headers.length - 1)
    };
}

function fillSelectors(headers) {
    ['x-col', 'y-col', 'label-col'].forEach(id => {
        const sel = $(id);
        sel.innerHTML = '';
        headers.forEach((h, idx) => {
            const op = document.createElement('option');
            op.value = String(idx);
            op.textContent = `${h} (第${idx + 1}列)`;
            sel.appendChild(op);
        });
    });

    if (headers.length >= 3) {
        const guessed = guessColumnIndexes(headers);
        $('x-col').value = String(guessed.xIdx);
        $('y-col').value = String(guessed.yIdx);
        $('label-col').value = String(guessed.labelIdx);
    }

    updateSeparationAccuracy();
}

function showValidationError(message) {
    setStatus(message, true);
    window.alert(message);
}

function validateSelectedColumns(parsedRows, xIdx, yIdx, lIdx) {
    if (xIdx === yIdx || xIdx === lIdx || yIdx === lIdx) {
        showValidationError('横坐标、纵坐标和标签列不能重复，请重新选择。');
        return {ok: false};
    }
    const labels = new Set();
    let validNumericRows = 0;
    for (const row of parsedRows) {
        if (Math.max(xIdx, yIdx, lIdx) >= row.length) continue;
        const x = Number(row[xIdx]);
        const y = Number(row[yIdx]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        validNumericRows++;
        labels.add(String(row[lIdx]));
        if (labels.size > 2) {
            showValidationError('标签列最多只能有两种取值，请更换标签列。');
            return {ok: false};
        }
    }
    if (!validNumericRows) {
        showValidationError('所选横纵坐标列未解析到有效实数，请检查 CSV 并重新选择列。');
        return {ok: false};
    }
    return {ok: true};
}

function computeSplitAccuracy(yawDeg, pitchDeg, zVal) {
    if (!state.points.length || !state.currentMapped.length) {
        return null;
    }

    const labels = [...new Set(state.points.map(p => p.label))];
    if (labels.length !== 2) {
        return null;
    }

    const yaw = yawDeg * Math.PI / 180;
    const pitch = pitchDeg * Math.PI / 180;
    const normal = new THREE.Vector3(0, 0, 1)
        .applyEuler(new THREE.Euler(Math.PI / 2 + pitch, yaw, 0))
        .normalize();
    const nx = normal.x;
    const ny = normal.y;
    const nz = normal.z;
    const planeY = zVal;

    let posL0 = 0;
    let negL0 = 0;
    let posL1 = 0;
    let negL1 = 0;

    for (let i = 0; i < state.points.length; i++) {
        const p = state.points[i];
        const m = state.currentMapped[i];
        const signed = nx * (m.x - 0) + ny * (m.z - planeY) + nz * (m.y - 0);
        const positiveSide = signed >= 0;

        if (p.label === labels[0]) {
            if (positiveSide) posL0++; else negL0++;
        } else {
            if (positiveSide) posL1++; else negL1++;
        }
    }

    const total = state.points.length;
    const correctMap1 = posL0 + negL1;
    const correctMap2 = negL0 + posL1;
    const best = Math.max(correctMap1, correctMap2);

    return (best / total) * 100;
}

function updateSeparationAccuracy() {
    if (!state.points.length || !state.currentMapped.length) {
        state.latestAccuracy = null;
        setAccuracyText('划分准确率：--');
        return;
    }

    const yawDeg = Number($('plane-yaw').value);
    const pitchDeg = Number($('plane-pitch').value);
    const zVal = Number($('plane-z').value);
    const acc = computeSplitAccuracy(yawDeg, pitchDeg, zVal);

    if (acc === null) {
        state.latestAccuracy = null;
        setAccuracyText('划分准确率：仅支持二分类');
        return;
    }
    state.latestAccuracy = Number(acc.toFixed(4));
    setAccuracyText(`划分准确率：${acc.toFixed(1)}%（实时）`);
}

function autoFitPlaneFromCurrentPoints() {
    if (!state.points.length || state.points.length !== state.currentMapped.length) return;

    const labels = [...new Set(state.points.map(p => p.label))];
    if (labels.length !== 2) {
        setStatus('自动划分仅支持二分类数据。', true);
        return;
    }

    let best = {
        yaw: 0,
        pitch: 0,
        z: 0,
        acc: -1
    };

    const coarseStep = {yaw: 15, pitch: 15, z: 0.4};
    for (let yaw = -90; yaw <= 90; yaw += coarseStep.yaw) {
        for (let pitch = -90; pitch <= 90; pitch += coarseStep.pitch) {
            for (let z = -2; z <= 2.0001; z += coarseStep.z) {
                const acc = computeSplitAccuracy(yaw, pitch, z);
                if (acc !== null && acc > best.acc) {
                    best = {yaw, pitch, z, acc};
                }
            }
        }
    }

    const refineStep = {yaw: 4, pitch: 4, z: 0.1};
    const yawMin = Math.max(-90, best.yaw - 12);
    const yawMax = Math.min(90, best.yaw + 12);
    const pitchMin = Math.max(-90, best.pitch - 12);
    const pitchMax = Math.min(90, best.pitch + 12);
    const zMin = Math.max(-2, best.z - 0.5);
    const zMax = Math.min(2, best.z + 0.5);

    for (let yaw = yawMin; yaw <= yawMax + 1e-8; yaw += refineStep.yaw) {
        for (let pitch = pitchMin; pitch <= pitchMax + 1e-8; pitch += refineStep.pitch) {
            for (let z = zMin; z <= zMax + 1e-8; z += refineStep.z) {
                const acc = computeSplitAccuracy(yaw, pitch, z);
                if (acc !== null && acc > best.acc) {
                    best = {yaw, pitch, z, acc};
                }
            }
        }
    }

    $('plane-z').value = String(best.z.toFixed(2));
    $('plane-yaw').value = String(Math.round(best.yaw));
    $('plane-pitch').value = String(Math.round(best.pitch));
    updatePlane();
    setStatus(`已自动拟合超平面，当前最佳划分准确率约 ${best.acc.toFixed(1)}%。`);
}

function scheduleAutoFit() {
    if (state.autoFitTimer) {
        clearTimeout(state.autoFitTimer);
    }
    state.autoFitTimer = setTimeout(() => {
        autoFitPlaneFromCurrentPoints();
    }, 0);
}

function visualizeFromSelection(showSuccessHint = true) {
    if (!state.rows.length) {
        setStatus('未检测到可用数据，请先上传或加载预设数据集。', true);
        return false;
    }

    const xIdx = Number($('x-col').value);
    const yIdx = Number($('y-col').value);
    const lIdx = Number($('label-col').value);

    const parsed = [];
    const labels = new Set();
    const validation = validateSelectedColumns(state.rows, xIdx, yIdx, lIdx);
    if (!validation.ok) return false;

    for (const row of state.rows) {
        if (Math.max(xIdx, yIdx, lIdx) >= row.length) continue;
        const x = Number(row[xIdx]);
        const y = Number(row[yIdx]);
        const label = row[lIdx];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        parsed.push({x, y, label});
        labels.add(label);
    }

    if (!parsed.length) {
        showValidationError('当前列映射无法解析出有效数值，请重新选择列。');
        return false;
    }

    if (labels.size > 2) {
        showValidationError('标签类别超过 2 种，请更换标签列。');
        return false;
    }

    state.points = normalizeXY(parsed);
    pushProcessStep('apply_columns', {
        x_col: xIdx,
        y_col: yIdx,
        label_col: lIdx,
        sample_count: parsed.length,
        class_count: labels.size
    });
    trackNoteEvent('apply_columns', {x_col: xIdx, y_col: yIdx, label_col: lIdx, sample_count: parsed.length});
    createOrUpdatePoints();
    updatePlane();
    setStatus(`渲染完成：共 ${parsed.length} 个点，类别数 ${labels.size}。`);
    if (showSuccessHint) {
        setStatus(`渲染完成：共 ${parsed.length} 个点，类别数 ${labels.size}。点击“升维动画”查看核技巧效果。`);
    }
    return true;
}

$('load-btn').addEventListener('click', () => {
    visualizeFromSelection(true);
});

function normalizeXY(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    state.minX = Math.min(...xs);
    state.maxX = Math.max(...xs);
    state.minY = Math.min(...ys);
    state.maxY = Math.max(...ys);

    const dx = Math.max(state.maxX - state.minX, 1e-6);
    const dy = Math.max(state.maxY - state.minY, 1e-6);

    return points.map(p => ({
        x: ((p.x - state.minX) / dx) * 8 - 4,
        y: ((p.y - state.minY) / dy) * 8 - 4,
        ox: p.x,
        oy: p.y,
        label: p.label
    }));
}

function createOrUpdatePoints() {
    const geometry = new THREE.BufferGeometry();
    const pos = new Float32Array(state.points.length * 3);
    const col = new Float32Array(state.points.length * 3);

    const labels = [...new Set(state.points.map(p => p.label))];
    const colorMap = new Map([
        [labels[0], new THREE.Color('#d84315')],
        [labels[1], new THREE.Color('#1e88e5')],
    ]);

    state.currentMapped = [];
    for (let i = 0; i < state.points.length; i++) {
        const p = state.points[i];
        const m = {x: p.x, y: p.y, z: 0};
        state.currentMapped.push(m);
        pos[i * 3] = m.x;
        pos[i * 3 + 1] = m.z;
        pos[i * 3 + 2] = m.y;

        const c = colorMap.get(p.label) || new THREE.Color('#7e57c2');
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));

    if (state.pointsMesh) {
        state.pointsMesh.geometry.dispose();
        state.pointsMesh.geometry = geometry;
    } else {
        const material = new THREE.PointsMaterial({
            size: 0.22,
            vertexColors: true
        });
        state.pointsMesh = new THREE.Points(geometry, material);
        state.pointsMesh.name = "数据样本点";
        scene.add(state.pointsMesh);
    }
}

function evaluateMappingExpr(expr, x, y) {
    if (window.math && typeof window.math.evaluate === 'function') {
        return window.math.evaluate(expr, {x, y});
    }

    if (!/^[0-9a-zA-Z_+\-*/^().,\s]+$/.test(expr)) {
        throw new Error('表达式包含不支持的字符');
    }

    const jsExpr = expr.replace(/\^/g, '**');
    const fn = new Function(
        'x',
        'y',
        'const {sin,cos,tan,asin,acos,atan,exp,log,sqrt,abs,pow,min,max,PI,E} = Math; return (' + jsExpr + ');'
    );
    return fn(x, y);
}

function getRawMappedPoint(p) {
    const x = p.ox;
    const y = p.oy;
    const raw = {
        x: evaluateMappingExpr(state.mapExpr.x, x, y),
        y: evaluateMappingExpr(state.mapExpr.y, x, y),
        z: evaluateMappingExpr(state.mapExpr.z, x, y)
    };
    if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y) || !Number.isFinite(raw.z)) {
        throw new Error('映射结果包含非数值（NaN/Infinity），请检查表达式定义域。');
    }
    return raw;
}

function normalizeMapped(rawMapped) {
    const xs = rawMapped.map(p => p.x);
    const ys = rawMapped.map(p => p.y);
    const zs = rawMapped.map(p => p.z);

    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);

    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);
    const spanZ = Math.max(maxZ - minZ, 1e-6);

    return rawMapped.map(p => ({
        x: ((p.x - minX) / spanX) * 8 - 4,
        y: ((p.y - minY) / spanY) * 8 - 4,
        z: ((p.z - minZ) / spanZ) * 5.5 - 1.0
    }));
}

function computeTargetMapped() {
    const rawMapped = state.points.map(getRawMappedPoint);
    return normalizeMapped(rawMapped);
}

$('animate-btn').addEventListener('click', () => {
    if (!state.points.length || !state.pointsMesh) {
        setStatus('请先加载数据后再执行升维动画。', true);
        return;
    }

    try {
        state.targetMapped = computeTargetMapped();
    } catch (err) {
        setStatus(`映射计算失败：${err.message}`, true);
        return;
    }

    pushProcessStep('run_lift_animation', {
        sample_count: state.points.length,
        map_expr: {...state.mapExpr}
    });
    trackNoteEvent('run_lift_animation', {
        sample_count: state.points.length,
        map_expr: {...state.mapExpr}
    });

    const duration = 1100;
    const start = performance.now();
    const from = state.currentMapped.map(p => ({...p}));
    const pos = state.pointsMesh.geometry.attributes.position.array;

    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        for (let i = 0; i < state.points.length; i++) {
            const target = state.targetMapped[i];
            const next = {
                x: from[i].x + (target.x - from[i].x) * ease,
                y: from[i].y + (target.y - from[i].y) * ease,
                z: from[i].z + (target.z - from[i].z) * ease
            };
            state.currentMapped[i] = next;
            pos[i * 3] = next.x;
            pos[i * 3 + 1] = next.z;
            pos[i * 3 + 2] = next.y;
        }

        state.pointsMesh.geometry.attributes.position.needsUpdate = true;
        updateSeparationAccuracy();

        if (t < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
});

// ---------- Plane controls ----------
function syncRangeProgress(id) {
    const el = $(id);
    if (!el) return;
    const min = Number(el.min);
    const max = Number(el.max);
    const val = Number(el.value);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(val)) {
        el.style.setProperty('--range-progress', '50%');
        return;
    }
    const p = ((val - min) / (max - min)) * 100;
    const clamped = Math.min(100, Math.max(0, p));
    el.style.setProperty('--range-progress', clamped.toFixed(4) + '%');
}

function updatePlane() {
    const z = Number($('plane-z').value);
    const yaw = Number($('plane-yaw').value) * Math.PI / 180;
    const pitch = Number($('plane-pitch').value) * Math.PI / 180;

    // 平面初始朝上（x-z 平面），保留这个基础姿态
    plane.position.y = z;
    plane.rotation.set(Math.PI / 2 + pitch, yaw, 0);

    $('plane-z-val').textContent = z.toFixed(2);
    $('plane-yaw-val').textContent = `${Math.round(yaw * 180 / Math.PI)}°`;
    $('plane-pitch-val').textContent = `${Math.round(pitch * 180 / Math.PI)}°`;
    state.lastPlaneParams = {
        z,
        yaw: Math.round(yaw * 180 / Math.PI),
        pitch: Math.round(pitch * 180 / Math.PI)
    };

    syncRangeProgress('plane-z');
    syncRangeProgress('plane-yaw');
    syncRangeProgress('plane-pitch');
    updateSeparationAccuracy();
}

['plane-z', 'plane-yaw', 'plane-pitch'].forEach(id => {
    $(id).addEventListener('input', updatePlane);
    $(id).addEventListener('change', () => {
        trackNoteEvent('plane_adjust', {control: id, value: $(id).value});
        pushProcessStep('plane_adjust', {control: id, value: $(id).value});
    });
});

function validateMappingExpr(expr, testScope) {
    const val = evaluateMappingExpr(expr, testScope.x, testScope.y);
    if (!Number.isFinite(val)) {
        throw new Error(`表达式 "${expr}" 结果不是有效数值`);
    }
}

function applyCustomMappingFromInputs() {
    const errEl = $('map-expr-error');
    if (errEl) errEl.textContent = '';

    const xExpr = $('map-x-input').value.trim();
    const yExpr = $('map-y-input').value.trim();
    const zExpr = $('map-z-input').value.trim();

    if (!xExpr || !yExpr || !zExpr) {
        const msg = '请完整输入 x_new、y_new、z_new 三个表达式。';
        if (errEl) errEl.textContent = msg;
        setStatus(msg, true);
        return;
    }

    try {
        validateMappingExpr(xExpr, {x: 1.23, y: -0.8});
        validateMappingExpr(yExpr, {x: 1.23, y: -0.8});
        validateMappingExpr(zExpr, {x: 1.23, y: -0.8});
        state.mapExpr = {x: xExpr, y: yExpr, z: zExpr};
        refreshCurrentMapText();
        pushProcessStep('custom_map_apply', {map_expr: {...state.mapExpr}});
        trackNoteEvent('custom_map_apply', {map_expr: {...state.mapExpr}});
        setStatus('自定义映射已应用。点击“升维动画”查看效果。');
        $('custom-map-modal').style.display = 'none';
    } catch (err) {
        const msg = `映射表达式错误：${err.message}`;
        if (errEl) errEl.textContent = msg;
        setStatus(msg, true);
    }
}

$('apply-map-btn').addEventListener('click', applyCustomMappingFromInputs);
$('custom-map-btn').addEventListener('click', () => {
    const errEl = $('map-expr-error');
    if (errEl) errEl.textContent = '';
    $('custom-map-modal').style.display = 'flex';
});
$('map-preset-select').addEventListener('change', (e) => {
    const preset = MAPPING_PRESETS[e.target.value];
    if (!preset) return;
    $('map-x-input').value = preset.x;
    $('map-y-input').value = preset.y;
    $('map-z-input').value = preset.z;
});
$('close-map-modal').addEventListener('click', () => {
    $('custom-map-modal').style.display = 'none';
});
window.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'custom-map-modal') {
        $('custom-map-modal').style.display = 'none';
    }
});

// ---------- Default preset ----------
function applyDefaultMode() {
    $('map-preset-select').value = 'quadratic_monomial';
    $('map-x-input').value = MAPPING_PRESETS.quadratic_monomial.x;
    $('map-y-input').value = MAPPING_PRESETS.quadratic_monomial.y;
    $('map-z-input').value = MAPPING_PRESETS.quadratic_monomial.z;
    state.mapExpr = {
        x: $('map-x-input').value,
        y: $('map-y-input').value,
        z: $('map-z-input').value
    };
    refreshCurrentMapText();

    $('plane-z').value = '0';
    $('plane-yaw').value = '0';
    $('plane-pitch').value = '0';
    updatePlane();
}

$('default-mode-btn').addEventListener('click', () => {
    applyDefaultMode();
    if (state.points.length && state.pointsMesh) {
        createOrUpdatePoints();
        setStatus('已切换为默认参数模式。');
    }
});

updatePlane();

// 给出一个默认内置数据（方便立即体验）
const defaultCsv = `x,y,label
-2.2,-1.8,A
-2.0,-1.3,A
-1.8,-0.9,A
-1.5,-0.6,A
-1.2,-0.2,A
0.9,0.2,A
0.6,0.6,A
0.3,1.0,A
0.2,1.4,A
0.7,1.8,A
1.1,2.1,A
1.5,2.4,A
2.1,2.0,A
-1.7,-1.6,A
-1.3,-1.2,A
0.8,0.8,A
-2.1,1.9,B
-1.7,1.4,B
-1.2,0.9,B
-0.7,0.4,B
0.2,-0.1,B
0.3,-0.6,B
0.8,-1.1,B
1.3,-1.6,B
1.8,-2.1,B
-2.2,1.8,B
-1.8,1.3,B
1.3,-0.8,B
0.8,-0.3,B
0.2,-0.2,B
-0.3,0.7,B
-0.8,1.2,B`;
parseCsv(defaultCsv);
$('preset-dataset').value = 'xor';
applyDefaultMode();
visualizeFromSelection(false);

window.getKernelTrickPageData = function () {
    const xCol = Number($('x-col')?.value ?? 0);
    const yCol = Number($('y-col')?.value ?? 1);
    const labelCol = Number($('label-col')?.value ?? 2);
    return {
        experiment_module: 'svm-smo.kernel_trick',
        dataset_source: state.datasetSource,
        dataset_meta: state.datasetMeta,
        headers: state.headers,
        column_mapping: {
            x_col_index: Number.isFinite(xCol) ? xCol : null,
            y_col_index: Number.isFinite(yCol) ? yCol : null,
            label_col_index: Number.isFinite(labelCol) ? labelCol : null,
            x_col_name: state.headers[xCol] || null,
            y_col_name: state.headers[yCol] || null,
            label_col_name: state.headers[labelCol] || null,
        },
        map_expression: {...state.mapExpr},
        plane_params: {...state.lastPlaneParams},
        sample_count: state.points.length,
        class_labels: [...new Set(state.points.map(p => p.label))],
        current_accuracy_percent: state.latestAccuracy,
        process_log: state.processLog,
        uploaded_files: state.uploadedFiles,
        user_result_summary: {
            status_text: $('dataset-status')?.textContent || '',
            accuracy_text: $('split-acc')?.textContent || ''
        },
        iteration_log: state.processLog.map((item, idx) => ({
            iteration: idx + 1,
            action: item.step,
            detail: item.detail,
            timestamp: item.timestamp
        }))
    };
};
