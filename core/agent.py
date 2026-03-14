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

# page_id → 对应的文档文件映射
_DOCS_MAP = {
    "range_search_observation": {
        "guide": "docs/实验指导书/区间收缩法-流程观察.txt",
        "formulas": [
            "docs/公式/黄金分割法.txt",
            "docs/公式/斐波那契数列法.txt",
            "docs/公式/二分法.txt",
        ],
    },
    "point_search_observation": {
        "guide": "docs/实验指导书/点搜索-流程观察.txt",
        "formulas": [
            "docs/公式/梯度下降法.txt",
            "docs/公式/牛顿法.txt",
            "docs/公式/割线法.txt",
        ],
    },
    "svm_smo_index": {
        "guide": "docs/实验指导书/SVM-SMO-课程主页.txt",
        "formulas": [
            "docs/公式/SVM基础概念.txt",
        ],
    },
    "svm_smo_kernel_trick": {
        "guide": "docs/实验指导书/SVM-核技巧-三维可视化.txt",
        "formulas": [
            "docs/公式/SVM核技巧.txt",
        ],
    },
}


def _load_docs(page_id: str) -> str:
    mapping = _DOCS_MAP.get(page_id)
    if not mapping:
        return ""

    parts = []

    guide_path = os.path.join(_project_root, mapping["guide"])
    if os.path.exists(guide_path):
        with open(guide_path, "r", encoding="utf-8") as f:
            parts.append("【实验指导书】\n" + f.read().strip())

    for formula_path in mapping["formulas"]:
        full_path = os.path.join(_project_root, formula_path)
        if os.path.exists(full_path):
            name = os.path.splitext(os.path.basename(formula_path))[0]
            with open(full_path, "r", encoding="utf-8") as f:
                parts.append(f"【{name}】\n" + f.read().strip())

    return "\n\n".join(parts)


async def ask_assistant(message: str, page_id: str, guidebook: str, buttons: list[dict]) -> AssistantSchema:
    buttons_desc = "\n".join(
        [f"- ID: `{b['id']}`, 描述: {b['description']}, 类型: {b['type']}" for b in buttons]
    )

    docs_content = _load_docs(page_id)

    system_prompt = (
        "你是一个流程观察页面的操作助手，帮助用户理解和使用该页面的各项功能。\n\n"
        f"以下是页面指导书：\n{guidebook}\n\n"
        f"以下是页面上所有可用的按钮/控件及其信息：\n{buttons_desc}\n\n"
    )

    if docs_content:
        system_prompt += f"以下是实验相关的文档资料（包含实验步骤说明和算法公式）：\n{docs_content}\n\n"

    system_prompt += (
        "用户会向你提问关于如何使用该页面的问题，也可能询问算法原理。"
        "请根据指导书、按钮信息和文档资料回答用户的问题。\n\n"
        "回答要求：\n"
        '1. "text" 字段：简洁、清晰地回答用户问题，给出操作步骤说明\n'
        '2. "highlight_ids" 字段：一个按钮ID的数组，按操作顺序排列，用于在页面上依次高亮标记对应的按钮以引导用户操作\n\n'
        "注意：\n"
        "- highlight_ids 中的 ID 必须来自上述可用按钮列表中的 ID\n"
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
