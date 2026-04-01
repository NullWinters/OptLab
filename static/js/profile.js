// 个人中心实验记录逻辑
(function () {
    const listEl = document.getElementById("record-list");
    const loadingEl = document.getElementById("record-list-loading");
    const emptyEl = document.getElementById("record-list-empty");
    const modal = document.getElementById("record-detail-modal");
    const detailBody = document.getElementById("record-detail-body");
    const detailClose = document.getElementById("record-detail-close");

    if (!listEl) return;

    function formatTime(iso) {
        try {
            const d = new Date(iso);
            return d.toLocaleString("zh-CN");
        } catch {
            return iso;
        }
    }

    function renderRecordRow(r) {
        const li = document.createElement("li");
        li.className = "record-row";
        li.innerHTML =
            "<div class='record-meta-group'>" +
            "<span class='record-title'>" + (r.alias || "未命名") + "</span>" +
            "<span class='record-time'>" + formatTime(r.created_at) + "</span>" +
            "</div>" +
            "<div class='record-action-group'>" +
            "<button class='record-view-btn record-btn record-btn-view' data-id='" + r.id + "'>查看实验数据</button>" +
            "<button class='record-export-btn record-btn record-btn-export' data-id='" + r.id + "'>导出实验数据</button>" +
            "<button class='record-rename-btn record-btn record-btn-rename' data-id='" + r.id + "' data-alias='" + (r.alias || "") + "'>修改备注名</button>" +
            "<button class='record-delete-btn record-btn record-btn-delete' data-id='" + r.id + "'>删除</button>" +
            "</div>";
        listEl.appendChild(li);
    }

    async function loadList() {
        if (typeof apiGet !== "function") {
            loadingEl.classList.add("is-hidden");
            emptyEl.classList.remove("is-hidden");
            emptyEl.textContent = "请先登录后查看实验记录。";
            return;
        }
        try {
            const list = await apiGet("/experiments/records");
            loadingEl.classList.add("is-hidden");
            if (!list || list.length === 0) {
                listEl.innerHTML = "";
                emptyEl.classList.remove("is-hidden");
                return;
            }
            emptyEl.classList.add("is-hidden");
            listEl.innerHTML = "";
            list.forEach(renderRecordRow);

            listEl.querySelectorAll(".record-view-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    const id = btn.getAttribute("data-id");
                    viewRecord(id);
                });
            });
            listEl.querySelectorAll(".record-export-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    const id = btn.getAttribute("data-id");
                    exportRecord(id);
                });
            });
            listEl.querySelectorAll(".record-rename-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    const id = btn.getAttribute("data-id");
                    const alias = btn.getAttribute("data-alias") || "";
                    renameRecord(id, alias);
                });
            });
            listEl.querySelectorAll(".record-delete-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    const id = btn.getAttribute("data-id");
                    deleteRecord(id);
                });
            });
        } catch (err) {
            loadingEl.classList.add("is-hidden");
            emptyEl.classList.remove("is-hidden");
            emptyEl.textContent = "加载失败，请检查登录状态后刷新。";
        }
    }

    async function viewRecord(id) {
        try {
            const token = typeof getStoredToken === "function" ? getStoredToken() : null;
            const res = await fetch("/experiments/records/" + id, {
                headers: token ? { Authorization: "Bearer " + token } : {},
            });
            if (!res.ok) throw new Error("加载失败");
            const data = await res.json();
            const p = data.payload || {};
            const iter = p.iteration_data || p.iterationLog || [];

            function terminationText(row) {
                if (!row || !row.is_complete) return "进行中";
                if (row.has_converged) {
                    if (row.result != null && !Number.isNaN(Number(row.result))) {
                        return "已收敛（结果 x*≈" + Number(row.result).toFixed(6) + "）";
                    }
                    return "已收敛";
                }
                switch (row.termination_reason) {
                    case "max_iter":
                        return "已终止（达到最大迭代次数，未收敛）";
                    case "grad_zero":
                        return "已终止（梯度≈0，但未满足收敛判据）";
                    case "hessian_zero":
                        return "已终止（二阶导≈0，无法继续更新）";
                    case "secant_den_zero":
                        return "已终止（割线分母≈0，无法继续更新）";
                    default:
                        return "已终止（未收敛）";
                }
            }

            function escapeHtml(s) {
                return String(s == null ? "" : s)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/\"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }

            function algoRowClass(row) {
                const algo = (row && row.algorithm) ? String(row.algorithm) : "";
                if (algo.includes("黄金") || algo.includes("Golden")) return "algo-row-golden";
                if (algo.includes("斐波那契") || algo.includes("Fibonacci")) return "algo-row-fibonacci";
                if (algo.includes("二分") || algo.includes("Bisection")) return "algo-row-bisection";
                if (algo.includes("梯度") || algo.includes("GD")) return "algo-row-golden";
                if (algo.includes("牛顿") || algo.includes("Newton")) return "algo-row-fibonacci";
                if (algo.includes("割线") || algo.includes("Secant")) return "algo-row-bisection";
                return "";
            }

            function formatNum(value, digits) {
                const n = Number(value);
                if (!Number.isFinite(n)) return "—";
                return n.toFixed(typeof digits === "number" ? digits : 4);
            }

            function buildSimplexTableauHtml(tableau) {
                if (!tableau || !Array.isArray(tableau.a) || !Array.isArray(tableau.cj)) {
                    return "<div class='record-detail-empty'>该步无 tableau 数据。</div>";
                }

                const bArr = Array.isArray(tableau.b) ? tableau.b : [];
                const cBArr = Array.isArray(tableau.cB) ? tableau.cB : [];
                const basisArr = Array.isArray(tableau.basis) ? tableau.basis : [];
                const thetaArr = Array.isArray(tableau.theta) ? tableau.theta : [];
                const sigmaArr = Array.isArray(tableau.sigma) ? tableau.sigma : [];

                let html = "<div class='record-simplex-tableau-wrap'><table class='record-simplex-tableau'><thead><tr>" +
                    "<th>cB</th><th>Basis</th><th>b</th>";
                tableau.cj.forEach(function (_, idx) {
                    html += "<th>x" + (idx + 1) + "</th>";
                });
                html += "<th>θ</th></tr></thead><tbody>";

                tableau.a.forEach(function (row, rowIdx) {
                    html += "<tr>" +
                        "<td>" + formatNum(cBArr[rowIdx]) + "</td>" +
                        "<td>" + escapeHtml(basisArr[rowIdx] || "--") + "</td>" +
                        "<td>" + formatNum(bArr[rowIdx]) + "</td>";
                    for (let j = 0; j < tableau.cj.length; j++) {
                        html += "<td>" + formatNum(row[j]) + "</td>";
                    }
                    html += "<td>" + (thetaArr[rowIdx] == null ? "—" : formatNum(thetaArr[rowIdx])) + "</td></tr>";
                });

                html += "<tr class='record-simplex-sigma-row'><td>σj</td><td></td><td></td>";
                for (let j = 0; j < tableau.cj.length; j++) {
                    html += "<td>" + formatNum(sigmaArr[j]) + "</td>";
                }
                html += "<td></td></tr>";
                html += "</tbody></table></div>";
                return html;
            }

            function formatDisplayValue(key, value) {
                if (value == null) return { isComplex: false, text: "—" };

                if (key === 'constraints' && Array.isArray(value)) {
                    const lines = value.map(function (item, idx) {
                        if (!item || !Array.isArray(item.coeffs)) return '约束' + (idx + 1) + ': ' + JSON.stringify(item);
                        const expr = item.coeffs.map(function (coef, j) {
                            const n = Number(coef);
                            const sign = j === 0 ? '' : (n >= 0 ? ' + ' : ' - ');
                            return sign + Math.abs(n) + 'x' + (j + 1);
                        }).join('');
                        return '约束' + (idx + 1) + ': ' + expr + ' ≤ ' + Number(item.b);
                    });
                    return { isComplex: false, text: lines.join('\n'), multiline: true };
                }

                if (Array.isArray(value)) {
                    const isPrimitiveArray = value.every(function (v) {
                        return v == null || ["string", "number", "boolean"].indexOf(typeof v) !== -1;
                    });
                    if (isPrimitiveArray) {
                        return {
                            isComplex: false,
                            text: value.map(function (v) {
                                return typeof v === "number" && Number.isFinite(v) ? Number(v).toString() : String(v);
                            }).join(", ")
                        };
                    }
                    return { isComplex: true, text: JSON.stringify(value, null, 2) };
                }

                if (typeof value === "object") {
                    return { isComplex: true, text: JSON.stringify(value, null, 2) };
                }

                return { isComplex: false, text: String(value) };
            }

            const summaryItems = [];
            summaryItems.push("<div><span class='record-detail-label'>别名：</span><span class='record-detail-strong'>" + escapeHtml(data.alias || "") + "</span></div>");
            summaryItems.push("<div><span class='record-detail-label'>来源：</span><span class='record-detail-mono'>" + escapeHtml(data.source_page || "") + "</span></div>");
            if (p.algorithm_name) summaryItems.push("<div><span class='record-detail-label'>算法：</span><span>" + escapeHtml(p.algorithm_name) + "</span></div>");
            if (p.test_function) summaryItems.push("<div><span class='record-detail-label'>测试函数：</span><span class='record-detail-mono'>" + escapeHtml(p.test_function) + "</span></div>");
            summaryItems.push("<div><span class='record-detail-label'>记录条数：</span><span>" + (Array.isArray(iter) ? String(iter.length) : "0") + "</span></div>");
            if (Array.isArray(iter) && iter.length) {
                const finalRow = [...iter].reverse().find(function (row) {
                    return row && row.is_complete;
                }) || null;
                summaryItems.push("<div><span class='record-detail-label'>终止状态：</span><span>" + escapeHtml(terminationText(finalRow)) + "</span></div>");
            }

            let html = "";
            html += "<div class='record-detail-summary'>" + summaryItems.join("") + "</div>";

            if (p.initial_state && typeof p.initial_state === "object") {
                html += "<div class='record-detail-initial'>";
                html += "<div class='record-detail-initial-title'>初始参数</div>";
                html += "<div class='record-detail-initial-grid'>";
                const paramLabelMap = {
                    n: '变量个数 n',
                    m: '约束个数 m',
                    solve_type: '求解类型',
                    objective_coeffs: '目标函数系数',
                    constraints: '约束条件'
                };
                Object.keys(p.initial_state).forEach(function (k) {
                    const fv = formatDisplayValue(k, p.initial_state[k]);
                    const label = paramLabelMap[k] || k;
                    html += "<div class='record-detail-kv'>" +
                        "<span class='record-detail-label'>" + escapeHtml(label) + "</span>" +
                        (fv.isComplex
                            ? "<pre class='record-detail-json'>" + escapeHtml(fv.text) + "</pre>"
                            : (fv.multiline
                                ? "<span class='record-detail-mono record-detail-multi-line'>" + escapeHtml(fv.text) + "</span>"
                                : "<span class='record-detail-mono'>" + escapeHtml(fv.text) + "</span>")) +
                        "</div>";
                });
                html += "</div></div>";
            }

            if (Array.isArray(iter) && iter.length && typeof iter[0] === "object") {
                const isSimplexRecord = Array.isArray(iter[0].basis) || (iter[0].tableau && Array.isArray(iter[0].tableau.a));
                if (isSimplexRecord) {
                    html += "<div class='record-detail-table-wrap'>";
                    html += "<div class='record-detail-table-scroll'>";
                    html += "<table class='record-detail-table record-simplex-summary-table'>";
                    html += "<thead><tr><th>迭代</th><th>入基变量</th><th>离基变量</th><th>状态</th><th>基变量</th><th>当前基解 b</th><th>操作</th></tr></thead><tbody>";

                    iter.forEach(function (row) {
                        const basisText = Array.isArray(row.basis) ? row.basis.join(', ') : '—';
                        const bText = Array.isArray(row.b) ? row.b.map(function (v) { return formatNum(v); }).join(', ') : '—';
                        const tableauHtml = buildSimplexTableauHtml(row.tableau || row);
                        html += "<tr>" +
                            "<td>" + escapeHtml(row.iteration) + "</td>" +
                            "<td>" + escapeHtml(row.entering || '—') + "</td>" +
                            "<td>" + escapeHtml(row.leaving || '—') + "</td>" +
                            "<td>" + escapeHtml(row.status || '—') + "</td>" +
                            "<td>" + escapeHtml(basisText) + "</td>" +
                            "<td>" + escapeHtml(bText) + "</td>" +
                            "<td><button type='button' class='record-simplex-expand-btn' data-step='" + escapeHtml(row.iteration) + "'>展开完整 tableau</button></td>" +
                            "</tr>" +
                            "<tr class='is-hidden' data-simplex-detail='" + escapeHtml(row.iteration) + "'><td colspan='7'>" + tableauHtml + "</td></tr>";
                    });

                    html += "</tbody></table></div></div>";
                } else {
                    const headers = Object.keys(iter[0]);
                    const maxRows = 200;
                    const rows = iter.slice(0, maxRows);
                    html += "<div class='record-detail-table-wrap'>";
                    html += "<div class='record-detail-table-scroll'>";
                    html += "<table class='record-detail-table'>";
                    html += "<thead><tr>";
                    headers.forEach(function (h) {
                        html += "<th>" + escapeHtml(h) + "</th>";
                    });
                    html += "</tr></thead><tbody>";
                    rows.forEach(function (row) {
                        html += "<tr class='" + algoRowClass(row) + "'>";
                        headers.forEach(function (h) {
                            html += "<td>" + escapeHtml(row[h]) + "</td>";
                        });
                        html += "</tr>";
                    });
                    html += "</tbody></table></div>";
                    if (iter.length > maxRows) {
                        html += "<div class='record-detail-table-tip'>仅展示前 " + maxRows + " 条记录（共 " + iter.length + " 条）。如需全部数据请使用“导出实验数据”。</div>";
                    }
                    html += "</div>";
                }
            } else if (Array.isArray(iter) && iter.length) {
                html += "<div class='record-detail-empty'>迭代数据格式非表格结构，建议使用“导出实验数据”查看完整内容。</div>";
            } else {
                html += "<div class='record-detail-empty'>该记录不包含迭代数据。</div>";
            }

            detailBody.innerHTML = html;
            detailBody.querySelectorAll('.record-simplex-expand-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const step = btn.getAttribute('data-step');
                    const row = detailBody.querySelector('tr[data-simplex-detail="' + step + '"]');
                    if (!row) return;
                    const isOpening = row.classList.contains('is-hidden');
                    row.classList.toggle('is-hidden');
                    btn.classList.toggle('is-open', isOpening);
                    btn.textContent = isOpening ? '收起 tableau' : '展开完整 tableau';
                });
            });
            modal.classList.remove("is-hidden");
        } catch (e) {
            alert("查看实验数据失败，请稍后重试。");
        }
    }

    function buildCsvFromRecord(data) {
        const p = data.payload || {};
        const iter = p.iteration_data || p.iterationLog || [];

        const lines = [];
        const push = (row) => lines.push(row.join(","));

        push(["别名", data.alias || ""]);
        push(["来源", data.source_page || ""]);
        if (p.algorithm_name) push(["算法", p.algorithm_name]);
        if (p.test_function) push(["测试函数", p.test_function]);
        push(["记录条数", Array.isArray(iter) ? String(iter.length) : "0"]);
        lines.push([]);

        if (Array.isArray(iter) && iter.length && typeof iter[0] === "object") {
            const headers = Object.keys(iter[0]);
            push(headers);
            iter.forEach(function (row) {
                push(headers.map(function (h) {
                    const v = row[h];
                    if (v == null) return "";
                    const s = String(v).replace(/"/g, '""');
                    return /[",\n]/.test(s) ? '"' + s + '"' : s;
                }));
            });
        }

        return lines.join("\n");
    }

    async function exportRecord(id) {
        try {
            const token = typeof getStoredToken === "function" ? getStoredToken() : null;
            const res = await fetch("/experiments/records/" + id, {
                headers: token ? { Authorization: "Bearer " + token } : {},
            });
            if (!res.ok) throw new Error("导出失败");
            const data = await res.json();
            const csv = buildCsvFromRecord(data);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = (data.alias || "experiment") + ".csv";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert("导出实验数据失败，请稍后重试。");
        }
    }

    async function renameRecord(id, oldAlias) {
        try {
            if (typeof apiRequest !== "function") {
                if (window.LoginModal && typeof window.LoginModal.open === 'function') {
                    window.LoginModal.open({ mode: 'login', notice: '请先登录后再修改备注名。' });
                } else {
                    alert("请先登录后再修改备注名。");
                }
                return;
            }

            const defaultAlias = String(oldAlias || '').trim() || (
                (window.RecordSaveModal && typeof window.RecordSaveModal.makeDefaultAlias === 'function')
                    ? window.RecordSaveModal.makeDefaultAlias('RECORD')
                    : ('RECORD-' + new Date().toISOString().slice(0, 16).replace('T', ' '))
            );

            if (window.RecordSaveModal && typeof window.RecordSaveModal.open === 'function') {
                window.RecordSaveModal.open({
                    title: '修改备注名',
                    subtitle: '更新后将立即应用到该实验记录',
                    aliasPrefix: 'RECORD',
                    defaultAlias,
                    onConfirm: async function (alias) {
                        await apiRequest('/experiments/records/' + id, {
                            method: 'PATCH',
                            body: JSON.stringify({ alias: String(alias).trim() }),
                        });
                        await loadList();
                    }
                });
            } else {
                alert('修改备注名弹窗未加载，请刷新页面后重试。');
            }
        } catch (e) {
            alert("修改备注名失败，请稍后重试。");
        }
    }

    async function deleteRecord(id) {
        try {
            if (typeof apiRequest !== "function") {
                if (window.LoginModal && typeof window.LoginModal.open === 'function') {
                    window.LoginModal.open({ mode: 'login', notice: '请先登录后再删除记录。' });
                } else {
                    alert("请先登录后再删除记录。");
                }
                return;
            }
            if (window.RecordDeleteConfirmModal && typeof window.RecordDeleteConfirmModal.open === 'function') {
                window.RecordDeleteConfirmModal.open({
                    title: '删除实验记录',
                    subtitle: '请确认是否删除该记录',
                    message: '确定删除这条实验记录吗？删除后无法恢复。',
                    onConfirm: async function () {
                        await apiRequest('/experiments/records/' + id, { method: 'DELETE' });
                        await loadList();
                    }
                });
            } else {
                const ok = window.confirm("确定删除这条实验记录吗？删除后无法恢复。");
                if (!ok) return;
                await apiRequest("/experiments/records/" + id, { method: "DELETE" });
                await loadList();
            }
        } catch (e) {
            alert("删除失败，请稍后重试。");
        }
    }

    detailClose && detailClose.addEventListener("click", function () {
        modal.classList.add("is-hidden");
    });

    modal && modal.addEventListener("click", function (e) {
        if (e.target === modal) {
            modal.classList.add("is-hidden");
        }
    });

    loadList();
})();

