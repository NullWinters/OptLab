(function () {
    'use strict';

    // ===========================
    // 0. 全局状态
    // ===========================
    var GDS = {
        // 网络结构
        layerSizes: [1, 8, 4, 1],
        hiddenActs: ['tanh', 'tanh'],
        weights: [],
        biases: [],

        // 优化器配置与状态
        optimizer: 'adam',
        optParams: { beta1: 0.9, beta2: 0.999, eps: 1e-8, beta: 0.9 },
        optStates: [],

        // 调度器配置
        scheduler: 'step',
        schedParams: { stepSize: 100, gamma: 0.5, TMax: 200, etaMin: 1e-4 },
        baseLr: 0.01,
        currentLr: 0.01,

        // 损失
        lossFn: 'mse',

        // 训练
        totalEpochs: 1000,
        currentEpoch: 0,
        currentLoss: Infinity,
        minLoss: Infinity,
        lossHistory: [],
        lrHistory: [],

        // 数据
        dataX: [],
        dataY: [],
        currentPreset: 'sin',

        // 控制
        isTraining: false,
        shouldStop: false,
        isPlaying: false,
        playSpeed: 200,

        // 画布变换
        netTransform: d3.zoomIdentity,
        fitTransform: d3.zoomIdentity,

        // 当前视图
        activeView: 'fit'
    };

    // ===========================
    // 1. 工具函数
    // ===========================
    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    // ===========================
    // 2. 激活函数
    // ===========================
    function activationFn(z, type) {
        switch (type) {
            case 'relu': return Math.max(0, z);
            case 'tanh': return Math.tanh(z);
            case 'sigmoid': return 1 / (1 + Math.exp(-z));
            case 'leaky_relu': return z > 0 ? z : 0.01 * z;
            case 'linear': return z;
            default: return z;
        }
    }

    function activationDerivative(a, type) {
        switch (type) {
            case 'relu': return a > 0 ? 1 : 0;
            case 'tanh': return 1 - a * a;
            case 'sigmoid': return a * (1 - a);
            case 'leaky_relu': return a > 0 ? 1 : 0.01;
            case 'linear': return 1;
            default: return 1;
        }
    }

    // ===========================
    // 3. 网络初始化
    // ===========================
    function initWeights() {
        var sizes = GDS.layerSizes;
        GDS.weights = [];
        GDS.biases = [];
        GDS.optStates = [];

        for (var l = 1; l < sizes.length; l++) {
            var prev = sizes[l - 1];
            var curr = sizes[l];
            var scale = Math.sqrt(2.0 / (prev + curr));

            var w = new Array(prev);
            for (var i = 0; i < prev; i++) {
                w[i] = new Array(curr);
                for (var j = 0; j < curr; j++) {
                    w[i][j] = (Math.random() - 0.5) * 2 * scale;
                }
            }
            var b = new Array(curr);
            for (var j = 0; j < curr; j++) {
                b[j] = (Math.random() - 0.5) * 0.1;
            }

            GDS.weights.push(w);
            GDS.biases.push(b);

            // 优化器状态初始化
            var opt = {};
            if (GDS.optimizer === 'momentum') {
                opt.v_w = w.map(function (row) { return row.map(function () { return 0; }); });
                opt.v_b = b.map(function () { return 0; });
            } else if (GDS.optimizer === 'rmsprop') {
                opt.s_w = w.map(function (row) { return row.map(function () { return 0; }); });
                opt.s_b = b.map(function () { return 0; });
            } else if (GDS.optimizer === 'adam') {
                opt.m_w = w.map(function (row) { return row.map(function () { return 0; }); });
                opt.v_w = w.map(function (row) { return row.map(function () { return 0; }); });
                opt.m_b = b.map(function () { return 0; });
                opt.v_b = b.map(function () { return 0; });
                opt.t = 0;
            }
            GDS.optStates.push(opt);
        }
    }

    // ===========================
    // 4. 前向传播
    // ===========================
    function forwardPass(xInput) {
        var sizes = GDS.layerSizes;
        var a = xInput.slice();
        var activations = [a];
        var zs = [];

        for (var l = 0; l < GDS.weights.length; l++) {
            var w = GDS.weights[l];
            var b = GDS.biases[l];
            var isOutput = (l === GDS.weights.length - 1);
            var actType = isOutput ? 'linear' : GDS.hiddenActs[l];
            var prevLen = a.length;
            var currLen = b.length;

            var z = new Array(currLen);
            for (var j = 0; j < currLen; j++) {
                var sum = b[j];
                for (var i = 0; i < prevLen; i++) {
                    sum += w[i][j] * a[i];
                }
                z[j] = sum;
            }
            zs.push(z);

            var aNext = new Array(currLen);
            for (var j = 0; j < currLen; j++) {
                aNext[j] = activationFn(z[j], actType);
            }
            a = aNext;
            activations.push(a);
        }

        return { activations: activations, zs: zs, output: a };
    }

    // ===========================
    // 5. 损失函数
    // ===========================
    function computeLoss(yPred, yTrue) {
        if (GDS.lossFn === 'mse') {
            var sum = 0;
            for (var i = 0; i < yPred.length; i++) {
                var d = yPred[i] - yTrue[i];
                sum += d * d;
            }
            return sum / yPred.length;
        } else {
            var sum = 0;
            for (var i = 0; i < yPred.length; i++) {
                sum += Math.abs(yPred[i] - yTrue[i]);
            }
            return sum / yPred.length;
        }
    }

    function lossDerivative(yPred, yTrue) {
        var n = yPred.length;
        if (GDS.lossFn === 'mse') {
            var d = new Array(n);
            for (var i = 0; i < n; i++) {
                d[i] = 2 * (yPred[i] - yTrue[i]) / n;
            }
            return d;
        } else {
            var d = new Array(n);
            for (var i = 0; i < n; i++) {
                d[i] = (yPred[i] > yTrue[i] ? 1 : yPred[i] < yTrue[i] ? -1 : 0) / n;
            }
            return d;
        }
    }

    // ===========================
    // 6. 反向传播
    // ===========================
    function backwardPass(xInput, yTrue) {
        var fwd = forwardPass(xInput);
        var activations = fwd.activations;
        var zs = fwd.zs;
        var yPred = fwd.output;

        var loss = computeLoss(yPred, yTrue);
        var delta = lossDerivative(yPred, yTrue);

        var gradW = new Array(GDS.weights.length);
        var gradB = new Array(GDS.weights.length);

        for (var l = GDS.weights.length - 1; l >= 0; l--) {
            var isOutput = (l === GDS.weights.length - 1);
            var actType = isOutput ? 'linear' : GDS.hiddenActs[l];
            var aPrev = activations[l];
            var z = zs[l];
            var currLen = delta.length;
            var prevLen = aPrev.length;

            // 激活函数导数
            for (var j = 0; j < currLen; j++) {
                var aVal = activationFn(z[j], actType);
                delta[j] *= activationDerivative(aVal, actType);
            }

            // 梯度
            var gW = new Array(prevLen);
            for (var i = 0; i < prevLen; i++) {
                gW[i] = new Array(currLen);
                for (var j = 0; j < currLen; j++) {
                    gW[i][j] = delta[j] * aPrev[i];
                }
            }
            var gB = delta.slice();
            gradW[l] = gW;
            gradB[l] = gB;

            // 传递到上一层
            if (l > 0) {
                var w = GDS.weights[l];
                var nextDelta = new Array(prevLen);
                for (var i = 0; i < prevLen; i++) {
                    var s = 0;
                    for (var j = 0; j < currLen; j++) {
                        s += w[i][j] * delta[j];
                    }
                    nextDelta[i] = s;
                }
                delta = nextDelta;
            }
        }

        return { loss: loss, gradW: gradW, gradB: gradB };
    }

    // ===========================
    // 7. 梯度裁剪
    // ===========================
    function clipGradients(gradW, gradB) {
        var clipNorm = 5.0;
        var totalNorm = 0;
        for (var l = 0; l < gradW.length; l++) {
            var gw = gradW[l];
            for (var i = 0; i < gw.length; i++) {
                for (var j = 0; j < gw[i].length; j++) {
                    totalNorm += gw[i][j] * gw[i][j];
                }
            }
            for (var j = 0; j < gradB[l].length; j++) {
                totalNorm += gradB[l][j] * gradB[l][j];
            }
        }
        totalNorm = Math.sqrt(totalNorm);
        if (totalNorm <= clipNorm) return;

        var scale = clipNorm / totalNorm;
        for (var l = 0; l < gradW.length; l++) {
            for (var i = 0; i < gradW[l].length; i++) {
                for (var j = 0; j < gradW[l][i].length; j++) {
                    gradW[l][i][j] *= scale;
                }
            }
            for (var j = 0; j < gradB[l].length; j++) {
                gradB[l][j] *= scale;
            }
        }
    }

    // ===========================
    // 8. 优化器更新
    // ===========================
    function optimizerUpdate(gradW, gradB, lr) {
        clipGradients(gradW, gradB);

        if (GDS.optimizer === 'momentum') {
            applyMomentum(gradW, gradB, lr);
        } else if (GDS.optimizer === 'rmsprop') {
            applyRMSprop(gradW, gradB, lr);
        } else if (GDS.optimizer === 'adam') {
            applyAdam(gradW, gradB, lr);
        }
    }

    function applyMomentum(gradW, gradB, lr) {
        var beta = GDS.optParams.beta;
        for (var l = 0; l < GDS.weights.length; l++) {
            var st = GDS.optStates[l];
            var w = GDS.weights[l];
            var b = GDS.biases[l];
            var gw = gradW[l];
            var gb = gradB[l];

            for (var i = 0; i < w.length; i++) {
                for (var j = 0; j < w[i].length; j++) {
                    st.v_w[i][j] = beta * st.v_w[i][j] + gw[i][j];
                    w[i][j] -= lr * st.v_w[i][j];
                }
            }
            for (var j = 0; j < b.length; j++) {
                st.v_b[j] = beta * st.v_b[j] + gb[j];
                b[j] -= lr * st.v_b[j];
            }
        }
    }

    function applyRMSprop(gradW, gradB, lr) {
        var beta = GDS.optParams.beta;
        var eps = GDS.optParams.eps;
        for (var l = 0; l < GDS.weights.length; l++) {
            var st = GDS.optStates[l];
            var w = GDS.weights[l];
            var b = GDS.biases[l];
            var gw = gradW[l];
            var gb = gradB[l];

            for (var i = 0; i < w.length; i++) {
                for (var j = 0; j < w[i].length; j++) {
                    st.s_w[i][j] = beta * st.s_w[i][j] + (1 - beta) * gw[i][j] * gw[i][j];
                    w[i][j] -= lr * gw[i][j] / (Math.sqrt(st.s_w[i][j]) + eps);
                }
            }
            for (var j = 0; j < b.length; j++) {
                st.s_b[j] = beta * st.s_b[j] + (1 - beta) * gb[j] * gb[j];
                b[j] -= lr * gb[j] / (Math.sqrt(st.s_b[j]) + eps);
            }
        }
    }

    function applyAdam(gradW, gradB, lr) {
        var beta1 = GDS.optParams.beta1;
        var beta2 = GDS.optParams.beta2;
        var eps = GDS.optParams.eps;
        for (var l = 0; l < GDS.weights.length; l++) {
            var st = GDS.optStates[l];
            st.t += 1;
            var t = st.t;
            var w = GDS.weights[l];
            var b = GDS.biases[l];
            var gw = gradW[l];
            var gb = gradB[l];

            var alpha = lr * Math.sqrt(1 - Math.pow(beta2, t)) / (1 - Math.pow(beta1, t));

            for (var i = 0; i < w.length; i++) {
                for (var j = 0; j < w[i].length; j++) {
                    st.m_w[i][j] = beta1 * st.m_w[i][j] + (1 - beta1) * gw[i][j];
                    st.v_w[i][j] = beta2 * st.v_w[i][j] + (1 - beta2) * gw[i][j] * gw[i][j];
                    w[i][j] -= alpha * st.m_w[i][j] / (Math.sqrt(st.v_w[i][j]) + eps);
                }
            }
            var alpha_b = lr * Math.sqrt(1 - Math.pow(beta2, t)) / (1 - Math.pow(beta1, t));
            for (var j = 0; j < b.length; j++) {
                st.m_b[j] = beta1 * st.m_b[j] + (1 - beta1) * gb[j];
                st.v_b[j] = beta2 * st.v_b[j] + (1 - beta2) * gb[j] * gb[j];
                b[j] -= alpha_b * st.m_b[j] / (Math.sqrt(st.v_b[j]) + eps);
            }
        }
    }

    // ===========================
    // 9. 学习率调度器
    // ===========================
    function schedulerGetLR(epoch) {
        if (GDS.scheduler === 'step') {
            var stepSize = GDS.schedParams.stepSize;
            var gamma = GDS.schedParams.gamma;
            return GDS.baseLr * Math.pow(gamma, Math.floor(epoch / stepSize));
        } else if (GDS.scheduler === 'exponential') {
            var gamma = GDS.schedParams.gamma;
            return GDS.baseLr * Math.pow(gamma, epoch);
        } else if (GDS.scheduler === 'cosine') {
            var TMax = GDS.schedParams.TMax;
            var etaMin = GDS.schedParams.etaMin;
            var t = epoch % TMax;
            return etaMin + 0.5 * (GDS.baseLr - etaMin) * (1 + Math.cos(Math.PI * t / TMax));
        }
        return GDS.baseLr;
    }

    // ===========================
    // 10. 数据集
    // ===========================
    function generateData(preset, n) {
        n = n || 150;
        var xs = new Array(n);
        var ys = new Array(n);
        for (var i = 0; i < n; i++) {
            var x = (Math.random() - 0.5) * 8;
            var y;
            switch (preset) {
                case 'sin': y = Math.sin(x); break;
                case 'quad': y = 0.25 * x * x; break;
                case 'abs': y = Math.abs(x) * 0.5; break;
                case 'xsine': y = x * Math.sin(x) * 0.3; break;
                case 'sigmoid': y = 2 / (1 + Math.exp(-x)); break;
                default: y = Math.sin(x); break;
            }
            y += (Math.random() - 0.5) * 0.4;
            xs[i] = x;
            ys[i] = y;
        }
        GDS.dataX = xs;
        GDS.dataY = ys;
        GDS.currentPreset = preset;
    }

    // ===========================
    // 11. UI - 隐藏层列表
    // ===========================
    function getActivationOptions(selected) {
        var opts = ['sigmoid', 'tanh', 'relu', 'leaky_relu'];
        var labels = { sigmoid: 'Sigmoid', tanh: 'Tanh', relu: 'ReLU', leaky_relu: 'Leaky ReLU' };
        var html = '';
        for (var i = 0; i < opts.length; i++) {
            var sel = opts[i] === selected ? ' selected' : '';
            html += '<option value="' + opts[i] + '"' + sel + '>' + labels[opts[i]] + '</option>';
        }
        return html;
    }

    function renderLayerList() {
        var container = document.getElementById('layer-list');
        var sizes = GDS.layerSizes;
        var html = '';

        // 输入层 (固定)
        html += '<div class="gd-layer-row">';
        html += '<span class="gd-layer-label">输入层</span>';
        html += '<span style="font-size:13px;color:#8d6e63;flex:1;">1 个神经元</span>';
        html += '</div>';

        // 隐藏层
        for (var i = 0; i < sizes.length - 2; i++) {
            var n = sizes[i + 1];
            var act = GDS.hiddenActs[i];
            html += '<div class="gd-layer-row" data-layer-idx="' + i + '">';
            html += '<span class="gd-layer-label">隐藏层 ' + (i + 1) + '</span>';
            html += '<input type="number" class="layer-size-input" value="' + n + '" min="1" max="64" step="1">';
            html += '<select class="layer-act-select">' + getActivationOptions(act) + '</select>';
            html += '<button class="gd-btn-sm layer-remove-btn" title="删除此层">&#x2716;</button>';
            html += '</div>';
        }

        // 输出层 (固定)
        html += '<div class="gd-layer-row">';
        html += '<span class="gd-layer-label">输出层</span>';
        html += '<span style="font-size:13px;color:#8d6e63;flex:1;">1 个神经元 (Linear)</span>';
        html += '</div>';

        container.innerHTML = html;

        // 绑定事件
        var sizeInputs = container.querySelectorAll('.layer-size-input');
        for (var i = 0; i < sizeInputs.length; i++) {
            sizeInputs[i].addEventListener('change', function () {
                updateLayerSizes();
                applyReset();
            });
        }
        var actSelects = container.querySelectorAll('.layer-act-select');
        for (var k = 0; k < actSelects.length; k++) {
            actSelects[k].addEventListener('change', function () {
                updateHiddenActs();
                applyReset();
            });
        }
        var removeBtns = container.querySelectorAll('.layer-remove-btn');
        for (var r = 0; r < removeBtns.length; r++) {
            removeBtns[r].addEventListener('click', function () {
                var row = this.parentElement;
                var idx = parseInt(row.getAttribute('data-layer-idx'));
                if (GDS.layerSizes.length > 3) {
                    GDS.layerSizes.splice(idx + 1, 1);
                    GDS.hiddenActs.splice(idx, 1);
                    renderLayerList();
                    collectLayerConfig();
                    applyReset();
                }
            });
        }
    }

    function updateLayerSizes() {
        var inputs = document.querySelectorAll('.layer-size-input');
        for (var i = 0; i < inputs.length; i++) {
            var v = parseInt(inputs[i].value) || 4;
            v = clamp(v, 1, 64);
            GDS.layerSizes[i + 1] = v;
        }
    }

    function updateHiddenActs() {
        var selects = document.querySelectorAll('.layer-act-select');
        for (var i = 0; i < selects.length; i++) {
            GDS.hiddenActs[i] = selects[i].value;
        }
    }

    function collectLayerConfig() {
        updateLayerSizes();
        updateHiddenActs();
    }

    function addHiddenLayer() {
        if (GDS.layerSizes.length >= 10) return;
        GDS.layerSizes.splice(GDS.layerSizes.length - 1, 0, 4);
        GDS.hiddenActs.push('tanh');
        renderLayerList();
        collectLayerConfig();
    }

    // ===========================
    // 12. UI - 优化器/调度器动态参数
    // ===========================
    function renderOptimizerParams() {
        var container = document.getElementById('optimizer-params');
        var opt = GDS.optimizer;
        var html = '';
        if (opt === 'momentum') {
            html += paramSliderHTML('momentum-beta', '\u03B2', 0.5, 0.999, 0.01, GDS.optParams.beta);
        } else if (opt === 'rmsprop') {
            html += paramSliderHTML('rmsprop-beta', '\u03B2', 0.5, 0.999, 0.01, GDS.optParams.beta);
            html += paramNumberHTML('rmsprop-eps', '\u03B5', GDS.optParams.eps || 1e-8, 1e-12, 1e-2, '1e-8');
        } else if (opt === 'adam') {
            html += paramSliderHTML('adam-beta1', '\u03B2\u2081', 0.5, 0.999, 0.01, GDS.optParams.beta1);
            html += paramSliderHTML('adam-beta2', '\u03B2\u2082', 0.9, 0.9999, 0.001, GDS.optParams.beta2);
            html += paramNumberHTML('adam-eps', '\u03B5', GDS.optParams.eps || 1e-8, 1e-12, 1e-2, '1e-8');
        }
        container.innerHTML = html;
        bindParamEvents(container, 'opt');
    }

    function renderSchedulerParams() {
        var container = document.getElementById('scheduler-params');
        var sched = GDS.scheduler;
        var html = '';
        if (sched === 'step') {
            html += paramNumberHTML('sched-step', 'step_size', GDS.schedParams.stepSize, 1, 10000, 1);
            html += paramSliderHTML('sched-gamma-step', '\u03B3', 0.1, 0.99, 0.01, GDS.schedParams.gamma);
        } else if (sched === 'exponential') {
            html += paramSliderHTML('sched-gamma-exp', '\u03B3', 0.9, 0.999, 0.001, GDS.schedParams.gamma);
        } else if (sched === 'cosine') {
            html += paramNumberHTML('sched-tmax', 'T_max', GDS.schedParams.TMax, 10, 10000, 10);
            html += paramNumberHTML('sched-etamin', '\u03B7_min', GDS.schedParams.etaMin, 1e-6, 1e-1, '0.0001');
        }
        container.innerHTML = html;
        bindParamEvents(container, 'sched');
    }

    function paramSliderHTML(id, label, min, max, step, val) {
        return '<div class="gd-param-row">' +
            '<label>' + label + '</label>' +
            '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
            '<span class="gd-param-value" id="' + id + '-val">' + val.toFixed(typeof step === 'number' && step < 0.01 ? 3 : 2) + '</span>' +
            '</div>';
    }

    function paramNumberHTML(id, label, val, minVal, maxVal, step) {
        return '<div class="gd-param-row">' +
            '<label>' + label + '</label>' +
            '<input type="number" id="' + id + '" value="' + val + '" min="' + minVal + '" max="' + maxVal + '" step="' + step + '">' +
            '</div>';
    }

    function bindParamEvents(container, category) {
        var sliders = container.querySelectorAll('input[type="range"]');
        for (var i = 0; i < sliders.length; i++) {
            (function (slider) {
                var valSpan = document.getElementById(slider.id + '-val');
                slider.addEventListener('input', function () {
                    if (valSpan) valSpan.textContent = parseFloat(slider.value).toFixed(slider.step < 0.01 ? 3 : 2);
                    collectParams(category);
                });
            })(sliders[i]);
        }
        var nums = container.querySelectorAll('input[type="number"]');
        for (var j = 0; j < nums.length; j++) {
            nums[j].addEventListener('change', function () { collectParams(category); });
        }
    }

    function collectParams(category) {
        if (category === 'opt') {
            if (GDS.optimizer === 'momentum') {
                GDS.optParams.beta = parseFloat(document.getElementById('momentum-beta').value) || 0.9;
            } else if (GDS.optimizer === 'rmsprop') {
                GDS.optParams.beta = parseFloat(document.getElementById('rmsprop-beta').value) || 0.99;
                GDS.optParams.eps = parseFloat(document.getElementById('rmsprop-eps').value) || 1e-8;
            } else if (GDS.optimizer === 'adam') {
                GDS.optParams.beta1 = parseFloat(document.getElementById('adam-beta1').value) || 0.9;
                GDS.optParams.beta2 = parseFloat(document.getElementById('adam-beta2').value) || 0.999;
                GDS.optParams.eps = parseFloat(document.getElementById('adam-eps').value) || 1e-8;
            }
        } else if (category === 'sched') {
            if (GDS.scheduler === 'step') {
                GDS.schedParams.stepSize = parseInt(document.getElementById('sched-step').value) || 100;
                GDS.schedParams.gamma = parseFloat(document.getElementById('sched-gamma-step').value) || 0.5;
            } else if (GDS.scheduler === 'exponential') {
                GDS.schedParams.gamma = parseFloat(document.getElementById('sched-gamma-exp').value) || 0.99;
            } else if (GDS.scheduler === 'cosine') {
                GDS.schedParams.TMax = parseInt(document.getElementById('sched-tmax').value) || 200;
                GDS.schedParams.etaMin = parseFloat(document.getElementById('sched-etamin').value) || 1e-4;
            }
        }
    }

    // ===========================
    // 13. UI - 预设数据集 / CSV
    // ===========================
    function bindPresetButtons() {
        var btns = document.querySelectorAll('.gd-preset-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].addEventListener('click', function () {
                if (GDS.isTraining) return;
                var preset = this.getAttribute('data-preset');
                // 移除所有 active
                var all = document.querySelectorAll('.gd-preset-btn');
                for (var j = 0; j < all.length; j++) all[j].classList.remove('active');
                this.classList.add('active');
                GDS.currentPreset = preset;
                generateData(preset);
                document.getElementById('column-select').style.display = 'none';
                document.getElementById('upload-text').textContent = '\uD83D\uDCC1 点击上传 CSV 文件 (或拖拽至此)';
                applyReset();
            });
        }
    }

    function bindUpload() {
        var area = document.getElementById('upload-area');
        var input = document.getElementById('file-input');

        area.addEventListener('click', function () { input.click(); });
        area.addEventListener('dragover', function (e) { e.preventDefault(); area.style.borderColor = 'var(--nn-primary)'; });
        area.addEventListener('dragleave', function () { area.style.borderColor = ''; });
        area.addEventListener('drop', function (e) {
            e.preventDefault();
            area.style.borderColor = '';
            var file = e.dataTransfer.files[0];
            if (file) processCSV(file);
        });
        input.addEventListener('change', function () {
            var file = this.files[0];
            if (file) processCSV(file);
            this.value = '';
        });
    }

    var csvColumns = [];
    var csvRows = [];

    function processCSV(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var text = e.target.result;
            var lines = text.split('\n').filter(function (l) { return l.trim(); });
            if (lines.length < 2) {
                alert('CSV 文件格式无效（需要至少 2 行）');
                return;
            }
            // 解析列名
            csvColumns = lines[0].split(',').map(function (s) { return s.trim(); });
            // 解析数据行
            csvRows = [];
            for (var i = 1; i < lines.length; i++) {
                var parts = lines[i].split(',').map(function (s) { return parseFloat(s.trim()); });
                if (parts.every(function (v) { return !isNaN(v); })) {
                    csvRows.push(parts);
                }
            }
            if (csvRows.length < 2) {
                alert('CSV 数据量不足（需要至少 2 个有效数据行）');
                return;
            }
            // 弹出列选择
            var colSel = document.getElementById('column-select');
            var xSel = document.getElementById('x-col-select');
            var ySel = document.getElementById('y-col-select');

            xSel.innerHTML = '<option value="">选择 X 列</option>';
            ySel.innerHTML = '<option value="">选择 Y 列</option>';
            for (var k = 0; k < csvColumns.length; k++) {
                xSel.innerHTML += '<option value="' + k + '">' + csvColumns[k] + '</option>';
                ySel.innerHTML += '<option value="' + k + '">' + csvColumns[k] + '</option>';
            }
            // 默认选第 0 列为 x，第 1 列为 y
            if (csvColumns.length >= 2) {
                xSel.value = '0';
                ySel.value = '1';
            }
            colSel.style.display = 'flex';
            document.getElementById('upload-text').textContent = '\u2705 ' + file.name + ' (' + csvRows.length + ' 行)';

            // 自动应用
            applyCSVData();
        };
        reader.readAsText(file);
    }

    function applyCSVData() {
        var xIdx = parseInt(document.getElementById('x-col-select').value);
        var yIdx = parseInt(document.getElementById('y-col-select').value);
        if (isNaN(xIdx) || isNaN(yIdx)) return;
        if (xIdx === yIdx) { alert('X 列和 Y 列不能相同'); return; }

        var xs = new Array(csvRows.length);
        var ys = new Array(csvRows.length);
        for (var i = 0; i < csvRows.length; i++) {
            xs[i] = csvRows[i][xIdx];
            ys[i] = csvRows[i][yIdx];
        }
        GDS.dataX = xs;
        GDS.dataY = ys;
        GDS.currentPreset = null;

        // 移除 preset active
        var all = document.querySelectorAll('.gd-preset-btn');
        for (var j = 0; j < all.length; j++) all[j].classList.remove('active');

        applyReset();
    }

    // ===========================
    // 14. D3 - 网络结构可视化
    // ===========================
    var netSvg, netG;

    function initNetworkCanvas() {
        var container = document.getElementById('network-canvas');
        netSvg = d3.select(container).append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .style('display', 'block');

        netG = netSvg.append('g');

        var zoom = d3.zoom()
            .scaleExtent([0.3, 5])
            .on('zoom', function (event) {
                GDS.netTransform = event.transform;
                netG.attr('transform', event.transform);
            });

        netSvg.call(zoom);
        netSvg.on('dblclick.zoom', null);

        document.getElementById('network-reset-btn').addEventListener('click', function () {
            netSvg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
        });
    }

    function getNetNodePositions() {
        var container = document.getElementById('network-canvas');
        var width = container.clientWidth || 600;
        var height = container.clientHeight || 420;
        var pad = { top: 30, bottom: 40, left: 50, right: 50 };
        var layers = GDS.layerSizes.length;
        var layerSpacing = (width - pad.left - pad.right) / (layers - 1 || 1);
        var positions = [];

        for (var l = 0; l < layers; l++) {
            var count = GDS.layerSizes[l];
            var nodeSpacing = Math.min((height - pad.top - pad.bottom) / Math.max(count, 1), 50);
            var yStart = (height - (count - 1) * Math.min(nodeSpacing, 40)) / 2;
            var x = pad.left + l * layerSpacing;
            var nodes = [];
            for (var i = 0; i < count; i++) {
                nodes.push({ x: x, y: yStart + i * Math.min(nodeSpacing, 40), idx: i, layer: l });
            }
            positions.push(nodes);
        }
        return positions;
    }

    function drawNetwork() {
        if (!netG) return;
        var container = document.getElementById('network-canvas');
        var width = container.clientWidth || 600;
        var height = container.clientHeight || 420;

        netG.selectAll('*').remove();

        if (GDS.weights.length === 0) return;

        var nodePositions = getNetNodePositions();

        // 收集边数据
        var edgeData = [];
        var maxAbs = 0.001;
        for (var l = 0; l < GDS.weights.length; l++) {
            var prevNodes = nodePositions[l];
            var currNodes = nodePositions[l + 1];
            var w = GDS.weights[l];
            for (var i = 0; i < w.length; i++) {
                for (var j = 0; j < w[i].length; j++) {
                    var aw = Math.abs(w[i][j]);
                    if (aw > maxAbs) maxAbs = aw;
                    edgeData.push({
                        source: prevNodes[i], target: currNodes[j],
                        weight: w[i][j], absWeight: aw,
                        layer: l, srcIdx: i, tgtIdx: j
                    });
                }
            }
        }

        // 绘制连线
        var tooltip = d3.select('#gd-tooltip');
        netG.selectAll('line.edge')
            .data(edgeData)
            .enter().append('line')
            .attr('class', 'edge')
            .attr('x1', function (d) { return d.source.x; })
            .attr('y1', function (d) { return d.source.y; })
            .attr('x2', function (d) { return d.target.x; })
            .attr('y2', function (d) { return d.target.y; })
            .attr('stroke', function (d) { return d.weight > 0 ? '#d32f2f' : '#1565c0'; })
            .attr('stroke-width', function (d) {
                var n = maxAbs > 0 ? d.absWeight / maxAbs : 0;
                return 0.5 + n * 7;
            })
            .attr('stroke-opacity', function (d) {
                var n = maxAbs > 0 ? d.absWeight / maxAbs : 0;
                return 0.15 + n * 0.75;
            })
            .attr('stroke-linecap', 'round')
            .on('mouseover', function (event, d) {
                var el = d3.select(this);
                el.attr('data-saved-width', el.attr('stroke-width'))
                  .attr('data-saved-opacity', el.attr('stroke-opacity'));
                el.transition().duration(120)
                    .attr('stroke-width', 6)
                    .attr('stroke-opacity', 1);
                tooltip.style('display', 'block')
                    .html('<strong>\u6743\u91CD:</strong> ' + d.weight.toFixed(5) +
                        '<br><strong>\u5C42:</strong> ' + (d.layer + 1) + ' \u2192 ' + (d.layer + 2) +
                        '<br><strong>\u795E\u7ECF\u5143:</strong> ' + (d.srcIdx + 1) + ' \u2192 ' + (d.tgtIdx + 1));
            })
            .on('mousemove', function (event) {
                tooltip.style('left', (event.pageX + 12) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function () {
                var el = d3.select(this);
                el.transition().duration(150)
                    .attr('stroke-width', el.attr('data-saved-width') || 0.5)
                    .attr('stroke-opacity', el.attr('data-saved-opacity') || 0.15);
                tooltip.style('display', 'none');
            });

        // 绘制节点
        nodePositions.forEach(function (layerNodes, l) {
            var isInput = l === 0;
            var isOutput = l === GDS.layerSizes.length - 1;
            var r = isInput || isOutput ? 20 : 16;
            var color = isInput ? '#2e7d32' : isOutput ? '#e65100' : '#1565c0';

            layerNodes.forEach(function (node) {
                netG.append('circle')
                    .attr('cx', node.x).attr('cy', node.y).attr('r', r)
                    .attr('fill', color).attr('stroke', '#fff').attr('stroke-width', 2.5)
                    .attr('cursor', 'default');

                // 层标签
                if (node.idx === 0) {
                    var label = isInput ? '\u8F93\u5165' : isOutput ? '\u8F93\u51FA' : '\u5C42 ' + l;
                    netG.append('text')
                        .attr('x', node.x).attr('y', node.y + r + 18)
                        .attr('text-anchor', 'middle').attr('font-size', '11px')
                        .attr('fill', '#6d4c41').attr('font-weight', '600')
                        .text(label);
                }
            });
        });

        // 图例
        netG.append('text')
            .attr('x', width - 20).attr('y', 18)
            .attr('text-anchor', 'end').attr('font-size', '10px')
            .attr('fill', '#8d6e63')
            .text('\u7EA2: \u6B63\u6743\u91CD  \u84DD: \u8D1F\u6743\u91CD');
    }

    // 快速更新连线（不重绘节点）
    function updateNetworkEdges() {
        if (!netG) return;
        if (GDS.weights.length === 0) { drawNetwork(); return; }

        var nodePositions = getNetNodePositions();
        var edgeData = [];
        var maxAbs = 0.001;
        for (var l = 0; l < GDS.weights.length; l++) {
            var prevNodes = nodePositions[l];
            var currNodes = nodePositions[l + 1];
            var w = GDS.weights[l];
            for (var i = 0; i < w.length; i++) {
                for (var j = 0; j < w[i].length; j++) {
                    var aw = Math.abs(w[i][j]);
                    if (aw > maxAbs) maxAbs = aw;
                    edgeData.push({
                        source: prevNodes[i], target: currNodes[j],
                        weight: w[i][j], absWeight: aw,
                        layer: l, srcIdx: i, tgtIdx: j
                    });
                }
            }
        }

        var lines = netG.selectAll('line.edge').data(edgeData);

        var merged = lines.enter().append('line')
            .attr('class', 'edge')
            .attr('stroke-linecap', 'round')
            .merge(lines);

        merged.transition().duration(60)
            .attr('x1', function (d) { return d.source.x; })
            .attr('y1', function (d) { return d.source.y; })
            .attr('x2', function (d) { return d.target.x; })
            .attr('y2', function (d) { return d.target.y; })
            .attr('stroke', function (d) { return d.weight > 0 ? '#d32f2f' : '#1565c0'; })
            .attr('stroke-width', function (d) {
                var n = maxAbs > 0 ? d.absWeight / maxAbs : 0;
                return 0.5 + n * 7;
            })
            .attr('stroke-opacity', function (d) {
                var n = maxAbs > 0 ? d.absWeight / maxAbs : 0;
                return 0.15 + n * 0.75;
            });

        var ttip = d3.select('#gd-tooltip');
        merged
            .on('mouseover', function (event, d) {
                var el = d3.select(this);
                el.attr('data-saved-width', el.attr('stroke-width'))
                  .attr('data-saved-opacity', el.attr('stroke-opacity'));
                el.transition().duration(120)
                    .attr('stroke-width', 6)
                    .attr('stroke-opacity', 1);
                ttip.style('display', 'block')
                    .html('<strong>\u6743\u91CD:</strong> ' + d.weight.toFixed(5) +
                        '<br><strong>\u5C42:</strong> ' + (d.layer + 1) + ' \u2192 ' + (d.layer + 2) +
                        '<br><strong>\u795E\u7ECF\u5143:</strong> ' + (d.srcIdx + 1) + ' \u2192 ' + (d.tgtIdx + 1));
            })
            .on('mousemove', function (event) {
                ttip.style('left', (event.pageX + 12) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function () {
                var el = d3.select(this);
                el.transition().duration(150)
                    .attr('stroke-width', el.attr('data-saved-width') || 0.5)
                    .attr('stroke-opacity', el.attr('data-saved-opacity') || 0.15);
                ttip.style('display', 'none');
            });

        lines.exit().remove();
    }

    // ===========================
    // 15. D3 - 拟合情况可视化
    // ===========================
    var fitSvg, fitG, fitZoom;
    var fitMargin = { top: 25, right: 25, bottom: 40, left: 55 };

    function initFitCanvas() {
        var container = document.getElementById('fit-canvas');
        fitSvg = d3.select(container).append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .style('display', 'block');

        fitG = fitSvg.append('g');

        fitZoom = d3.zoom()
            .scaleExtent([0.5, 10])
            .on('zoom', function (event) {
                GDS.fitTransform = event.transform;
                fitG.attr('transform', event.transform);
            });

        fitSvg.call(fitZoom);
        fitSvg.on('dblclick.zoom', null);

        document.getElementById('fit-reset-btn').addEventListener('click', function () {
            fitSvg.transition().duration(400).call(fitZoom.transform, d3.zoomIdentity);
        });
    }

    function drawFitView() {
        if (!fitG) return;
        var container = document.getElementById('fit-canvas');
        var width = container.clientWidth || 600;
        var height = container.clientHeight || 380;
        var innerW = width - fitMargin.left - fitMargin.right;
        var innerH = height - fitMargin.top - fitMargin.bottom;

        fitG.selectAll('*').remove();

        var g = fitG.append('g').attr('transform', 'translate(' + fitMargin.left + ',' + fitMargin.top + ')');

        if (GDS.dataX.length === 0) return;
        if (GDS.weights.length === 0) return;

        // 计算拟合曲线采样
        var xMin = Math.min.apply(null, GDS.dataX);
        var xMax = Math.max.apply(null, GDS.dataX);
        var xPad = (xMax - xMin) * 0.05 || 0.5;
        var nSample = 200;
        var xSample = new Array(nSample + 1);
        var yPred = new Array(nSample + 1);
        var xRange = xMax + xPad - (xMin - xPad);
        for (var i = 0; i <= nSample; i++) {
            xSample[i] = xMin - xPad + xRange * (i / nSample);
            var fwd = forwardPass([xSample[i]]);
            yPred[i] = fwd.output[0];
        }

        var yAll = GDS.dataY.slice();
        for (var k = 0; k < yPred.length; k++) {
            if (isFinite(yPred[k])) yAll.push(yPred[k]);
        }
        var yCurveMin = Math.min.apply(null, yAll);
        var yCurveMax = Math.max.apply(null, yAll);
        var yRange = yCurveMax - yCurveMin || 1;
        var yPad = yRange * 0.15;

        var xScale = d3.scaleLinear().domain([xMin - xPad, xMax + xPad]).range([0, innerW]);
        var yScale = d3.scaleLinear().domain([yCurveMin - yPad, yCurveMax + yPad]).range([innerH, 0]);

        var xAxis = d3.axisBottom(xScale).ticks(8);
        var yAxis = d3.axisLeft(yScale).ticks(8);
        g.append('g').attr('transform', 'translate(0,' + innerH + ')').call(xAxis);
        g.append('g').call(yAxis);

        // 网格
        g.append('g').attr('class', 'grid')
            .call(d3.axisLeft(yScale).ticks(8).tickSize(-innerW).tickFormat(''))
            .style('stroke', '#e8e0d8').style('stroke-dasharray', '3,3');

        // 迭代计数
        g.append('text')
            .attr('class', 'epoch-counter')
            .attr('x', 6)
            .attr('y', 16)
            .attr('font-size', '13px')
            .attr('font-weight', '700')
            .attr('fill', '#D84315')
            .text('Epoch: ' + GDS.currentEpoch);

        // 数据散点
        var tooltip = d3.select('#gd-tooltip');
        g.selectAll('circle.data-dot')
            .data(GDS.dataX.map(function (x, i) { return { x: x, y: GDS.dataY[i] }; }))
            .enter().append('circle')
            .attr('class', 'data-dot')
            .attr('cx', function (d) { return xScale(d.x); })
            .attr('cy', function (d) { return yScale(d.y); })
            .attr('r', 4.5)
            .attr('fill', '#4E342E')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.75)
            .on('mouseover', function (event, d) {
                tooltip.style('display', 'block')
                    .html('<strong>x:</strong> ' + d.x.toFixed(4) + '<br><strong>y:</strong> ' + d.y.toFixed(4));
            })
            .on('mousemove', function (event) {
                tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function () { tooltip.style('display', 'none'); });

        // 拟合曲线
        var lineData = xSample.map(function (x, i) { return { x: x, y: yPred[i] }; });
        var line = d3.line()
            .x(function (d) { return xScale(d.x); })
            .y(function (d) { return yScale(d.y); })
            .curve(d3.curveMonotoneX);

        g.append('path').datum(lineData)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', '#d32f2f')
            .attr('stroke-width', 2.5)
            .attr('stroke-dasharray', '6,4');

        // 图例
        g.append('circle').attr('cx', innerW - 80).attr('cy', 14).attr('r', 4).attr('fill', '#4E342E');
        g.append('text').attr('x', innerW - 72).attr('y', 18).attr('font-size', '11px').attr('fill', '#6d4c41').text('\u6570\u636E\u70B9');
        g.append('line').attr('x1', innerW - 80).attr('y1', 34).attr('x2', innerW - 58).attr('y2', 34)
            .attr('stroke', '#d32f2f').attr('stroke-width', 2).attr('stroke-dasharray', '6,4');
        g.append('text').attr('x', innerW - 54).attr('y', 38).attr('font-size', '11px').attr('fill', '#6d4c41').text('\u62DF\u5408\u66F2\u7EBF');
    }

    function drawLossView() {
        if (!fitG) return;
        var container = document.getElementById('fit-canvas');
        var width = container.clientWidth || 600;
        var height = container.clientHeight || 380;
        var innerW = width - fitMargin.left - fitMargin.right;
        var innerH = height - fitMargin.top - fitMargin.bottom;

        fitG.selectAll('*').remove();
        var g = fitG.append('g').attr('transform', 'translate(' + fitMargin.left + ',' + fitMargin.top + ')');

        var history = GDS.lossHistory;
        if (history.length === 0) {
            g.append('text').attr('x', innerW / 2).attr('y', innerH / 2)
                .attr('text-anchor', 'middle').attr('font-size', '14px').attr('fill', '#8d6e63')
                .text('\u5C1A\u65E0\u8BAD\u7EC3\u6570\u636E');
            return;
        }

        var xMax = history.length - 1;
        var xScale = d3.scaleLinear().domain([0, Math.max(xMax, 1)]).range([0, innerW]);
        var yMin = d3.min(history);
        var yMax = d3.max(history);
        var yR = (yMax - yMin) || 1;
        var yScale = d3.scaleLinear().domain([yMin - yR * 0.1, yMax + yR * 0.1]).range([innerH, 0]);

        g.append('g').attr('transform', 'translate(0,' + innerH + ')').call(d3.axisBottom(xScale).ticks(8));
        g.append('g').call(d3.axisLeft(yScale).ticks(8));
        g.append('g').attr('class', 'grid')
            .call(d3.axisLeft(yScale).ticks(8).tickSize(-innerW).tickFormat(''))
            .style('stroke', '#e8e0d8').style('stroke-dasharray', '3,3');

        // 实际曲线 (实线)
        var lineActual = d3.line()
            .x(function (d, i) { return xScale(i); })
            .y(function (d) { return yScale(d); });

        g.append('path').datum(history)
            .attr('d', lineActual)
            .attr('fill', 'none').attr('stroke', '#d32f2f').attr('stroke-width', 2);

        // 平滑曲线 (虚线)
        var smoothed = smoothArray(history, 5);
        var lineSmooth = d3.line()
            .x(function (d, i) { return xScale(i); })
            .y(function (d) { return yScale(d); });
        g.append('path').datum(smoothed)
            .attr('d', lineSmooth)
            .attr('fill', 'none').attr('stroke', '#1565c0').attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5');

        // 散点 + hover
        var tooltip = d3.select('#gd-tooltip');
        g.selectAll('circle.loss-dot')
            .data(history.map(function (v, i) { return { epoch: i + 1, loss: v }; }))
            .enter().append('circle')
            .attr('class', 'loss-dot')
            .attr('cx', function (d) { return xScale(d.epoch - 1); })
            .attr('cy', function (d) { return yScale(d.loss); })
            .attr('r', 2.5).attr('fill', '#d32f2f').attr('opacity', 0.6)
            .on('mouseover', function (event, d) {
                tooltip.style('display', 'block')
                    .html('<strong>Epoch:</strong> ' + d.epoch + '<br><strong>Loss:</strong> ' + d.loss.toFixed(6));
            })
            .on('mousemove', function (event) {
                tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function () { tooltip.style('display', 'none'); });

        // 图例
        g.append('line').attr('x1', innerW - 150).attr('y1', 14).attr('x2', innerW - 128).attr('y2', 14)
            .attr('stroke', '#d32f2f').attr('stroke-width', 2);
        g.append('text').attr('x', innerW - 124).attr('y', 18).attr('font-size', '11px').attr('fill', '#6d4c41').text('\u5B9E\u9645');
        g.append('line').attr('x1', innerW - 95).attr('y1', 14).attr('x2', innerW - 73).attr('y2', 14)
            .attr('stroke', '#1565c0').attr('stroke-width', 2).attr('stroke-dasharray', '5,5');
        g.append('text').attr('x', innerW - 69).attr('y', 18).attr('font-size', '11px').attr('fill', '#6d4c41').text('\u5E73\u6ED1');
    }

    function drawLRView() {
        if (!fitG) return;
        var container = document.getElementById('fit-canvas');
        var width = container.clientWidth || 600;
        var height = container.clientHeight || 380;
        var innerW = width - fitMargin.left - fitMargin.right;
        var innerH = height - fitMargin.top - fitMargin.bottom;

        fitG.selectAll('*').remove();
        var g = fitG.append('g').attr('transform', 'translate(' + fitMargin.left + ',' + fitMargin.top + ')');

        var history = GDS.lrHistory;
        if (history.length === 0) {
            g.append('text').attr('x', innerW / 2).attr('y', innerH / 2)
                .attr('text-anchor', 'middle').attr('font-size', '14px').attr('fill', '#8d6e63')
                .text('\u5C1A\u65E0\u8BAD\u7EC3\u6570\u636E');
            return;
        }

        var xMax = history.length - 1;
        var xScale = d3.scaleLinear().domain([0, Math.max(xMax, 1)]).range([0, innerW]);
        var yMin = d3.min(history);
        var yMax = d3.max(history);
        var yR = (yMax - yMin) || 0.001;
        var yScale = d3.scaleLinear().domain([Math.max(0, yMin - yR * 0.1), yMax + yR * 0.1]).range([innerH, 0]);

        g.append('g').attr('transform', 'translate(0,' + innerH + ')').call(d3.axisBottom(xScale).ticks(8));
        g.append('g').call(d3.axisLeft(yScale).ticks(8));
        g.append('g').attr('class', 'grid')
            .call(d3.axisLeft(yScale).ticks(8).tickSize(-innerW).tickFormat(''))
            .style('stroke', '#e8e0d8').style('stroke-dasharray', '3,3');

        var line = d3.line()
            .x(function (d, i) { return xScale(i); })
            .y(function (d) { return yScale(d); });

        g.append('path').datum(history)
            .attr('d', line)
            .attr('fill', 'none').attr('stroke', '#1565c0').attr('stroke-width', 2);

        // 散点
        var tooltip = d3.select('#gd-tooltip');
        g.selectAll('circle.lr-dot')
            .data(history.map(function (v, i) { return { epoch: i + 1, lr: v }; }))
            .enter().append('circle')
            .attr('class', 'lr-dot')
            .attr('cx', function (d) { return xScale(d.epoch - 1); })
            .attr('cy', function (d) { return yScale(d.lr); })
            .attr('r', 2.5).attr('fill', '#1565c0').attr('opacity', 0.6)
            .on('mouseover', function (event, d) {
                tooltip.style('display', 'block')
                    .html('<strong>Epoch:</strong> ' + d.epoch + '<br><strong>LR:</strong> ' + d.lr.toFixed(6));
            })
            .on('mousemove', function (event) {
                tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function () { tooltip.style('display', 'none'); });
    }

    function smoothArray(arr, window) {
        var result = new Array(arr.length);
        for (var i = 0; i < arr.length; i++) {
            var sum = 0, count = 0;
            for (var j = Math.max(0, i - window); j <= Math.min(arr.length - 1, i + window); j++) {
                sum += arr[j];
                count++;
            }
            result[i] = sum / count;
        }
        return result;
    }

    function drawFit() {
        if (GDS.activeView === 'fit') drawFitView();
        else if (GDS.activeView === 'loss') drawLossView();
        else if (GDS.activeView === 'lr') drawLRView();
    }

    // ===========================
    // 16. 训练引擎
    // ===========================
    function stopTraining() {
        GDS.shouldStop = true;
        GDS.isPlaying = false;
        GDS.isTraining = false;
    }

    function resetTraining() {
        stopTraining();
        GDS.currentEpoch = 0;
        GDS.currentLoss = Infinity;
        GDS.minLoss = Infinity;
        GDS.lossHistory = [];
        GDS.lrHistory = [];
        GDS.currentLr = GDS.baseLr;
        initWeights();
        drawNetwork();
        drawFit();
    }

    function singleEpoch() {
        if (GDS.dataX.length === 0) return;

        var dataLen = GDS.dataX.length;
        var batchSize = Math.min(32, dataLen);

        // 生成打乱的索引
        var indices = new Array(dataLen);
        for (var i = 0; i < dataLen; i++) indices[i] = i;
        for (var i = dataLen - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
        }

        var epochLoss = 0;
        var batchCount = 0;

        for (var b = 0; b < dataLen; b += batchSize) {
            var batchEnd = Math.min(b + batchSize, dataLen);
            var bSize = batchEnd - b;

            var sumGW = GDS.weights.map(function (w) {
                return w.map(function (row) { return row.map(function () { return 0; }); });
            });
            var sumGB = GDS.biases.map(function (bias) { return bias.map(function () { return 0; }); });
            var batchLoss = 0;

            for (var k = b; k < batchEnd; k++) {
                var idx = indices[k];
                var result = backwardPass([GDS.dataX[idx]], [GDS.dataY[idx]]);
                batchLoss += result.loss;

                for (var l = 0; l < result.gradW.length; l++) {
                    for (var i = 0; i < result.gradW[l].length; i++) {
                        for (var j = 0; j < result.gradW[l][i].length; j++) {
                            sumGW[l][i][j] += result.gradW[l][i][j];
                        }
                    }
                    for (var j = 0; j < result.gradB[l].length; j++) {
                        sumGB[l][j] += result.gradB[l][j];
                    }
                }
            }

            // 平均梯度
            for (var l = 0; l < sumGW.length; l++) {
                for (var i = 0; i < sumGW[l].length; i++) {
                    for (var j = 0; j < sumGW[l][i].length; j++) {
                        sumGW[l][i][j] /= bSize;
                    }
                }
                for (var j = 0; j < sumGB[l].length; j++) {
                    sumGB[l][j] /= bSize;
                }
            }

            optimizerUpdate(sumGW, sumGB, GDS.currentLr);
            epochLoss += batchLoss / bSize;
            batchCount++;
        }

        var avgLoss = epochLoss / batchCount;
        if (!isFinite(avgLoss)) {
            GDS.shouldStop = true;
            GDS.isPlaying = false;
            return;
        }

        GDS.currentLoss = avgLoss;
        if (avgLoss < GDS.minLoss) GDS.minLoss = avgLoss;
        GDS.currentEpoch++;
        GDS.lossHistory.push(avgLoss);
        GDS.currentLr = schedulerGetLR(GDS.currentEpoch);
        GDS.lrHistory.push(GDS.currentLr);

        // 同步更新控件状态可见性依赖
        updateNetworkEdges();
        drawFit();
    }

    async function runSingleStep() {
        if (GDS.isPlaying) return;
        if (GDS.currentEpoch >= GDS.totalEpochs) return;

        if (GDS.currentEpoch === 0 && GDS.lossHistory.length === 0) {
            collectAllParams();
            initWeights();
            drawNetwork();
            drawFit();
        }

        GDS.isTraining = true;
        singleEpoch();
        GDS.isTraining = false;
        updateControlButtons('paused');
    }

    async function runPlay() {
        if (GDS.isPlaying) return;
        if (GDS.currentEpoch >= GDS.totalEpochs) return;

        if (GDS.currentEpoch === 0 && GDS.lossHistory.length === 0) {
            collectAllParams();
            initWeights();
            drawNetwork();
            drawFit();
        }

        GDS.isTraining = true;
        GDS.isPlaying = true;
        GDS.shouldStop = false;
        updateControlButtons('playing');

        while (GDS.isPlaying && GDS.currentEpoch < GDS.totalEpochs && !GDS.shouldStop) {
            singleEpoch();
            if (!isFinite(GDS.currentLoss)) {
                stopTraining();
                break;
            }
            if (GDS.lossHistory.length > 0) {
                var recentLoss = GDS.lossHistory[GDS.lossHistory.length - 1];
                if (recentLoss < 1e-8) {
                    stopTraining();
                    break;
                }
            }
            await sleep(GDS.playSpeed);
        }

        GDS.isPlaying = false;
        GDS.isTraining = false;
        updateControlButtons('paused');
    }

    function runPause() {
        GDS.isPlaying = false;
        GDS.isTraining = false;
        updateControlButtons('paused');
    }

    function runReset() {
        stopTraining();
        GDS.currentEpoch = 0;
        GDS.currentLoss = Infinity;
        GDS.minLoss = Infinity;
        GDS.lossHistory = [];
        GDS.lrHistory = [];
        GDS.currentLr = GDS.baseLr;
        initWeights();
        drawNetwork();
        drawFit();
        updateControlButtons('paused');
    }

    // ===========================
    // 17. collectAllParams
    // ===========================
    function collectAllParams() {
        collectLayerConfig();

        // 优化器
        GDS.optimizer = document.getElementById('optimizer-select').value;
        collectParams('opt');

        // 学习率
        GDS.baseLr = parseFloat(document.getElementById('lr-slider').value);
        GDS.currentLr = GDS.baseLr;

        // 调度器
        GDS.scheduler = document.getElementById('scheduler-select').value;
        collectParams('sched');

        // 损失函数
        var lossRadio = document.querySelector('input[name="loss-fn"]:checked');
        GDS.lossFn = lossRadio ? lossRadio.value : 'mse';

        // Epoch
        GDS.totalEpochs = parseInt(document.getElementById('total-epochs').value) || 1000;

        // 重置 epoch 计数
        GDS.currentEpoch = 0;
        GDS.lossHistory = [];
        GDS.lrHistory = [];
        GDS.currentLoss = Infinity;
        GDS.minLoss = Infinity;
    }

    // ===========================
    // 18. 控制按钮状态
    // ===========================
    function updateControlButtons(state) {
        var playBtn = document.getElementById('play-btn');
        var pauseBtn = document.getElementById('pause-btn');
        var stepBtn = document.getElementById('step-btn');
        var resetBtn = document.getElementById('reset-btn');

        if (state === 'initial' || state === 'paused') {
            playBtn.disabled = false;
            pauseBtn.disabled = true;
            stepBtn.disabled = false;
            resetBtn.disabled = false;
        } else if (state === 'playing') {
            playBtn.disabled = true;
            pauseBtn.disabled = false;
            stepBtn.disabled = true;
            resetBtn.disabled = false;
        }
    }

    // ===========================
    // 19. 确定按钮
    // ===========================
    function applyReset() {
        stopTraining();
        collectAllParams();
        resetTraining();
        updateControlButtons('paused');
    }

    // ===========================
    // 20. 初始化
    // ===========================
    function init() {
        renderLayerList();
        renderOptimizerParams();
        renderSchedulerParams();

        // 学习率 slider
        var lrSlider = document.getElementById('lr-slider');
        var lrVal = document.getElementById('lr-value');
        lrSlider.addEventListener('input', function () {
            lrVal.textContent = parseFloat(lrSlider.value).toFixed(4);
        });

        // 优化器切换
        document.getElementById('optimizer-select').addEventListener('change', function () {
            GDS.optimizer = this.value;
            renderOptimizerParams();
            collectParams('opt');
        });

        // 调度器切换
        document.getElementById('scheduler-select').addEventListener('change', function () {
            GDS.scheduler = this.value;
            renderSchedulerParams();
            collectParams('sched');
        });

        // 添加隐藏层
        document.getElementById('add-layer-btn').addEventListener('click', function () {
            addHiddenLayer();
            applyReset();
        });

        // 预设数据集
        bindPresetButtons();

        // CSV上传
        bindUpload();

        // 列选择变化时自动应用
        document.getElementById('x-col-select').addEventListener('change', applyCSVData);
        document.getElementById('y-col-select').addEventListener('change', applyCSVData);

        // 确定按钮
        document.getElementById('apply-btn').addEventListener('click', applyReset);

        // 算法控制按钮
        document.getElementById('play-btn').addEventListener('click', runPlay);
        document.getElementById('pause-btn').addEventListener('click', runPause);
        document.getElementById('step-btn').addEventListener('click', runSingleStep);
        document.getElementById('reset-btn').addEventListener('click', runReset);

        // 速度 slider
        var speedSlider = document.getElementById('speed-slider');
        var speedLabel = document.getElementById('speed-label');
        speedSlider.addEventListener('input', function () {
            GDS.playSpeed = parseInt(speedSlider.value);
            if (GDS.playSpeed <= 100) speedLabel.textContent = '\u6781\u5FEB';
            else if (GDS.playSpeed <= 300) speedLabel.textContent = '\u5FEB';
            else if (GDS.playSpeed <= 800) speedLabel.textContent = '\u6B63\u5E38';
            else if (GDS.playSpeed <= 1500) speedLabel.textContent = '\u6162';
            else speedLabel.textContent = '\u6781\u6162';
        });

        // 视图切换
        var fitTabs = document.querySelectorAll('.gd-fit-tab');
        for (var i = 0; i < fitTabs.length; i++) {
            fitTabs[i].addEventListener('click', function () {
                var all = document.querySelectorAll('.gd-fit-tab');
                for (var j = 0; j < all.length; j++) all[j].classList.remove('active');
                this.classList.add('active');
                GDS.activeView = this.getAttribute('data-view');
                drawFit();
            });
        }

        // 画布初始化
        initNetworkCanvas();
        initFitCanvas();

        // 生成初始数据并绘制
        generateData('sin');
        collectAllParams();
        initWeights();
        drawNetwork();
        drawFit();

        // 按钮初始状态
        updateControlButtons('paused');

        // 窗口 resize
        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                drawNetwork();
                drawFit();
            }, 250);
        });

        console.log('\u2705 \u795E\u7ECF\u7F51\u7EDC\u68AF\u5EA6\u4E0B\u964D\u5B9E\u9A8C\u7CFB\u7EDF\u5DF2\u542F\u52A8');
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
