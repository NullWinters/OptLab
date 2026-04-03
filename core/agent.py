from langchain_deepseek import ChatDeepSeek
from langchain.agents import create_agent
from schemas.agent import SimpleSchema, AssistantSchema
import settings
import os

llm = ChatDeepSeek(
    model=settings.DEEPSEEK_MODEL,
    temperature=settings.DEEPSEEK_TEMPERATURE,
    api_key=settings.DEEPSEEK_API_KEY
)

agent = create_agent(
    model=llm,
    system_prompt="你是一个友好的智能助手",
    response_format=SimpleSchema
)

# 项目根目录
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _to_button_desc(buttons):
    lines = []
    for b in buttons:
        bid = b.get("id") if isinstance(b, dict) else getattr(b, "id", "")
        desc = b.get("description") if isinstance(b, dict) else getattr(b, "description", "")
        btype = b.get("type") if isinstance(b, dict) else getattr(b, "type", "normal")
        lines.append(f"- ID: `{bid}`, 描述: {desc}, 类型: {btype}")
    return "\n".join(lines)


async def ask_assistant(message: str, page_id: str, guidebook: str, buttons: list, graph_context: dict | None = None) -> AssistantSchema:
    buttons_desc = _to_button_desc(buttons)


    system_prompt = (
        "你是一个流程观察页面的操作助手，帮助用户理解和使用该页面的各项功能。\n\n"
        f"以下是页面指导书：\n{guidebook}\n\n"
        f"以下是页面上所有可用的UI元素（按钮、输入框、弹窗相关控件、SVG图元）及其信息：\n{buttons_desc}\n\n"
        f"以下是页面图形上下文（二维/三维场景摘要，可能为空）：\n{graph_context or {}}\n\n"
    )


    system_prompt += (
        "用户会向你提问关于如何使用该页面的问题，也可能询问算法原理。"
        "请根据指导书、按钮信息和文档资料回答用户的问题。\n\n"
        "回答要求：\n"
        '1. "text" 字段：简洁、清晰地回答用户问题，给出操作步骤说明\n'
        '2. "text_blocks" 字段：当需要分多步演示时，返回分段文本数组，每段一句或一小段\n'
        '3. "highlight_ids" 字段：一个UI元素ID数组（可包含按钮、输入框、弹窗控件、SVG图元），按操作顺序排列，用于页面依次高亮引导\n\n'
        "注意：\n"
        "- highlight_ids 中的 ID 必须来自上述可用UI元素列表中的 ID\n"
        "- type=normal 的控件表示必须用户点击后再进入下一步；type=optional 的控件可建议点击但不强制\n"
        "- 数组顺序代表用户应该按顺序操作的步骤\n"
        "- 如果用户询问算法原理等知识性问题，text 中回答问题，highlight_ids 返回空数组\n"
        "- 如果用户的问题与页面操作和算法均无关，text 中礼貌回应，highlight_ids 返回空数组"
    )

    structured_llm = llm.with_structured_output(AssistantSchema)
    result = await structured_llm.ainvoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message},
    ])
    return result
