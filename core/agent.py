from langchain_deepseek import ChatDeepSeek
from langchain.agents import create_agent
from schemas.agent import SimpleSchema
from dotenv import load_dotenv
import os

load_dotenv()

llm = ChatDeepSeek(
    model="deepseek-chat",
    temperature=1.0,
    api_key=os.getenv("DEEPSEEK_API_KEY")
)

agent = create_agent(
    model=llm,
    system_prompt="你是一个友好的智能助手",
    response_format=SimpleSchema
)


# async def hello():
#     result = await agent.ainvoke(
#         {
#             "messages": [
#                 {"role": "user", "content": "你好"}
#             ]
#         }
#     )
#
#     return result["structured_response"]
#
#
# async def main():
#     print(await hello())
#
#
# if __name__ == "__main__":
#     import asyncio
#
#     asyncio.run(main())
