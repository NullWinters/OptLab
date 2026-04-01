/**
 * SMO Algorithm Implementation for 2D Linear SVM
 */
class SMO {
    constructor(data, C, tol, maxIter) {
        this.X = data.map(d => [d.x, d.y]);
        this.y = data.map(d => d.label);
        this.N = data.length;
        this.C = C;
        this.tol = tol;
        this.maxIter = maxIter;

        this.alphas = new Array(this.N).fill(0);
        this.b = 0;
        this.w = [0, 0];
        this.errors = this.y.map(yi => -yi); // Initially g(x) = 0, so E = 0 - y = -y

        this.iter = 0;
        this.subStep = 0; // 0: select i, 1: select j, 2: update
        this.i = -1;
        this.j = -1;
        this.jCandidates = [];
        this.jCandidateIdx = 0;
        this.jSearchStage = 0; // 0: heuristic, 1: random
        this.jTried = new Set();
        this.isFinished = false;

        // Track if there were any changes in the current full pass
        this.entireSet = true;
        this.numChanged = 0;
    }

    getG(idx) {
        // g(x) = w * x + b
        return this.w[0] * this.X[idx][0] + this.w[1] * this.X[idx][1] + this.b;
    }

    updateW() {
        // w = sum(alpha_i * y_i * x_i)
        let wx = 0, wy = 0;
        for (let i = 0; i < this.N; i++) {
            wx += this.alphas[i] * this.y[i] * this.X[i][0];
            wy += this.alphas[i] * this.y[i] * this.X[i][1];
        }
        this.w = [wx, wy];
    }

    updateErrors() {
        for (let k = 0; k < this.N; k++) {
            this.errors[k] = this.getG(k) - this.y[k];
        }
    }

    getAccuracy() {
        let correct = 0;
        for (let i = 0; i < this.N; i++) {
            const g = this.getG(i);
            const pred = g >= 0 ? 1 : -1;
            if (pred === this.y[i]) {
                correct++;
            }
        }
        return correct / this.N;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Helper to compute partial objective function for alpha_i and alpha_j
    getObjective(i, j, ai, aj) {
        const Ki = this.X[i][0] ** 2 + this.X[i][1] ** 2;
        const Kj = this.X[j][0] ** 2 + this.X[j][1] ** 2;
        const Kij = this.X[i][0] * this.X[j][0] + this.X[i][1] * this.X[j][1];

        let s = 0;
        for (let k = 0; k < this.N; k++) {
            if (k !== i && k !== j) {
                s += this.alphas[k] * this.y[k] * (this.y[i] * (this.X[k][0] * this.X[i][0] + this.X[k][1] * this.X[i][1]) +
                    this.y[j] * (this.X[k][0] * this.X[j][0] + this.X[k][1] * this.X[j][1]));
            }
        }

        return ai + aj - 0.5 * Ki * ai ** 2 - 0.5 * Kj * aj ** 2 - this.y[i] * this.y[j] * Kij * ai * aj - ai * s;
    }

    // Check if i violates KKT
    violatesKKT(i) {
        const Ei = this.errors[i];
        const r = Ei * this.y[i];
        return (r < -this.tol && this.alphas[i] < this.C) || (r > this.tol && this.alphas[i] > 0);

    }

    nextStep() {
        if (this.isFinished) return false;

        // Check iteration limit
        if (this.iter >= this.maxIter) {
            this.isFinished = true;
            return false;
        }

        if (this.subStep === 0) {
            // 选择第一个拉格朗日乘子 i
            let found = false;
            let startIndex = (this.i === -1) ? 0 : (this.i + 1) % this.N;

            // 1. 优先遍历非边界样本（支持向量，0 < alpha < C），寻找违反 KKT 条件的样本
            for (let count = 0; count < this.N; count++) {
                let idx = (startIndex + count) % this.N;
                if (this.alphas[idx] > 0 && this.alphas[idx] < this.C) {
                    if (this.violatesKKT(idx)) {
                        this.i = idx;
                        found = true;
                        break;
                    }
                }
            }

            // 2. 如果非边界样本中没有违反 KKT 的，则遍历整个数据集寻找违反者
            if (!found) {
                for (let count = 0; count < this.N; count++) {
                    let idx = (startIndex + count) % this.N;
                    if (this.violatesKKT(idx)) {
                        this.i = idx;
                        found = true;
                        break;
                    }
                }
            }

            if (!found) {
                this.isFinished = true;
                return false;
            }

            this.j = -1; // 重置 j
            this.jCandidates = [];
            this.jCandidateIdx = 0;
            this.jSearchStage = 0;
            this.jTried.clear();
            this.subStep = 1;
            return true;
        } else if (this.subStep === 1) {
            // Select second alpha j using two-stage search mechanism
            if (this.jCandidates.length === 0 || this.jCandidateIdx >= this.jCandidates.length) {
                const Ei = this.errors[this.i];

                if (this.jSearchStage === 0) {
                    // Phase 1: Heuristic optimal search (non-bound examples)
                    let nonBoundCandidates = [];
                    for (let k = 0; k < this.N; k++) {
                        if (k === this.i) continue;
                        if (this.alphas[k] > 0 && this.alphas[k] < this.C) {
                            nonBoundCandidates.push({ idx: k, deltaE: Math.abs(Ei - this.errors[k]) });
                        }
                    }
                    if (nonBoundCandidates.length > 0) {
                        nonBoundCandidates.sort((a, b) => b.deltaE - a.deltaE);
                        this.jCandidates = nonBoundCandidates.map(c => c.idx);
                        this.jCandidates.forEach(idx => this.jTried.add(idx));
                        this.jCandidateIdx = 0;
                        this.jSearchStage = 1;
                    } else {
                        // Skip to next phase if no non-bound candidates
                        this.jSearchStage = 1;
                    }
                }

                // Stage transitions
                if (this.jSearchStage === 1 && (this.jCandidates.length === 0 || this.jCandidateIdx >= this.jCandidates.length)) {
                    // Phase 2: Backup random search (other candidates)
                    let otherCandidates = [];
                    for (let k = 0; k < this.N; k++) {
                        if (k === this.i || this.jTried.has(k)) continue;
                        otherCandidates.push(k);
                    }
                    if (otherCandidates.length > 0) {
                        this.shuffle(otherCandidates);
                        this.jCandidates = otherCandidates;
                        this.jCandidateIdx = 0;
                        this.jSearchStage = 2;
                    } else {
                        // All candidates exhausted for this i
                        this.jSearchStage = 3;
                    }
                }

                // If completely exhausted all candidates for current i
                if (this.jSearchStage >= 3 || (this.jSearchStage === 2 && this.jCandidateIdx >= this.jCandidates.length)) {
                    this.jCandidates = [];
                    this.jCandidateIdx = 0;
                    this.jSearchStage = 0;
                    this.jTried.clear();
                    this.subStep = 0;
                    return this.nextStep();
                }
            }

            this.j = this.jCandidates[this.jCandidateIdx++];
            this.subStep = 2;
            return true;
        } else if (this.subStep === 2) {
            // Update alphas i and j
            const i = this.i;
            const j = this.j;
            const Yi = this.y[i];
            const Yj = this.y[j];
            const Ei = this.errors[i];
            const Ej = this.errors[j];
            const oldAi = this.alphas[i];
            const oldAj = this.alphas[j];

            let L, H;
            if (Yi !== Yj) {
                L = Math.max(0, oldAj - oldAi);
                H = Math.min(this.C, this.C + oldAj - oldAi);
            } else {
                L = Math.max(0, oldAi + oldAj - this.C);
                H = Math.min(this.C, oldAi + oldAj);
            }

            if (L === H) {
                this.subStep = 1; // Try next j
                return this.nextStep();
            }

            const K11 = this.X[i][0] ** 2 + this.X[i][1] ** 2;
            const K22 = this.X[j][0] ** 2 + this.X[j][1] ** 2;
            const K12 = this.X[i][0] * this.X[j][0] + this.X[i][1] * this.X[j][1];
            const eta = K11 + K22 - 2 * K12;

            let newAj;
            if (eta > 0) {
                newAj = oldAj + Yj * (Ei - Ej) / eta;
                if (newAj > H) newAj = H;
                else if (newAj < L) newAj = L;
            } else {
                // eta <= 0: evaluate objective at boundaries L and H
                const L_ai = oldAi + Yi * Yj * (oldAj - L);
                const H_ai = oldAi + Yi * Yj * (oldAj - H);

                const objL = this.getObjective(i, j, L_ai, L);
                const objH = this.getObjective(i, j, H_ai, H);

                if (objL > objH + 1e-10) {
                    newAj = L;
                } else if (objL < objH - 1e-10) {
                    newAj = H;
                } else {
                    newAj = oldAj;
                }
            }

            if (Math.abs(newAj - oldAj) < 1e-12) {
                this.subStep = 1; // Try next j
                return this.nextStep();
            }

            const newAi = oldAi + Yi * Yj * (oldAj - newAj);

            // Update b
            const b1 = this.b - Ei - Yi * (newAi - oldAi) * K11 - Yj * (newAj - oldAj) * K12;
            const b2 = this.b - Ej - Yi * (newAi - oldAi) * K12 - Yj * (newAj - oldAj) * K22;

            if (newAi > 0 && newAi < this.C) this.b = b1;
            else if (newAj > 0 && newAj < this.C) this.b = b2;
            else this.b = (b1 + b2) / 2;

            this.alphas[i] = newAi;
            this.alphas[j] = newAj;

            this.updateW();
            this.updateErrors();
            this.iter++;

            // If reached max iter, mark as finished immediately
            if (this.iter >= this.maxIter) {
                this.isFinished = true;
            }

            // Success! Reset j candidates for next i
            this.jCandidates = [];
            this.jCandidateIdx = 0;
            this.jSearchStage = 0;
            this.jTried.clear();
            this.subStep = 0;
            return true;
        }
    }
}

/**
 * Visualization and Page Logic
 */
const App = {
    data: [],
    rawCSVHeader: [],
    rawCSVData: [],
    smo: null,
    state: 'unstarted', // unstarted, playing, paused, finished
    timer: null,
    speed: 500,
    processLog: [],
    uploadedFiles: [],
    datasetSource: 'example',
    dataSnapshotForNote: [],

    // Hyperparameters
    C: 1.0,
    tol: 0.01,
    maxIter: 100,

    // D3 elements
    svg: null,
    tooltip: null,
    width: 0,
    height: 0,
    xScale: null,
    yScale: null,

    init() {
        this.setupD3();
        this.bindEvents();
        this.loadExampleData();
        this.updateUI();
    },

    trackNoteEvent(type, data) {
        if (window.ExperimentNotes && typeof window.ExperimentNotes.trackEvent === 'function') {
            window.ExperimentNotes.trackEvent(type, data || {});
        }
    },

    pushProcessStep(step, detail) {
        this.processLog.push({
            step,
            detail: detail || {},
            state: this.state,
            iter: this.smo ? this.smo.iter : 0,
            timestamp: new Date().toISOString()
        });
        if (this.processLog.length > 500) {
            this.processLog.shift();
        }
    },

    setupD3() {
        this.container = d3.select("#smo-canvas");

        this.svg = this.container.append("svg")
            .style("display", "block");

        this.tooltip = this.container.append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // Layers
        this.g = this.svg.append("g");

        this.xScale = d3.scaleLinear();
        this.yScale = d3.scaleLinear();

        this.xAxis = this.g.append("g");
        this.yAxis = this.g.append("g");

        this.planeLayer = this.g.append("g").attr("class", "plane-layer");
        this.pointLayer = this.g.append("g").attr("class", "point-layer");
        this.highlightLayer = this.g.append("g").attr("class", "highlight-layer");

        // Initial update
        this.updateDimensions();

        // 监听画布尺寸变化，实现自动重绘
        const resizeObserver = new ResizeObserver(() => {
            this.handleResize();
        });
        resizeObserver.observe(this.container.node());
    },

    updateDimensions() {
        if (!this.container) this.container = d3.select("#smo-canvas");
        const rect = this.container.node().getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        this.svg
            .attr("width", this.width)
            .attr("height", this.height);

        const margin = { top: 20, right: 20, bottom: 30, left: 40 };
        this.innerWidth = this.width - margin.left - margin.right;
        this.innerHeight = this.height - margin.top - margin.bottom;

        this.g.attr("transform", `translate(${margin.left}, ${margin.top})`);

        this.xScale.range([0, this.innerWidth]);
        this.yScale.range([this.innerHeight, 0]);

        this.xAxis.attr("transform", `translate(0, ${this.innerHeight})`);

        // Update scales if domain exists
        if (this.data && this.data.length > 0) {
            this.updateScales();
        }

        // Update clip path
        let defs = this.svg.select("defs");
        if (defs.empty()) defs = this.svg.append("defs");

        let clip = defs.select("#clip");
        if (clip.empty()) {
            clip = defs.append("clipPath").attr("id", "clip");
            clip.append("rect");
        }
        clip.select("rect")
            .attr("width", this.innerWidth)
            .attr("height", this.innerHeight);
    },

    handleResize() {
        this.updateDimensions();
        this.draw();
    },

    bindEvents() {
        document.getElementById('btn-play').onclick = () => this.play();
        document.getElementById('btn-pause').onclick = () => this.pause();
        document.getElementById('btn-step').onclick = () => this.step();
        document.getElementById('btn-reset').onclick = () => this.loadExampleData();
        document.getElementById('csv-upload').onchange = (e) => this.handleUpload(e);
        document.getElementById('btn-apply-cols').onclick = () => this.applySelectedColumns();

        ['btn-play','btn-pause','btn-step','btn-reset'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', () => {
                    this.trackNoteEvent('control', { action: id.replace('btn-', '') });
                    this.pushProcessStep('control', { action: id.replace('btn-', '') });
                }, { capture: true });
            }
        });

        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimer);
            this.resizeTimer = setTimeout(() => this.handleResize(), 100);
        });

        // Sliders
        const updateC = (val) => {
            this.C = Math.pow(10, parseFloat(val));
            this.pushProcessStep('set_hyperparam', { param: 'C', value: this.C });
            this.trackNoteEvent('param_change', { param: 'C', value: this.C });
            document.getElementById('val-c').innerText = (this.C < 0.01 || this.C > 1000) ? this.C.toExponential(2) : this.C.toFixed(2);
            if (this.state !== 'unstarted') this.reset();
        };
        const updateTol = (val) => {
            this.tol = Math.pow(10, parseFloat(val));
            this.pushProcessStep('set_hyperparam', { param: 'tol', value: this.tol });
            this.trackNoteEvent('param_change', { param: 'tol', value: this.tol });
            document.getElementById('val-tol').innerText = (this.tol < 0.01) ? this.tol.toExponential(2) : this.tol.toFixed(4);
            if (this.state !== 'unstarted') this.reset();
        };
        const updateMaxIter = (val) => {
            this.maxIter = parseInt(val);
            this.pushProcessStep('set_hyperparam', { param: 'maxIter', value: this.maxIter });
            this.trackNoteEvent('param_change', { param: 'maxIter', value: this.maxIter });
            document.getElementById('val-max-iter').innerText = this.maxIter;
            if (this.state !== 'unstarted') this.reset();
        };

        document.getElementById('slider-c').oninput = (e) => updateC(e.target.value);
        document.getElementById('slider-tol').oninput = (e) => updateTol(e.target.value);
        document.getElementById('slider-max-iter').oninput = (e) => updateMaxIter(e.target.value);

        // Speed Control
        document.getElementById('speed-control').oninput = (e) => {
            // value is 100 to 2000. 
            // In observation.html: AppState.speed = 2100 - parseInt(e.target.value);
            // Higher value in slider means faster speed (smaller interval)
            this.speed = 2100 - parseInt(e.target.value);
            this.trackNoteEvent('param_change', { param: 'speed', value: this.speed });
            this.pushProcessStep('set_speed', { slider: parseInt(e.target.value), interval: this.speed });
            let speedText;
            speedText = this.speed < 500 ? '快速' : this.speed < 1500 ? '正常' : '慢速';
            document.getElementById('speed-value').innerText = speedText;
            if (this.state === 'playing') {
                this.pause();
                this.play();
            }
        };

        this.initIterationDataActions();
    },

    togglePanel(el) {
        const card = el.closest('.panel-card');
        card.classList.toggle('collapsed');
        // 尺寸变化由 ResizeObserver 捕获并触发 handleResize
    },

    loadExampleData() {
        // Simple linear separable data
        this.data = [
            { x: 1, y: 1, label: 1 }, { x: 2, y: 1, label: 1 }, { x: 1, y: 2, label: 1 },
            { x: 4, y: 4, label: -1 }, { x: 5, y: 4, label: -1 }, { x: 4, y: 5, label: -1 },
            { x: 2, y: 3, label: 1 }, { x: 3, y: 2, label: 1 },
            { x: 5, y: 5, label: -1 }, { x: 6, y: 5, label: -1 }, { x: 5, y: 6, label: -1 }
        ];
        this.data.forEach((d, i) => d.id = i);
        this.datasetSource = 'example';
        this.rawCSVHeader = ['x', 'y', 'label'];
        this.rawCSVData = this.data.map((d) => [String(d.x), String(d.y), String(d.label)]);
        this.uploadedFiles = [];
        this.dataSnapshotForNote = this.data.map((d) => ({ ...d }));
        this.pushProcessStep('load_example_data', { sample_count: this.data.length });
        document.getElementById('column-selection').style.display = 'none';
        document.getElementById('csv-upload').value = '';
        this.reset();
    },

    handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            this.datasetSource = 'uploaded_csv';
            this.uploadedFiles = [{
                name: file.name,
                size: file.size,
                type: file.type || 'text/csv',
                text_preview: String(text || '').slice(0, 6000)
            }];
            this.trackNoteEvent('upload_csv', { file_name: file.name, file_size: file.size });
            this.pushProcessStep('upload_csv', { file_name: file.name, file_size: file.size });
            this.processCSV(text);
        };
        reader.readAsText(file);
    },

    processCSV(text) {
        const rows = text.split('\n').map(r => r.trim()).filter(r => r);
        if (rows.length < 2) return;

        const header = rows[0].split(',').map(s => s.trim());
        const dataRows = rows.slice(1).map(row => row.split(',').map(s => s.trim()));

        this.rawCSVHeader = header;
        this.rawCSVData = dataRows;
        this.pushProcessStep('parse_csv', { headers: header, rows_count: dataRows.length });

        this.fillColumnSelects(header);
        document.getElementById('column-selection').style.display = 'block';
    },

    fillColumnSelects(header) {
        const xSelect = document.getElementById('x-col');
        const ySelect = document.getElementById('y-col');
        const labelSelect = document.getElementById('label-col');

        [xSelect, ySelect, labelSelect].forEach(select => {
            select.innerHTML = '';
            header.forEach((col, idx) => {
                const option = document.createElement('option');
                option.value = idx;
                option.text = col;
                select.appendChild(option);
            });
        });

        // Try to auto-select if common names exist
        header.forEach((col, idx) => {
            const name = col.toLowerCase();
            if (name === 'x') xSelect.value = idx;
            if (name === 'y') ySelect.value = idx;
            if (name === 'label' || name === 'target' || name === 'class') labelSelect.value = idx;
        });
    },

    applySelectedColumns() {
        const xIdx = parseInt(document.getElementById('x-col').value);
        const yIdx = parseInt(document.getElementById('y-col').value);
        const labelIdx = parseInt(document.getElementById('label-col').value);

        if (isNaN(xIdx) || isNaN(yIdx) || isNaN(labelIdx)) {
            alert("请选择有效的列");
            return;
        }

        const newData = [];
        const labels = new Set();

        for (let i = 0; i < this.rawCSVData.length; i++) {
            const cols = this.rawCSVData[i];
            const x = parseFloat(cols[xIdx]);
            const y = parseFloat(cols[yIdx]);
            const label = cols[labelIdx];

            if (isNaN(x) || isNaN(y)) continue;

            newData.push({ x, y, originalLabel: label });
            labels.add(label);
        }

        if (labels.size > 2) {
            alert("标签列的取值种类不能超过2种（当前检测到 " + labels.size + " 种）");
            return;
        }

        const labelArr = Array.from(labels);
        newData.forEach((d, idx) => {
            d.label = (d.originalLabel === labelArr[0]) ? 1 : -1;
            d.id = idx;
        });

        this.data = newData;
        this.dataSnapshotForNote = this.data.map((d) => ({ ...d }));
        this.pushProcessStep('apply_columns', {
            x_col: xIdx,
            y_col: yIdx,
            label_col: labelIdx,
            sample_count: this.data.length,
            class_count: labels.size
        });
        this.trackNoteEvent('apply_columns', {
            x_col: xIdx,
            y_col: yIdx,
            label_col: labelIdx,
            sample_count: this.data.length
        });
        this.reset();
        // Keep the column selection visible but maybe collapse it if we had a toggle
    },

    reset() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.smo = new SMO(this.data, this.C, this.tol, this.maxIter);
        this.state = 'unstarted';
        this.pushProcessStep('reset_algorithm', {
            C: this.C,
            tol: this.tol,
            maxIter: this.maxIter,
            sample_count: this.data.length
        });
        this.updateScales();
        this.draw();
        this.updateUI();
    },

    updateScales() {
        const xExtent = d3.extent(this.data, d => d.x);
        const yExtent = d3.extent(this.data, d => d.y);
        const xPadding = (xExtent[1] - xExtent[0]) * 0.2 || 1;
        const yPadding = (yExtent[1] - yExtent[0]) * 0.2 || 1;

        this.xScale.domain([xExtent[0] - xPadding, xExtent[1] + xPadding]);
        this.yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]);

        this.xAxis.call(d3.axisBottom(this.xScale));
        this.yAxis.call(d3.axisLeft(this.yScale));
    },

    play() {
        if (this.state === 'finished') return;
        this.state = 'playing';
        this.updateUI();
        this.timer = setInterval(() => {
            if (!this.stepLogic()) {
                this.pause();
                if (this.smo.isFinished) {
                    this.state = 'finished';
                    this.updateUI();
                }
            }
        }, this.speed);
    },

    pause() {
        if (this.state === 'playing') {
            this.state = 'paused';
        }
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.updateUI();
    },

    step() {
        if (this.state === 'finished') return;
        this.stepLogic();
        if (this.smo.isFinished) {
            this.state = 'finished';
        } else {
            this.state = 'paused';
        }
        this.updateUI();
    },

    stepLogic() {
        const result = this.smo.nextStep();
        this.pushProcessStep('smo_step', {
            success: !!result,
            iter: this.smo.iter,
            sub_step: this.smo.subStep,
            i: this.smo.i,
            j: this.smo.j,
            alpha_i: this.smo.i >= 0 ? this.smo.alphas[this.smo.i] : null,
            alpha_j: this.smo.j >= 0 ? this.smo.alphas[this.smo.j] : null,
            w: this.smo.w,
            b: this.smo.b,
            accuracy: this.smo.getAccuracy(),
            is_finished: this.smo.isFinished
        });
        this.draw();
        this.updateParams();
        return result;
    },

    draw() {
        // Points
        const points = this.pointLayer.selectAll("circle").data(this.data);
        points.enter().append("circle")
            .merge(points)
            .attr("cx", d => this.xScale(d.x))
            .attr("cy", d => this.yScale(d.y))
            .attr("r", 5)
            .attr("fill", d => d.label === 1 ? "#e74c3c" : "#3498db")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .on("mouseover", (event, d) => {
                const alpha = this.smo ? this.smo.alphas[d.id] : 0;
                const error = this.smo ? this.smo.errors[d.id] : 0;
                this.tooltip.transition().duration(200).style("opacity", .9);
                const yiEi = d.label * error;
                this.tooltip.html(`
                    <b>编号:</b> ${d.id}<br/>
                    <b>坐标:</b> (${d.x.toFixed(2)}, ${d.y.toFixed(2)})<br/>
                    <b>乘子 α:</b> ${alpha.toFixed(4)}<br/>
                    <b>偏差 E:</b> ${error.toFixed(4)}<br/>
                    <b>y<sub>i</sub>*E<sub>i</sub>:</b> ${yiEi.toFixed(4)}
                `);

                const [mouseX, mouseY] = d3.pointer(event, this.container.node());
                this.tooltip
                    .style("left", (mouseX + 15) + "px")
                    .style("top", (mouseY - 15) + "px");
            })
            .on("mousemove", (event) => {
                const [mouseX, mouseY] = d3.pointer(event, this.container.node());
                this.tooltip
                    .style("left", (mouseX + 15) + "px")
                    .style("top", (mouseY - 15) + "px");
            })
            .on("mouseout", () => {
                this.tooltip.transition().duration(500).style("opacity", 0);
            });
        points.exit().remove();

        // Highlighting
        this.highlightLayer.selectAll("*").remove();
        if (this.smo && this.smo.i !== -1 && this.data[this.smo.i]) {
            const pi = this.data[this.smo.i];
            this.highlightLayer.append("circle")
                .attr("cx", this.xScale(pi.x))
                .attr("cy", this.yScale(pi.y))
                .attr("r", 10)
                .attr("fill", "none")
                .attr("stroke", "#f1c40f")
                .attr("stroke-width", 3)
                .attr("stroke-dasharray", "4 2");

            const text_i = this.highlightLayer.append("text")
                .attr("x", this.xScale(pi.x) + 12)
                .attr("y", this.yScale(pi.y) + 5)
                .attr("fill", "#f1c40f")
                .attr("font-weight", "bold")
                .attr("style", "font-family: Arial, sans-serif; pointer-events: none;");
            
            text_i.append("tspan").text("a");
            text_i.append("tspan")
                .attr("baseline-shift", "sub")
                .attr("font-size", "0.7em")
                .text("i");
        }
        if (this.smo && this.smo.j !== -1 && this.smo.subStep !== 1 && this.data[this.smo.j]) {
            const pj = this.data[this.smo.j];
            this.highlightLayer.append("circle")
                .attr("cx", this.xScale(pj.x))
                .attr("cy", this.yScale(pj.y))
                .attr("r", 10)
                .attr("fill", "none")
                .attr("stroke", "#f39c12")
                .attr("stroke-width", 3)
                .attr("stroke-dasharray", "4 2");

            const text_j = this.highlightLayer.append("text")
                .attr("x", this.xScale(pj.x) + 12)
                .attr("y", this.yScale(pj.y) + 5)
                .attr("fill", "#f39c12")
                .attr("font-weight", "bold")
                .attr("style", "font-family: Arial, sans-serif; pointer-events: none;");

            text_j.append("tspan").text("a");
            text_j.append("tspan")
                .attr("baseline-shift", "sub")
                .attr("font-size", "0.7em")
                .text("j");
        }

        // Plane
        this.planeLayer.selectAll("*").remove();
        if (this.smo && (this.smo.w[0] !== 0 || this.smo.w[1] !== 0)) {
            this.drawBoundary(this.smo.w, this.smo.b, "#5f3a1f", 2, false, "分离超平面", 0);
            this.drawBoundary(this.smo.w, this.smo.b + 1, "#8f6a4f", 1, true, "间隔边界", -1);
            this.drawBoundary(this.smo.w, this.smo.b - 1, "#8f6a4f", 1, true, "间隔边界", 1);
        }
    },

    drawBoundary(w, bOffset, color, width, dashed, title, target) {
        // w0*x + w1*y + bOffset = 0  =>  y = (-w0*x - bOffset) / w1
        const x1 = this.xScale.domain()[0];
        const x2 = this.xScale.domain()[1];
        let p1, p2;

        if (Math.abs(w[1]) > 1e-9) {
            p1 = [x1, (-w[0] * x1 - bOffset) / w[1]];
            p2 = [x2, (-w[0] * x2 - bOffset) / w[1]];
        } else {
            const vx = -bOffset / w[0];
            p1 = [vx, this.yScale.domain()[0]];
            p2 = [vx, this.yScale.domain()[1]];
        }

        const group = this.planeLayer.append("g");

        // Visible line
        group.append("line")
            .attr("x1", this.xScale(p1[0]))
            .attr("y1", this.yScale(p1[1]))
            .attr("x2", this.xScale(p2[0]))
            .attr("y2", this.yScale(p2[1]))
            .attr("stroke", color)
            .attr("stroke-width", width)
            .attr("stroke-dasharray", dashed ? "5,5" : "none")
            .attr("clip-path", "url(#clip)");

        // Wide invisible line for easier hovering
        group.append("line")
            .attr("x1", this.xScale(p1[0]))
            .attr("y1", this.yScale(p1[1]))
            .attr("x2", this.xScale(p2[0]))
            .attr("y2", this.yScale(p2[1]))
            .attr("stroke", "transparent")
            .attr("stroke-width", 10)
            .attr("cursor", "pointer")
            .attr("clip-path", "url(#clip)")
            .on("mouseover", (event) => {
                this.tooltip.transition().duration(200).style("opacity", .9);
                
                const fmtNum = (val, isFirst = false) => {
                    const sign = val >= 0 ? (isFirst ? "" : "+ ") : (isFirst ? "-" : "- ");
                    return sign + Math.abs(val).toFixed(3);
                };

                const w0Str = fmtNum(w[0], true);
                const w1Part = fmtNum(w[1]) + "x<sub>2</sub>";
                const bPart = fmtNum(this.smo.b);
                const expr = `${w0Str}x<sub>1</sub> ${w1Part} ${bPart} = ${target}`;

                this.tooltip.html(`
                    <b>${title}</b><br/>
                    <b>表达式:</b><br/>
                    <span style="font-family: 'Times New Roman', Times, serif;">${expr}</span>
                `);

                const [mouseX, mouseY] = d3.pointer(event, this.container.node());
                this.tooltip
                    .style("left", (mouseX + 15) + "px")
                    .style("top", (mouseY - 15) + "px");
            })
            .on("mousemove", (event) => {
                const [mouseX, mouseY] = d3.pointer(event, this.container.node());
                this.tooltip
                    .style("left", (mouseX + 15) + "px")
                    .style("top", (mouseY - 15) + "px");
            })
            .on("mouseout", () => {
                this.tooltip.transition().duration(500).style("opacity", 0);
            });
    },

    updateUI() {
        const playBtn = document.getElementById('btn-play');
        const pauseBtn = document.getElementById('btn-pause');
        const stepBtn = document.getElementById('btn-step');

        playBtn.disabled = (this.state === 'playing' || this.state === 'finished');
        pauseBtn.disabled = (this.state !== 'playing');
        stepBtn.disabled = (this.state === 'playing' || this.state === 'finished');

        const statusEl = document.getElementById('status-text');
        statusEl.innerText = {
            'unstarted': '未开始',
            'playing': '播放中',
            'paused': '已暂停',
            'finished': '已结束'
        }[this.state];
        statusEl.className = 'status-tag status-' + this.state;

        this.updateParams();
    },

    updateParams() {
        if (!this.smo) return;
        document.getElementById('param-iter').innerText = this.smo.iter;
        document.getElementById('param-i').innerText = this.smo.i === -1 ? '-' : this.smo.i;
        document.getElementById('param-j').innerText = (this.smo.j === -1 || this.smo.subStep === 1) ? '-' : this.smo.j;

        document.getElementById('param-alpha-i').innerText = this.smo.i === -1 ? '-' : this.smo.alphas[this.smo.i].toFixed(4);
        document.getElementById('param-alpha-j').innerText = (this.smo.j === -1 || this.smo.subStep === 1) ? '-' : this.smo.alphas[this.smo.j].toFixed(4);

        if (this.smo.i !== -1 && this.data[this.smo.i]) {
            const p = this.data[this.smo.i];
            document.getElementById('param-coord-i').innerText = `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
        } else {
            document.getElementById('param-coord-i').innerText = '-';
        }

        if (this.smo.j !== -1 && this.smo.subStep !== 1 && this.data[this.smo.j]) {
            const p = this.data[this.smo.j];
            document.getElementById('param-coord-j').innerText = `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
        } else {
            document.getElementById('param-coord-j').innerText = '-';
        }

        document.getElementById('param-w').innerText = `[${this.smo.w[0].toFixed(3)}, ${this.smo.w[1].toFixed(3)}]`;
        document.getElementById('param-b').innerText = this.smo.b.toFixed(3);

        const accuracy = this.smo.getAccuracy();
        document.getElementById('param-accuracy').innerText = (accuracy * 100).toFixed(2) + '%';
    },

    getSMOIterationLog() {
        return this.processLog
            .filter((row) => row.step === 'smo_step')
            .map((row, idx) => ({
                iteration: idx + 1,
                smo_iter: row.detail.iter,
                sub_step: row.detail.sub_step,
                i: row.detail.i,
                j: row.detail.j,
                alpha_i: row.detail.alpha_i,
                alpha_j: row.detail.alpha_j,
                w: Array.isArray(row.detail.w) ? row.detail.w : [0, 0],
                b: row.detail.b,
                accuracy: row.detail.accuracy,
                is_finished: !!row.detail.is_finished,
                timestamp: row.timestamp || ''
            }));
    },

    getSMORecordPayload() {
        const xIdx = parseInt(document.getElementById('x-col')?.value ?? '0');
        const yIdx = parseInt(document.getElementById('y-col')?.value ?? '1');
        const labelIdx = parseInt(document.getElementById('label-col')?.value ?? '2');
        const sampleData = this.dataSnapshotForNote && this.dataSnapshotForNote.length
            ? this.dataSnapshotForNote
            : this.data;
        const iterationData = this.getSMOIterationLog();
        return {
            algorithm_name: 'SMO（序列最小优化）',
            test_function: '线性 SVM 对偶优化问题',
            initial_state: {
                C: this.C,
                tol: this.tol,
                max_iter: this.maxIter,
                speed_interval_ms: this.speed
            },
            dataset_meta: {
                source: this.datasetSource,
                sample_count: sampleData.length,
                headers: this.rawCSVHeader,
                x_col_index: Number.isFinite(xIdx) ? xIdx : null,
                y_col_index: Number.isFinite(yIdx) ? yIdx : null,
                label_col_index: Number.isFinite(labelIdx) ? labelIdx : null,
                x_col_name: this.rawCSVHeader[xIdx] || null,
                y_col_name: this.rawCSVHeader[yIdx] || null,
                label_col_name: this.rawCSVHeader[labelIdx] || null
            },
            final_result: this.smo ? {
                iter: this.smo.iter,
                w: this.smo.w,
                b: this.smo.b,
                accuracy: this.smo.getAccuracy(),
                is_finished: this.smo.isFinished,
                state_text: this.state
            } : null,
            iteration_data: iterationData,
            data_preview: sampleData.slice(0, 200)
        };
    },

    renderIterationLogModal() {
        const tbody = document.getElementById('smo-iteration-log-body');
        const initSpan = document.getElementById('smo-iteration-log-summary-init');
        const datasetSpan = document.getElementById('smo-iteration-log-summary-dataset');
        const countSpan = document.getElementById('smo-iteration-log-summary-count');
        const finalBox = document.getElementById('smo-iteration-log-final-summary');
        const payload = this.getSMORecordPayload();
        const logs = payload.iteration_data || [];

        if (initSpan) initSpan.textContent = JSON.stringify(payload.initial_state || {});
        if (datasetSpan) datasetSpan.textContent = `${payload.dataset_meta.source || 'unknown'} · 样本数 ${payload.dataset_meta.sample_count || 0}`;
        if (countSpan) countSpan.textContent = String(logs.length);

        if (!logs.length) {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="9" style="padding:8px 4px;color:#777;">当前尚无迭代数据，请先播放或单步运行一次 SMO 算法。</td></tr>';
            }
            if (finalBox) {
                finalBox.style.display = 'none';
                finalBox.textContent = '';
            }
            return;
        }

        const final = [...logs].reverse().find((row) => row.is_finished) || logs[logs.length - 1];
        if (finalBox && final) {
            finalBox.style.display = 'block';
            finalBox.textContent = `当前记录显示，算法迭代至第 ${final.smo_iter} 步时，w ≈ [${Number(final.w[0]).toFixed(4)}, ${Number(final.w[1]).toFixed(4)}]，b ≈ ${Number(final.b).toFixed(4)}，准确率 ≈ ${(Number(final.accuracy) * 100).toFixed(2)}%。`;
        }

        if (tbody) {
            tbody.innerHTML = logs.map((row) => {
                const highlight = final && row.iteration === final.iteration;
                const rowStyle = highlight ? 'background-color:#fff8e1;font-weight:600;' : '';
                const status = row.is_finished ? '已结束' : '迭代中';
                return `<tr style="${rowStyle}">
<td>${row.iteration}</td>
<td>${row.smo_iter ?? '-'}</td>
<td>${row.sub_step ?? '-'}</td>
<td>${row.i ?? '-'}, ${row.j ?? '-'}</td>
<td>${row.alpha_i != null ? Number(row.alpha_i).toFixed(5) : '—'}, ${row.alpha_j != null ? Number(row.alpha_j).toFixed(5) : '—'}</td>
<td>[${Number((row.w || [0, 0])[0]).toFixed(4)}, ${Number((row.w || [0, 0])[1]).toFixed(4)}]</td>
<td>${row.b != null ? Number(row.b).toFixed(5) : '—'}</td>
<td>${row.accuracy != null ? (Number(row.accuracy) * 100).toFixed(2) + '%' : '—'}</td>
<td>${status}</td>
</tr>`;
            }).join('');
        }
    },

    exportIterationDataCSV() {
        const payload = this.getSMORecordPayload();
        const logs = payload.iteration_data || [];
        if (!logs.length) {
            alert('当前尚无迭代数据，请先运行一次完整实验。');
            return;
        }
        const esc = (v) => {
            const s = String(v ?? '');
            return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const summary = [
            ['项目', '值'],
            ['原函数/目标', payload.test_function],
            ['算法', payload.algorithm_name],
            ['初始参数', JSON.stringify(payload.initial_state || {})],
            ['数据集', JSON.stringify(payload.dataset_meta || {})],
            []
        ];

        const header = ['iteration', 'smo_iter', 'sub_step', 'i', 'j', 'alpha_i', 'alpha_j', 'w', 'b', 'accuracy', 'is_finished', 'timestamp'];
        const rows = logs.map((row) => [
            row.iteration,
            row.smo_iter,
            row.sub_step,
            row.i,
            row.j,
            row.alpha_i,
            row.alpha_j,
            JSON.stringify(row.w || [0, 0]),
            row.b,
            row.accuracy,
            row.is_finished ? 'true' : 'false',
            row.timestamp || ''
        ]);

        const csv = [...summary, header, ...rows].map((cols) => cols.map(esc).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'svm-smo.iterations.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },

    saveIterationDataToProfile() {
        if (typeof getStoredToken !== 'function' || !getStoredToken()) {
            if (window.LoginModal && typeof window.LoginModal.open === 'function') {
                window.LoginModal.open({ mode: 'login', notice: '请先登录后再保存至个人中心。' });
            } else {
                alert('请先登录后再保存至个人中心。');
            }
            return;
        }
        const payload = this.getSMORecordPayload();
        if (!payload.iteration_data || !payload.iteration_data.length) {
            alert('当前尚无迭代数据，请先运行一次完整实验后再保存。');
            return;
        }

        const defaultAlias = (window.RecordSaveModal && typeof window.RecordSaveModal.makeDefaultAlias === 'function')
            ? window.RecordSaveModal.makeDefaultAlias('SMO')
            : ('SMO-' + new Date().toISOString().slice(0, 16).replace('T', ' '));

        if (window.RecordSaveModal && typeof window.RecordSaveModal.open === 'function') {
            window.RecordSaveModal.open({
                title: '保存至个人中心',
                subtitle: 'SMO 算法实验数据将保存到你的个人中心',
                aliasPrefix: 'SMO',
                defaultAlias,
                onConfirm: function (alias) {
                    return apiPost('/experiments/records', {
                        alias: String(alias).trim(),
                        source_page: 'svm-smo.smo_iteration',
                        payload
                    });
                }
            });
        } else {
            alert('保存弹窗未加载，请刷新页面后重试。');
        }
    },

    initIterationDataActions() {
        const openBtn = document.getElementById('smo-iteration-log-open-btn');
        const exportBtn = document.getElementById('smo-iteration-log-export-csv-btn');
        const saveBtn = document.getElementById('smo-iteration-log-save-to-profile-btn');
        const modal = document.getElementById('smo-iteration-log-modal');
        const closeBtn = document.getElementById('smo-iteration-log-close');

        if (openBtn && modal) {
            openBtn.addEventListener('click', () => {
                this.renderIterationLogModal();
                modal.style.display = 'flex';
            });
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportIterationDataCSV());
        }
        if (saveBtn && typeof apiPost === 'function') {
            saveBtn.addEventListener('click', () => this.saveIterationDataToProfile());
        }
    },

    getExperimentNoteData() {
        const xIdx = parseInt(document.getElementById('x-col')?.value ?? '0');
        const yIdx = parseInt(document.getElementById('y-col')?.value ?? '1');
        const labelIdx = parseInt(document.getElementById('label-col')?.value ?? '2');
        const sampleData = this.dataSnapshotForNote && this.dataSnapshotForNote.length
            ? this.dataSnapshotForNote
            : this.data;
        return {
            experiment_module: 'svm-smo.smo_iteration',
            algorithm: 'SMO (线性 SVM)',
            dataset_source: this.datasetSource,
            dataset_meta: {
                sample_count: sampleData.length,
                headers: this.rawCSVHeader,
                x_col_index: Number.isFinite(xIdx) ? xIdx : null,
                y_col_index: Number.isFinite(yIdx) ? yIdx : null,
                label_col_index: Number.isFinite(labelIdx) ? labelIdx : null,
                x_col_name: this.rawCSVHeader[xIdx] || null,
                y_col_name: this.rawCSVHeader[yIdx] || null,
                label_col_name: this.rawCSVHeader[labelIdx] || null
            },
            hyper_params: {
                C: this.C,
                tol: this.tol,
                max_iter: this.maxIter,
                speed_interval_ms: this.speed
            },
            final_result: this.smo ? {
                iter: this.smo.iter,
                w: this.smo.w,
                b: this.smo.b,
                accuracy: this.smo.getAccuracy(),
                is_finished: this.smo.isFinished,
                state_text: this.state
            } : null,
            process_log: this.processLog,
            uploaded_files: this.uploadedFiles,
            data_preview: sampleData.slice(0, 200),
            iteration_log: this.getSMOIterationLog(),
            record_payload_preview: this.getSMORecordPayload()
        };
    }
};

window.SMOApp = App;
window.onload = () => App.init();
