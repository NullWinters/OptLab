import asyncio
import os
import sys


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from sqlalchemy import inspect, text
from models import Base, engine  # noqa: E402


def migrate_chat_message_text_blocks(connection):
    """为已存在的 chat_message 表追加 text_blocks 列（JSON）。"""
    inspector = inspect(connection)
    if "chat_message" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("chat_message")}
    if "text_blocks" in cols:
        return
    dialect = connection.dialect.name
    if dialect == "postgresql":
        connection.execute(
            text("ALTER TABLE chat_message ADD COLUMN text_blocks JSON")
        )
    else:
        connection.execute(
            text("ALTER TABLE chat_message ADD COLUMN text_blocks TEXT")
        )


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(migrate_chat_message_text_blocks)

        # 创建额外的数据库索引
        await conn.run_sync(create_indexes)


def create_indexes(connection):
    """创建优化查询的数据库索引"""
    inspector = inspect(connection)
    dialect = connection.dialect.name

    # chat_session 表索引
    if "chat_session" in inspector.get_table_names():
        # 复合索引：支持按用户+页面+活跃状态查询
        connection.execute(
            text("""
                CREATE INDEX IF NOT EXISTS idx_chat_session_lookup 
                ON chat_session(user_id, page_id, is_active)
            """)
        )

        # 支持按用户查询会话列表
        connection.execute(
            text("""
                CREATE INDEX IF NOT EXISTS idx_chat_session_user 
                ON chat_session(user_id, is_active, updated_at)
            """)
        )

    # chat_message 表索引
    if "chat_message" in inspector.get_table_names():
        # 支持滑动窗口查询（按会话+序号+活跃状态）
        connection.execute(
            text("""
                CREATE INDEX IF NOT EXISTS idx_chat_message_window 
                ON chat_message(session_id, sequence_number, is_active)
            """)
        )

        # 支持定时清理查询（按活跃状态+创建时间）
        connection.execute(
            text("""
                CREATE INDEX IF NOT EXISTS idx_chat_message_cleanup 
                ON chat_message(is_active, created_at)
            """)
        )


if __name__ == "__main__":
    asyncio.run(init_db())
