from langchain_deepseek import ChatDeepSeek
from langchain.agents import create_agent
from schemas.agent import SimpleSchema, AssistantSchema
import settings

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


async def ask_assistant(message: str, guidebook: str, buttons: list[dict]) -> AssistantSchema:
    buttons_desc = "\n".join(
        [f"- ID: `{b['id']}`, 描述: {b['description']}, 类型: {b['type']}" for b in buttons]
    )

    system_prompt = (
        "你是一个流程观察页面的操作助手，帮助用户理解和使用该页面的各项功能。\n\n"
        f"以下是页面指导书：\n{guidebook}\n\n"
        f"以下是页面上所有可用的按钮/控件及其信息：\n{buttons_desc}\n\n"
        "用户会向你提问关于如何使用该页面的问题。请根据指导书和按钮信息回答用户的问题。\n\n"
        "回答要求：\n"
        '1. "text" 字段：简洁、清晰地回答用户问题，给出操作步骤说明\n'
        '2. "highlight_ids" 字段：一个按钮ID的数组，按操作顺序排列，用于在页面上依次高亮标记对应的按钮以引导用户操作\n\n'
        "注意：\n"
        "- highlight_ids 中的 ID 必须来自上述可用按钮列表中的 ID\n"
        "- 数组顺序代表用户应该按顺序操作的步骤\n"
        "- 如果用户的问题与页面操作无关，text 中礼貌回应，highlight_ids 返回空数组"
    )

    structured_llm = llm.with_structured_output(AssistantSchema)
    result = await structured_llm.ainvoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message},
    ])
    return result
