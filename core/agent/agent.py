from langchain_deepseek import ChatDeepSeek
from langchain.agents import create_agent
from langchain_core.tools import tool
from schemas.agent import SimpleSchema
from dotenv import load_dotenv
from enum import Enum
import os
from pprint import pprint

load_dotenv()

llm = ChatDeepSeek(
    model="deepseek-chat",
    temperature=0.5,
    api_key=os.getenv("DEEPSEEK_API_KEY"),
)


@tool(parse_docstring=True)
def instruction_search(instruction: str) -> str:
    """读取指定实验指导书文本内容。

    Args:
        instruction: 实验指导书文件名（例如：`区间收缩法-流程观察.txt`）。

    Returns:
        实验指导书内容文本；若发生错误则返回以 `Error:` 开头的字符串。
    """
    try:
        instruction_path: str = "../../docs/实验指导书"
        InstructionEnum = Enum("InstructionEnum", {f"{i}": i for i in os.listdir(instruction_path)})
        base_dir = os.path.abspath(instruction_path)
        file_path = os.path.abspath(os.path.join(base_dir, instruction))

        if not file_path.startswith(base_dir + os.sep):
            return "Error: invalid path (possible path traversal)."

        if not os.path.isfile(file_path):
            return f"Error: file not found: {instruction}\nAvailable instructions: {', '.join(InstructionEnum.__members__.keys())}"

        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"Error:{e}"


@tool(parse_docstring=True)
def formula_search(formula: str) -> str:
    """读取指定算法的公式文本内容。

    Args:
        formula: 算法公式文件名（例如：`黄金分割法.txt`）。

    Returns:
        算法公式文本；若发生错误则返回以 `Error:` 开头的字符串。
    """
    try:
        formula_path: str = "../../docs/公式"
        FormulaEnum = Enum("FormulaEnum", {f"{i}": i for i in os.listdir(formula_path)})
        base_dir = os.path.abspath(formula_path)
        file_path = os.path.abspath(os.path.join(base_dir, formula))

        if not file_path.startswith(base_dir + os.sep):
            return "Error: invalid path (possible path traversal)."

        if not os.path.isfile(file_path):
            return f"Error: file not found: {formula}\nAvailable formulas: {', '.join(FormulaEnum.__members__.keys())}"

        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"Error:{e}"

SYSTEM_PROMPT ="""
你是《最优化理论与方法》课程助教，负责回答学生如何开展实验。
当学生询问实验步骤或需要实验指导时，查阅对应实验的指导书并回复。
当学生询问实验原理时，查阅对应算法的公式并回复。
"""

agent = create_agent(
    model=llm,
    system_prompt=SYSTEM_PROMPT,
    # response_format=SimpleSchema,
    tools=[instruction_search, formula_search],
)

# if __name__ == "__main__":
#     # print(instruction_search.invoke({"instruction": "区间法-流程观察.txt"}))
#
#     # You can now call agent.invoke / agent.ainvoke as needed.
#     resp = agent.invoke({"input": "我现在正在做区间收缩法的流程观察实验，怎么做黄金分割法实验？"})
#     pprint(resp)
