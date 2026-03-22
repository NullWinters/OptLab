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
        li.className = "py-4 flex flex-wrap items-center justify-between gap-4";
        li.innerHTML =
            "<div class='flex flex-wrap items-center gap-4'>" +
            "<span class='font-medium'>" + (r.alias || "未命名") + "</span>" +
            "<span class='text-gray-500 text-sm'>" + formatTime(r.created_at) + "</span>" +
            "</div>" +
            "<div class='flex gap-2'>" +
            "<button class='record-view-btn px-3 py-1.5 bg-amber-50 text-amber-primary rounded-lg hover:bg-amber-100 text-sm' data-id='" + r.id + "'>查看实验数据</button>" +
            "<button class='record-export-btn px-3 py-1.5 border border-amber-primary text-amber-primary rounded-lg hover:bg-amber-50 text-sm' data-id='" + r.id + "'>导出实验数据</button>" +
            "<button class='record-rename-btn px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm' data-id='" + r.id + "' data-alias='" + (r.alias || "") + "'>修改备注名</button>" +
            "<button class='record-delete-btn px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm' data-id='" + r.id + "'>删除</button>" +
            "</div>";
        listEl.appendChild(li);
    }

    async function loadList() {
        if (typeof apiGet !== "function") {
            loadingEl.classList.add("hidden");
            emptyEl.classList.remove("hidden");
            emptyEl.textContent = "请先登录后查看实验记录。";
            return;
        }
        try {
            const list = await apiGet("/experiments/records");
            loadingEl.classList.add("hidden");
            if (!list || list.length === 0) {
                listEl.innerHTML = "";
                emptyEl.classList.remove("hidden");
                return;
            }
            emptyEl.classList.add("hidden");
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
            loadingEl.classList.add("hidden");
            emptyEl.classList.remove("hidden");
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
                if (algo.includes("黄金") || algo.includes("Golden")) return "bg-yellow-50";
                if (algo.includes("斐波那契") || algo.includes("Fibonacci")) return "bg-green-50";
                if (algo.includes("二分") || algo.includes("Bisection")) return "bg-blue-50";
                if (algo.includes("梯度") || algo.includes("GD")) return "bg-yellow-50";
                if (algo.includes("牛顿") || algo.includes("Newton")) return "bg-green-50";
                if (algo.includes("割线") || algo.includes("Secant")) return "bg-blue-50";
                return "";
            }

            const summaryItems = [];
            summaryItems.push("<div><span class='text-gray-500'>别名：</span><span class='font-semibold'>" + escapeHtml(data.alias || "") + "</span></div>");
            summaryItems.push("<div><span class='text-gray-500'>来源：</span><span class='font-mono text-xs'>" + escapeHtml(data.source_page || "") + "</span></div>");
            if (p.algorithm_name) summaryItems.push("<div><span class='text-gray-500'>算法：</span><span>" + escapeHtml(p.algorithm_name) + "</span></div>");
            if (p.test_function) summaryItems.push("<div><span class='text-gray-500'>测试函数：</span><span class='font-mono text-xs'>" + escapeHtml(p.test_function) + "</span></div>");
            summaryItems.push("<div><span class='text-gray-500'>记录条数：</span><span>" + (Array.isArray(iter) ? String(iter.length) : "0") + "</span></div>");

            let html = "";
            html += "<div class='text-sm text-gray-700 space-y-1 mb-3'>" + summaryItems.join("") + "</div>";

            if (p.initial_state && typeof p.initial_state === "object") {
                html += "<div class='mb-3 p-3 rounded-lg bg-amber-50/50 border border-amber-100'>";
                html += "<div class='font-semibold mb-2'>初始参数</div>";
                html += "<div class='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs'>";
                Object.keys(p.initial_state).forEach(function (k) {
                    html += "<div class='flex justify-between gap-4'><span class='text-gray-500'>" + escapeHtml(k) + "</span><span class='font-mono'>" + escapeHtml(p.initial_state[k]) + "</span></div>";
                });
                html += "</div></div>";
            }

            if (Array.isArray(iter) && iter.length && typeof iter[0] === "object") {
                const headers = Object.keys(iter[0]);
                const maxRows = 200;
                const rows = iter.slice(0, maxRows);
                html += "<div class='rounded-xl border border-gray-200 overflow-hidden'>";
                html += "<div class='overflow-auto max-h-[52vh]'>";
                html += "<table class='min-w-full text-xs'>";
                html += "<thead class='bg-gray-50 sticky top-0'><tr>";
                headers.forEach(function (h) {
                    html += "<th class='text-left font-semibold px-3 py-2 border-b border-gray-200'>" + escapeHtml(h) + "</th>";
                });
                html += "</tr></thead><tbody>";
                rows.forEach(function (row) {
                    html += "<tr class='" + algoRowClass(row) + "'>";
                    headers.forEach(function (h) {
                        html += "<td class='px-3 py-2 border-b border-gray-100 whitespace-nowrap'>" + escapeHtml(row[h]) + "</td>";
                    });
                    html += "</tr>";
                });
                html += "</tbody></table></div>";
                if (iter.length > maxRows) {
                    html += "<div class='px-3 py-2 text-xs text-gray-500 bg-white border-t'>仅展示前 " + maxRows + " 条记录（共 " + iter.length + " 条）。如需全部数据请使用“导出实验数据”。</div>";
                }
                html += "</div>";
            } else if (Array.isArray(iter) && iter.length) {
                html += "<div class='text-gray-500 text-sm'>迭代数据格式非表格结构，建议使用“导出实验数据”查看完整内容。</div>";
            } else {
                html += "<div class='text-gray-500 text-sm'>该记录不包含迭代数据。</div>";
            }

            detailBody.innerHTML = html;
            modal.classList.remove("hidden");
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
                alert("请先登录后再修改备注名。");
                return;
            }
            const next = window.prompt("请输入新的备注名：", oldAlias || "");
            if (next == null) return;
            const alias = String(next).trim();
            if (!alias) return;
            await apiRequest("/experiments/records/" + id, {
                method: "PATCH",
                body: JSON.stringify({ alias }),
            });
            await loadList();
        } catch (e) {
            alert("修改备注名失败，请稍后重试。");
        }
    }

    async function deleteRecord(id) {
        try {
            if (typeof apiRequest !== "function") {
                alert("请先登录后再删除记录。");
                return;
            }
            const ok = window.confirm("确定删除这条实验记录吗？删除后无法恢复。");
            if (!ok) return;
            await apiRequest("/experiments/records/" + id, { method: "DELETE" });
            await loadList();
        } catch (e) {
            alert("删除失败，请稍后重试。");
        }
    }

    detailClose && detailClose.addEventListener("click", function () {
        modal.classList.add("hidden");
    });

    modal && modal.addEventListener("click", function (e) {
        if (e.target === modal) {
            modal.classList.add("hidden");
        }
    });

    loadList();
})();

