import os
from datetime import timedelta
from dotenv import load_dotenv

# 显式指定项目根目录下的 .env 文件路径
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(str(os.path.join(str(_project_root), ".env")))

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

# Admin auth / jwt（独立于主用户系统，过期时间更长）
ADMIN_JWT_SECRET = os.getenv("OPTLAB_ADMIN_JWT_SECRET", "")
ADMIN_TOKEN_EXPIRE_HOURS = int(os.getenv("OPTLAB_ADMIN_TOKEN_EXPIRE_HOURS", "168"))
ADMIN_TOKEN_EXPIRE_DELTA = timedelta(hours=ADMIN_TOKEN_EXPIRE_HOURS)

# LLM (OpenAI-compatible)
# 支持任意 OpenAI-compatible 服务（DeepSeek / OpenAI / 本地模型等）
# 优先使用 LLM_* 变量，未设置时回退到旧的 DEEPSEEK_* 变量
LLM_BASE_URL = os.getenv("LLM_BASE_URL") or ""
LLM_MODEL_ID = os.getenv("LLM_MODEL_ID") or os.getenv("DEEPSEEK_MODEL") or "deepseek-chat"
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("DEEPSEEK_API_KEY") or "CHANGE_ME_LLM_KEY"
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE") or os.getenv("DEEPSEEK_TEMPERATURE") or "0.7")

# 向后兼容别名
DEEPSEEK_API_KEY = LLM_API_KEY
DEEPSEEK_MODEL = LLM_MODEL_ID
DEEPSEEK_TEMPERATURE = LLM_TEMPERATURE

# 聊天历史配置
CHAT_HISTORY_WINDOW_ROUNDS = int(os.getenv("CHAT_HISTORY_WINDOW_ROUNDS", "10"))
CHAT_MESSAGE_RETENTION_DAYS = int(os.getenv("CHAT_MESSAGE_RETENTION_DAYS", "30"))
