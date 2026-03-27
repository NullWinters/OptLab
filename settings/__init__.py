import os
from datetime import timedelta
from dotenv import load_dotenv

# 显式指定项目根目录下的 .env 文件路径
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_project_root, ".env"))

# database：默认使用 SQLite，可通过 OPTLAB_DB_URI 覆盖为 PostgreSQL 等
DB_URI = os.getenv(
    "OPTLAB_DB_URI",
    "sqlite+aiosqlite:///./optlab.db",
)

# register
REGISTER_USERNAME = {
    "min_length": 3,
    "max_length": 50,
}
REGISTER_PASSWORD = {
    "min_length": 8,
    "max_length": 50,
}

# auth / jwt
SECRET_KEY = os.getenv("OPTLAB_SECRET_KEY", "CHANGE_ME_TO_A_SECURE_RANDOM_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("OPTLAB_ACCESS_TOKEN_MINUTES", "30"))
ACCESS_TOKEN_EXPIRE_DELTA = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

# LLM
# 为了方便本地启动，如果未设置环境变量则给一个占位符字符串，
# 这样 AI 助手相关代码可以正常初始化；真正调用 DeepSeek 时仍需要替换为真实密钥。
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "CHANGE_ME_DEEPSEEK_KEY")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_TEMPERATURE = float(os.getenv("DEEPSEEK_TEMPERATURE", "0.7"))

# 聊天历史配置
CHAT_HISTORY_WINDOW_ROUNDS = int(os.getenv("CHAT_HISTORY_WINDOW_ROUNDS", "10"))
CHAT_MESSAGE_RETENTION_DAYS = int(os.getenv("CHAT_MESSAGE_RETENTION_DAYS", "30"))
