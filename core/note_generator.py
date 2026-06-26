"""实验笔记：按页面数据与行为记录调用模型生成正文。"""

import json
import logging
import os
from typing import Any

import settings

logger = logging.getLogger(__name__)

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# System Prompt
SYSTEM_PROMPT = """你是一个实验笔记生成助手。根据提供的实验数据生成完整实验笔记。

笔记必须包含以下四个部分（使用 Markdown 标题 ## 分隔）：

1. ## 数学原理
   结合实验数据与页面指导书（guidebook），给出本次实验的核心数学原理与关键推导公式，用 LaTeX 公式表示关键步骤。
   禁止在“## 数学原理”部分输出"待补充"；若缺失具体符号，请采用经典/通用写法，并用实验数据中的变量含义进行映射。

   【强制数学模板（优先使用）】
   __MATH_PRIMER__

2. ## 实验过程（可选）
   仅当用户操作记录中包含值得注意的操作（参数调整、算法切换等）时编写，简洁描述关键操作。

3. ## 实验数据
   使用 Markdown 表格或 LaTeX 展示实验数据。若迭代次数≤10步，全部列出；若较多，列出开头3步、结尾3步及中间2步关键点。
   所有数值必须与提供的数据完全一致，缺失写"待补充"。

4. ## 实验总结
   此部分预留为空白，只写"（由用户填写）"。

约束：禁止编造数据；禁止套话；使用标准 Markdown 表格语法。"""


def _truncate_iteration_log(experiment_data: dict, max_items: int = 40) -> dict:
    """仅对 iteration_log 做简单截断，不做任何计算。"""
    data = experiment_data.copy()
    iteration_log = data.get("iteration_log", [])

    if len(iteration_log) > max_items:
        # 保留开头、中间、结尾
        head = iteration_log[:10]
        tail = iteration_log[-5:]
        mid_start = len(iteration_log) // 2 - 2
        mid = iteration_log[mid_start : mid_start + 4] if mid_start > 10 else []

        truncated = (
            head + [{"note": f"... 省略 {len(iteration_log) - 19} 步 ..."}] + mid + tail
        )
        data["iteration_log"] = truncated
        data["_truncation_notice"] = f"原始 {len(iteration_log)} 步，已截断展示"

    return data


def _normalize_experiment_data(experiment_data: Any) -> dict[str, Any]:
    """统一前端上送结构：兼容 {experiment_data:{...}} 包装与异常类型。"""
    if isinstance(experiment_data, dict) and isinstance(
        experiment_data.get("experiment_data"), dict
    ):
        return experiment_data.get("experiment_data") or {}
    if isinstance(experiment_data, dict):
        return experiment_data
    return {}


async def generate_experiment_note(
    experiment_key: str,
    experiment_data: dict[str, Any],
    custom_prompt: str = None,
) -> tuple[str, str]:
    """
    调用 LLM 生成实验笔记，返回 (title, content)。
    content 使用 Markdown 格式，支持 LaTeX 公式。
    """
    from langchain_deepseek import ChatDeepSeek
    from pydantic import BaseModel, Field

    # 兼容外层包装
    experiment_data = _normalize_experiment_data(experiment_data)

    logger.info(f"[NoteGen] Starting note generation for experiment: {experiment_key}")

    class NoteSchema(BaseModel):
        content: str = Field(
            ...,
            description="实验笔记正文，必须包含 ## 数学原理、## 实验数据、## 实验总结 三个固定章节，可选 ## 实验过程",
        )

    # 初始化 LLM
    try:
        api_key = (settings.DEEPSEEK_API_KEY or "").strip()
        if not api_key or api_key == "CHANGE_ME_DEEPSEEK_KEY":
            raise ValueError("DEEPSEEK_API_KEY 未配置或仍为占位符，请在 .env 中设置有效密钥。")

        llm = ChatDeepSeek(
            model=settings.DEEPSEEK_MODEL,
            temperature=0.28,
            api_key=api_key,
            max_tokens=4096,
        )
        logger.info(f"[NoteGen] LLM initialized: {settings.DEEPSEEK_MODEL}")
    except Exception as e:
        logger.error(f"[NoteGen] Failed to initialize LLM: {e}")
        raise

    # 截断迭代日志（如果过长）
    truncated_data = _truncate_iteration_log(experiment_data)

    # JSON 序列化
    try:
        json_str = json.dumps(truncated_data, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"[NoteGen] JSON serialization failed: {e}")
        json_str = json.dumps(
            {"error": "数据序列化失败", "keys": list(experiment_data.keys())},
            ensure_ascii=False,
        )

    # 构建 User Prompt
    user_prompt = f"""【实验标识】：{experiment_key}

【实验数据（JSON）】：
```json
{json_str}
```

请生成实验笔记。"""

    # 使用自定义 prompt 或默认 system prompt
    system_prompt = custom_prompt if custom_prompt else SYSTEM_PROMPT

    logger.info(
        f"[NoteGen] System prompt length: {len(system_prompt)}, User prompt length: {len(user_prompt)}"
    )

    try:
        structured_llm = llm.with_structured_output(NoteSchema)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        result: NoteSchema = await structured_llm.ainvoke(messages)

        logger.info(f"[NoteGen] LLM response received successfully")

        if not result.content:
            logger.error(f"[NoteGen] LLM returned empty content")
            raise ValueError("LLM returned empty content")

        # 生成标题：从 experiment_key 和 algorithm 推断
        algorithm = experiment_data.get("algorithm", "实验")
        title = f"{algorithm} 实验记录"

        logger.info(
            f"[NoteGen] Note generation completed: content_len={len(result.content)}"
        )
        return title, result.content

    except Exception as e:
        logger.error(
            f"[NoteGen] LLM call failed: {type(e).__name__}: {str(e)[:200]}",
            exc_info=True,
        )
        raise
