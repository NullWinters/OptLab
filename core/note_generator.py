"""实验笔记：按页面数据与行为记录调用模型生成正文。"""
import json
import logging
import os
from typing import Any

import settings

logger = logging.getLogger(__name__)

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_EXPERIMENT_DOCS_MAP = {
    "line-search.range_search.observation": {
        "label": "区间收缩法 · 流程观察",
        "guide": "docs/实验指导书/区间收缩法-流程观察.txt",
    },
    "line-search.range_search.comparison": {
        "label": "区间收缩法 · 性质对比",
        "guide": "docs/实验指导书/区间收缩法-性质对比.txt",
    },
    "line-search.point_search.observation": {
        "label": "点搜索法 · 流程观察",
        "guide": "docs/实验指导书/点搜索-流程观察.txt",
    },
    "line-search.point_search.comparison": {
        "label": "点搜索法 · 性质对比",
        "guide": "docs/实验指导书/点搜索-性质对比.txt",
    },
    "line-search.application.main": {
        "label": "一维搜索应用 · 最小二乘与利润优化",
        "guide": "docs/实验指导书/一维搜索方法应用实验.txt",
    },
    "linear-programming.simplex": {
        "label": "线性规划 · 单纯形法",
        "guide": "docs/实验指导书/单纯形法.txt",
    },
    "svm-smo.kernel_trick.visualization": {
        "label": "支持向量机与SMO · 核技巧三维可视化",
        "guide": "docs/实验指导书/SVM-核技巧-三维可视化.txt",
    },
    "svm-smo.smo_iteration.observation": {
        "label": "支持向量机与SMO · SMO迭代过程观察",
        "guide": "docs/实验指导书/SVM-SMO-课程主页.txt",
    },
}


_EXPERIMENT_TEMPLATES: dict[str, str] = {
    "line-search.range_search.observation": (
        "实验类型：区间收缩法 · 流程观察（单算法）。任务：观察区间缩小与试探点规则。\n"
        "章节（用【】标注）：\n\n"
        "【实验参数】\n"
        "算法名、$f(x)$、$[a_0,b_0]$、终止参数（$\\varepsilon$ 或斐波那契的 $N$ 与修正系数等）。\n\n"
        "【迭代过程】\n"
        "依据【迭代数据摘要】写前几步与末几步的 $a_k,b_k$、区间长（4 位小数）、收缩比与理论值（0.618/0.5/斐波那契步长比）对照；"
        "总步数与 $[a_K,b_K]$。无数据写未运行。\n\n"
        "【结果分析】\n"
        "$x^*=(a_K+b_K)/2$、$f(x^*)$；收缩与理论是否一致；操作记录中换函数/改参数的影响（若有）。\n\n"
        "【操作记录】\n"
        "时间序列表 + 简短「操作与现象对照」。"
    ),
    "line-search.range_search.comparison": (
        "实验类型：区间收缩法 · 性质对比（三算法、同区间）。任务：对比效率与数值表现。\n\n"
        "【实验参数】\n"
        "$f(x)$、共享 $[a_0,b_0]$、三算法终止参数。\n\n"
        "【三算法对比】\n"
        "Markdown 表：算法、迭代步数、最终区间长、$x^*$（4 位）；未运行标未运行。表下简析快慢与差异原因。\n\n"
        "【收敛规律分析】\n"
        "三种算法收缩比与理论（0.618/斐波那契趋近/0.5）；偏离时联系函数形态或误差；有视图切换则提一句曲线。\n\n"
        "【操作记录】\n"
        "含视图切换；末「操作与现象对照」。"
    ),
    "line-search.point_search.observation": (
        "实验类型：点搜索法 · 流程观察（梯度/牛顿/割线三选一）。\n\n"
        "【实验参数】\n"
        "算法、$f(x)$、$x_0$、割线 $x_{-1}$、$\\alpha$（梯度）、$N$。\n\n"
        "【迭代过程】\n"
        "前几步与末几步的 $x_k,f,f'$（6 位），牛顿加 $f''$，割线提分母；终止原因。无数据写未运行。\n\n"
        "【结果分析】\n"
        "$x^*,f(x^*)$；与算法收敛特点对照；$\\alpha$、$f''$、分母等小问题（若存在）。\n\n"
        "【操作记录】\n"
        "时间序 +「操作与现象对照」。"
    ),
    "line-search.point_search.comparison": (
        "实验类型：点搜索法 · 性质对比（三算法并行）。任务：比较迭代次数、稳定性与终点。\n\n"
        "【实验参数】\n"
        "$f(x),x_0,x_{-1},\\alpha,N$ 与数据一致。\n\n"
        "【三算法对比】\n"
        "表：算法、步数/原因、$x,f,|f'|$（6 位）；表下简析效率与终点差异。\n\n"
        "【收敛行为分析】\n"
        "三算法各一两句，引用表中数字；谈 $\\alpha$、$f''$、分母等。\n\n"
        "【操作记录】\n"
        "含「操作与现象对照」。"
    ),
    "line-search.application.main": (
        "实验类型：一维搜索应用（最小二乘拟合 $\\hat{\\beta}$ + 利润定价 $p^*$）。\n\n"
        "【子实验一：最小二乘拟合】\n"
        "样本量、方法、初值/区间、终止；2～3 步损失与 $\\beta$；最终 $\\hat{\\beta}$ 与损失。未执行写未执行。\n\n"
        "【子实验二：最大利润定价】\n"
        "$\\hat{\\alpha},\\hat{\\beta},c$、搜索设置；几步迭代与最终 $p^*,\\pi(p^*)$；可提一阶条件数值核对。未执行写未执行。\n\n"
        "【结果分析】\n"
        "拟合质量、定价含义、换方法时差异（若有）。\n\n"
        "【操作记录】\n"
        "加载/方法/参数/求解 +「操作与现象对照」。"
    ),
    "linear-programming.simplex": (
        "实验类型：线性规划 · 单纯形法。\n\n"
        "【问题设置】\n"
        "$n$、$m$、max/min；无系数则写未记录；简述松弛变量与标准形。\n\n"
        "【迭代过程】\n"
        "有数据则写入离基、主元等；无则依行为记录说明检查/求解/重置；可提规模（$n={n},m={m}$）。\n\n"
        "【最终结果】\n"
        "最优解与目标值或无界/无可行（与数据一致）。\n\n"
        "【算法要点】\n"
        "结合本题写检验数与比值测试各一两句，勿空抄定义。\n\n"
        "【操作记录】\n"
        "含「操作与现象对照」。"
    ),
    "svm-smo.kernel_trick.visualization": (
        "实验类型：支持向量机核技巧 · 三维可视化。\n\n"
        "【实验参数】\n"
        "数据来源（预设/上传）、样本量、列映射（$x,y,label$）、核映射表达式 $\phi(x,y)$、超平面参数（$z$ 平移与 yaw/pitch）。\n\n"
        "【实验过程】\n"
        "按时间顺序描述：数据加载、列映射确认、自定义映射应用、升维动画、超平面调节；结合过程日志与行为记录引用关键步骤。\n\n"
        "【三维可分性与结果】\n"
        "记录最终划分准确率、类别分布、映射前后可分性变化；若准确率变化明显，说明与映射表达式及平面参数的关系。\n\n"
        "【综合分析】\n"
        "结合核技巧理论解释为何升维后更易线性分割，指出本次数据与映射在几何层面的表现。\n\n"
        "【操作记录】\n"
        "给出关键交互时间序，并附「操作与现象对照」。"
    ),
    "svm-smo.smo_iteration.observation": (
        "实验类型：SMO 算法 · 迭代过程观察。\n\n"
        "【实验参数】\n"
        "数据来源、样本量、列映射、超参数（$C$、$tol$、$max\_iter$）与播放速度设置。\n\n"
        "【迭代过程】\n"
        "基于迭代日志写出代表性步骤：$(i,j)$ 选择、$\alpha_i,\alpha_j$ 更新、$w,b$ 变化与准确率变化；标注达到终止条件的阶段。\n\n"
        "【实验结果】\n"
        "给出最终迭代次数、$w$、$b$、分类准确率、是否完成收敛；若未收敛，说明受限因素。\n\n"
        "【机制分析】\n"
        "结合 SMO 原理解释两变量子问题更新对分离超平面的影响，讨论超参数对收敛速度与稳定性的作用。\n\n"
        "【操作记录】\n"
        "按时间序列整理用户控制行为，并附「操作与现象对照」。"
    ),
}

_DEFAULT_TEMPLATE = (
    "章节结构（用【】标注，禁止用#）：\n\n"
    "【实验参数】列出核心参数及含义。\n\n"
    "【实验过程】关键步骤与数据引用；终止原因。\n\n"
    "【结果与分析】理论或公式对照、数值解读、与操作的关系。\n\n"
    "【操作记录】时间序；末可附简短「操作与现象对照」。"
)

_TEMPLATE_ENRICHERS: dict[str, str] = {
    "line-search.range_search.observation": (
        "\n\n【补充】\n"
        "【结果分析】至少引用 3 处数据；理论收缩比与观测收缩比各提一次（有数据时）。"
    ),
    "line-search.range_search.comparison": (
        "\n\n【补充】\n"
        "表后须用文字解读；三种算法名称在分析中各出现至少一次。"
    ),
    "line-search.point_search.observation": (
        "\n\n【补充】\n"
        "【结果分析】点明所用算法及 1～2 个典型数值现象。"
    ),
    "line-search.point_search.comparison": (
        "\n\n【补充】\n"
        "三种算法各写几句，尽量带表中数字。"
    ),
    "line-search.application.main": (
        "\n\n【补充】\n"
        "两子实验有数据时各写一小段；【结果分析】可一句联系拟合与定价。"
    ),
    "linear-programming.simplex": (
        "\n\n【补充】\n"
        "【算法要点】至少 3 句；无矩阵时说明能依据行为记录推断什么。"
    ),
    "svm-smo.kernel_trick.visualization": (
        "\n\n【补充】\n"
        "必须引用数据集规模、至少 1 组映射表达式和最终准确率；分析中体现升维前后可分性变化。"
    ),
    "svm-smo.smo_iteration.observation": (
        "\n\n【补充】\n"
        "必须引用迭代日志中的具体数值（如 $\alpha$、$w$、$b$、准确率）；若未收敛需给出数据驱动原因。"
    ),
}

_USER_PROMPT_DEPTH = (
    "\n\n【篇幅与分析】\n"
    "1. 正文不少于约 1950 个汉字（约原先要求的 3/4）；无迭代数据时简要说明原因即可，不必硬凑。\n"
    "2. 【结果分析】或等价章节：至少两段，含理论对照与数据核对；有行为记录时提一句与现象的关系。\n"
    "3. 数字须来自所给参数与迭代摘要，禁止编造。\n"
    "4. 标题中函数用 LaTeX $...$。\n"
)


_GUIDE_MAX_CHARS = 9000


def _load_guide(experiment_key: str) -> str:
    mapping = _EXPERIMENT_DOCS_MAP.get(experiment_key)
    if not mapping:
        return ""
    guide_path = os.path.join(_project_root, mapping["guide"])
    if os.path.exists(guide_path):
        with open(guide_path, "r", encoding="utf-8") as f:
            text = f.read().strip()
        if len(text) > _GUIDE_MAX_CHARS:
            return (
                text[:_GUIDE_MAX_CHARS]
                + "\n\n（以上为实验指导书节选；写作须同时严格遵循下方【结构模板】与实验数据。）"
            )
        return text
    return ""


def _summarize_behavior(behavior: dict) -> str:
    """将行为追踪数据转为紧凑文字，避免将原始 JSON 喂给 LLM。"""
    if not behavior or not isinstance(behavior, dict):
        logger.debug(f"[NoteGen] behavior invalid: type={type(behavior)}, empty={not behavior}")
        return "无行为记录。"
    
    events = behavior.get("events", [])
    duration = behavior.get("session_duration_s", 0)
    
    if not isinstance(events, list):
        logger.warning(f"[NoteGen] events is not list: {type(events)}")
        return f"会话时长约 {duration} 秒，无具体操作记录。"
    
    if not events:
        return f"会话时长约 {duration} 秒，无具体操作记录。"
    
    lines = [f"会话时长约 {duration} 秒，共 {len(events)} 个操作事件："]
    action_map = {"play": "点击播放", "pause": "点击暂停", "step": "点击单步", "reset": "点击重置"}
    
    for idx, ev in enumerate(events):
        if not isinstance(ev, dict):
            logger.warning(f"[NoteGen] Event {idx} is not dict: {type(ev)}")
            continue
        
        try:
            t = ev.get("t", 0)
            etype = ev.get("type", "")
            data = ev.get("data") or {}
            
            if etype == "session_start":
                continue
            elif etype == "algorithm_switch":
                lines.append(f"  [{t}s] 切换算法 → {data.get('algorithm', '')}")
            elif etype == "function_change":
                lines.append(f"  [{t}s] 切换目标函数 → {data.get('value', '')}")
            elif etype == "custom_function":
                lines.append(f"  [{t}s] 输入自定义函数：{data.get('expr', '')}")
            elif etype == "param_change":
                lines.append(f"  [{t}s] 调整参数 {data.get('param', '')} = {data.get('value', '')}")
            elif etype == "control":
                lines.append(f"  [{t}s] {action_map.get(data.get('action', ''), data.get('action', ''))}")
            elif etype == "view_switch":
                lines.append(f"  [{t}s] 切换视图 → {data.get('view', '')}")
            elif etype == "upload_csv":
                lines.append(f"  [{t}s] 上传数据文件 → {data.get('file_name', '')}")
            elif etype == "dataset_preset_change":
                lines.append(f"  [{t}s] 切换预设数据集 → {data.get('preset', '')}")
            elif etype == "dataset_reset_default":
                lines.append(f"  [{t}s] 重置为默认数据集（样本数 {data.get('sample_count', '')}）")
            elif etype == "apply_columns":
                lines.append(f"  [{t}s] 应用列映射（x={data.get('x_col', '')}, y={data.get('y_col', '')}, label={data.get('label_col', '')}）")
            elif etype == "custom_map_apply":
                lines.append("  [" + str(t) + "s] 应用自定义核映射表达式")
            elif etype == "run_lift_animation":
                lines.append("  [" + str(t) + "s] 执行升维动画")
            elif etype == "plane_adjust":
                lines.append(f"  [{t}s] 调整超平面参数 {data.get('control', '')} = {data.get('value', '')}")
            else:
                lines.append(f"  [{t}s] {etype}")
        except Exception as e:
            logger.error(f"[NoteGen] Error processing event {idx}: {e}")
            continue
    
    return "\n".join(lines)


def _index_in_iteration_log(iteration_log: list, row: dict) -> int | None:
    """按 iteration 字段在完整日志中定位行下标。"""
    if "iteration" not in row:
        return None
    target = row["iteration"]
    for i, r in enumerate(iteration_log):
        if isinstance(r, dict) and r.get("iteration") == target:
            return i
    return None


def _summarize_iterations(iteration_log: list, max_rows: int = 27) -> str:
    """提炼迭代日志为紧凑文本，保留关键节点；区间收缩类附带相邻步收缩比。"""
    if not iteration_log or not isinstance(iteration_log, list):
        logger.debug(f"[NoteGen] iteration_log invalid: type={type(iteration_log)}, empty={not iteration_log}")
        return "无迭代数据（用户未运行算法）。"
    
    total = len(iteration_log)
    if total <= max_rows:
        rows = iteration_log
    else:
        mid_count = max_rows - 6
        step = max(1, (total - 6) // max(1, mid_count))
        mid = iteration_log[3: total - 3: step][:mid_count]
        rows = iteration_log[:3] + mid + iteration_log[-3:]
    
    lines = [f"共 {total} 次迭代，以下为关键节点（含可计算的相邻步信息）："]
    for idx, row in enumerate(rows):
        if not isinstance(row, dict):
            logger.warning(f"[NoteGen] Row {idx} is not dict: {type(row)}")
            continue
        
        parts: list[str] = []
        try:
            if "iteration" in row:
                parts.append(f"第{row['iteration']}步")
            if "algorithm" in row:
                parts.append(str(row["algorithm"]))
            if "a" in row and "b" in row:
                try:
                    a, b = float(row["a"]), float(row["b"])
                    length = float(row.get("length", abs(b - a)))
                    parts.append(f"区间[{a:.4f}, {b:.4f}] 长度={length:.4f}")
                    pos = _index_in_iteration_log(iteration_log, row)
                    if pos is not None and pos > 0:
                        pr = iteration_log[pos - 1]
                        if isinstance(pr, dict) and "a" in pr and "b" in pr:
                            try:
                                pa, pb = float(pr["a"]), float(pr["b"])
                                plen = float(pr.get("length", abs(pb - pa)))
                                if plen > 0:
                                    parts.append(f"收缩比(相对完整日志中前一步)={length / plen:.6f}")
                            except (ValueError, TypeError):
                                pass
                except (ValueError, TypeError) as e:
                    logger.warning(f"[NoteGen] Failed to parse a/b: {e}")
            if "x" in row:
                try:
                    parts.append(f"x={float(row['x']):.6f}")
                except (ValueError, TypeError):
                    pass
            if "f_x" in row:
                try:
                    parts.append(f"f(x)={float(row['f_x']):.6f}")
                except (ValueError, TypeError):
                    pass
            if "df_x" in row and row["df_x"] is not None:
                try:
                    parts.append(f"f'(x)={float(row['df_x']):.6f}")
                except (ValueError, TypeError):
                    pass
            if row.get("is_complete"):
                reason = row.get("termination_reason") or ("已收敛" if row.get("has_converged") else "已终止")
                parts.append(f"[{reason}]")
            
            if parts:
                lines.append("  " + "  ".join(parts))
        except Exception as e:
            logger.error(f"[NoteGen] Error processing row {idx}: {e}")
            continue
    
    return "\n".join(lines)


async def generate_experiment_note(
    experiment_key: str,
    experiment_data: dict[str, Any],
) -> tuple[str, str]:
    """
    调用 LLM 生成实验笔记，返回 (title, content)。
    content 使用 Markdown 格式，支持 LaTeX 公式。
    """
    from langchain_deepseek import ChatDeepSeek
    from pydantic import BaseModel, Field

    logger.info(f"[NoteGen] Starting note generation for experiment: {experiment_key}")
    logger.debug(f"[NoteGen] Input data keys: {list(experiment_data.keys())}")

    class NoteSchema(BaseModel):
        title: str = Field(
            ...,
            description=(
                "笔记标题。格式：算法名或实验名 — 目标函数或问题描述 + 实验记录。"
                "含数学对象时须用 LaTeX 行内公式 $...$，如：斐波那契数列法 — $f(x)=\\sin(x)+0.1x^2$ 实验记录。"
                "总长度建议 15～90 个字符（含公式）。"
            ),
        )
        content: str = Field(
            ...,
            description=(
                "完整实验报告正文；总字数不少于约 1950 汉字；覆盖结构模板各章节且顺序一致；"
                "禁止使用 # 和 * 号；章节标题用【】；数学公式用 LaTeX；表格用 Markdown | 语法。"
            ),
        )

    try:
        try:
            llm = ChatDeepSeek(
                model=settings.DEEPSEEK_MODEL,
                temperature=0.28,
                api_key=settings.DEEPSEEK_API_KEY,
                model_kwargs={"max_tokens": 6144},
            )
        except TypeError:
            llm = ChatDeepSeek(
                model=settings.DEEPSEEK_MODEL,
                temperature=0.28,
                api_key=settings.DEEPSEEK_API_KEY,
            )
        logger.info(f"[NoteGen] LLM initialized: {settings.DEEPSEEK_MODEL}")
    except Exception as e:
        logger.error(f"[NoteGen] Failed to initialize LLM: {e}")
        raise

    label = _EXPERIMENT_DOCS_MAP.get(experiment_key, {}).get("label", experiment_key)
    guide = _load_guide(experiment_key)
    template = _EXPERIMENT_TEMPLATES.get(experiment_key, _DEFAULT_TEMPLATE)

    logger.info(f"[NoteGen] Experiment label: {label}, guide loaded: {len(guide) > 0}")

    # 数据类型检查和安全处理
    if not isinstance(experiment_data, dict):
        logger.error(f"[NoteGen] experiment_data is not dict, type: {type(experiment_data)}, value: {experiment_data}")
        raise TypeError(f"experiment_data must be dict, got {type(experiment_data)}")
    
    # 安全提取各字段（不修改原始数据）
    behavior_raw = experiment_data.get("_behavior", {})
    iteration_log = experiment_data.get("iteration_log", [])
    
    logger.debug(f"[NoteGen] behavior_raw type: {type(behavior_raw)}, iteration_log type: {type(iteration_log)}")
    
    # 确保类型正确
    if not isinstance(behavior_raw, dict):
        logger.warning(f"[NoteGen] behavior_raw is not dict: {type(behavior_raw)}, resetting to {{}}")
        behavior_raw = {}
    
    if not isinstance(iteration_log, list):
        logger.warning(f"[NoteGen] iteration_log is not list: {type(iteration_log)}, resetting to []")
        iteration_log = []
    
    # 生成摘要
    behavior_summary = _summarize_behavior(behavior_raw)
    iteration_summary = _summarize_iterations(iteration_log)
    
    # 排除特殊字段，只保留参数数据
    params_data = {k: v for k, v in experiment_data.items() if k not in ("iteration_log", "_behavior")}
    
    # 安全序列化参数
    try:
        params_str = json.dumps(params_data, ensure_ascii=False, indent=2)
        logger.debug(f"[NoteGen] params_str length: {len(params_str)}")
    except Exception as e:
        logger.error(f"[NoteGen] Failed to serialize params_data: {type(e).__name__}: {e}")
        params_str = json.dumps({
            "error": f"参数序列化失败: {type(e).__name__}",
            "params_count": len(params_data)
        }, ensure_ascii=False, indent=2)
    
    logger.debug(f"[NoteGen] Processed data - iteration_log entries: {len(iteration_log)}, params keys: {list(params_data.keys())}")

    template_for_prompt = template + _TEMPLATE_ENRICHERS.get(experiment_key, "")
    if experiment_key == "linear-programming.simplex":
        _nv = params_data.get("num_vars")
        _mv = params_data.get("num_constraints")
        template_for_prompt = template_for_prompt.replace("{n}", str(_nv) if _nv is not None else "（未记录）").replace(
            "{m}", str(_mv) if _mv is not None else "（未记录）"
        )

    system_prompt = (
        "你是一名优化方法课程助教，负责为学生生成客观、准确、可评阅的完整实验记录报告。\n"
        "写作规范（每条必须严格遵守）：\n"
        "1. 禁止使用 Markdown 标题符号（#）和加粗符号（*或**），禁止使用无序列表符号（-或*）。\n"
        "   章节标题用【】括起来单独成行，如：【实验参数】\n"
        "   列表项直接用数字序号（1. 2. 3.）或中文顿号分隔，不用符号开头。\n"
        "2. 数学公式必须用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$。\n"
        "   普通文本中的数字不要加 $，只有数学符号、变量、公式才用 LaTeX。\n"
        "3. 只写实验数据支持的内容。数值必须与提供的数据完全一致，不得捏造或估算。\n"
        "   若某项数据缺失，直接写'未记录'，不做推断。\n"
        "4. 禁止使用套话和 AI 腔调，包括但不限于：\n"
        "   '本次实验''通过本实验''可以看出''值得注意的是''综上所述''总的来说'\n"
        "   '验证了''体现了''充分说明''清晰展示''令人满意'等修辞性短语。\n"
        "5. 语言风格：陈述句为主，直接给出数据和结论，不加修饰。\n"
        "   例如：'黄金分割法经 12 次迭代后区间长度收缩至 0.0008，收缩比稳定在 0.618。'\n"
        "6. 严格按照结构模板的章节顺序撰写，不增删章节，不改变章节名称。\n"
        "7. 笔记标题须含算法/实验名与目标函数或问题简述；含函数或约束时须用 LaTeX，如：\n"
        "   '黄金分割法 — $f(x)=x^2-4x+4$ 实验记录'\n"
        "   '单纯形法 — 2变量3约束最大化实验记录'\n"
        "8. 表格使用 Markdown 表格语法（| 符号），这是唯一允许使用的 Markdown 格式。\n"
        "9. 篇幅：正文总字数不少于约 1950 汉字；各【】章节须有实质正文。\n"
        "10. 主结论章节须含理论对照与数据核对；有行为记录时在分析或「操作与现象对照」中体现联系。\n"
        "11. 数字须来自所给数据；缺失写未记录。\n"
        "12. 按本实验【结构模板】撰写，勿套用其他实验章节。\n"
    )
    if guide:
        system_prompt += f"\n参考实验指导书：\n{guide}\n"

    user_prompt = (
        f"实验页面：{label}\n"
        f"实验标识：{experiment_key}\n"
        "采用本实验对应【结构模板】，勿与其他实验混用。\n\n"
        f"【结构模板】（章节名称与顺序不可改）：\n{template_for_prompt}\n\n"
        f"【实验参数数据】：\n{params_str}\n\n"
        f"【迭代数据摘要】：\n{iteration_summary}\n\n"
        f"【用户操作行为记录】：\n{behavior_summary}\n\n"
        "格式强制要求：\n"
        "1. 正文禁止出现 # 号和 * 号（表格的 | 除外）。\n"
        "2. 章节标题用【】括起单独成行，如：【实验参数】。\n"
        "3. 数学变量和公式用 LaTeX $...$，普通数字不加 $。\n"
        "4. 列表项用 1. 2. 3. 序号，不用短横线。\n"
        "5. 不写套话，直接陈述数据和结论；同时满足上文【生成深度与篇幅要求】。\n"
        "请按以上要求生成笔记标题和完整正文。"
        f"{_USER_PROMPT_DEPTH}"
    )

    logger.info(f"[NoteGen] System prompt length: {len(system_prompt)}, User prompt length: {len(user_prompt)}")

    try:
        logger.info("[NoteGen] Creating structured LLM...")
        structured_llm = llm.with_structured_output(NoteSchema)
        logger.info("[NoteGen] Structured LLM created successfully, preparing to call ainvoke...")
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        logger.debug(f"[NoteGen] Messages prepared: {len(messages)} messages, total length: {sum(len(m.get('content', '')) for m in messages)}")
        
        result: NoteSchema = await structured_llm.ainvoke(messages)
        
        logger.info(f"[NoteGen] LLM response received successfully")
        logger.debug(f"[NoteGen] Result type: {type(result)}, title: {result.title[:50] if result.title else 'EMPTY'}...")
        logger.debug(f"[NoteGen] Content length: {len(result.content)}")
        
        if not result.title or not result.content:
            logger.error(f"[NoteGen] LLM returned empty title or content: title_empty={not result.title}, content_empty={not result.content}")
            raise ValueError("LLM returned empty title or content")
        
        logger.info(f"[NoteGen] Note generation completed: title_len={len(result.title)}, content_len={len(result.content)}")
        return result.title, result.content
        
    except Exception as e:
        logger.error(f"[NoteGen] LLM call failed: {type(e).__name__}: {str(e)[:200]}", exc_info=True)
        raise
