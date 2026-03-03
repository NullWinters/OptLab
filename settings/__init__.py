import os
from dotenv import load_dotenv

# 显式指定项目根目录下的 .env 文件路径
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_project_root, ".env"))

# database
DB_URI = ""

# register
REGISTER_USERNAME = {
    "min_length": 3,
    "max_length": 50
}
REGISTER_PASSWORD = {
    "min_length": 8,
    "max_length": 50
}

# LLM
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_TEMPERATURE = float(os.getenv("DEEPSEEK_TEMPERATURE", "0.7"))