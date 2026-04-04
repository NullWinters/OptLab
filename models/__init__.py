from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import MetaData
from sqlalchemy.engine.url import make_url

from settings import DB_URI

url = make_url(DB_URI)
engine_kwargs = {
    "echo": True,
    "pool_pre_ping": True,
}

# 仅对支持连接池的数据库（如 PostgreSQL）启用池参数，避免 SQLite 报错
if url.get_backend_name().startswith("postgresql"):
    engine_kwargs.update(
        pool_size=10,
        max_overflow=10,
        pool_timeout=10,
        pool_recycle=1800,
    )

engine = create_async_engine(
    DB_URI,
    **engine_kwargs,
)

AsyncSessionFactory = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=True,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(column_0_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


from .user import User
from .experiment_record import ExperimentRecord
from .note_item import NoteItem
from .chat_session import ChatSession
from .chat_message import ChatMessage
