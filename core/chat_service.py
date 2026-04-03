"""
聊天会话服务 - 管理会话隔离、滑动窗口和上下文记忆
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.chat_session import ChatSession
from models.chat_message import ChatMessage
import settings


class ChatService:
    """聊天会话管理服务"""

    WINDOW_ROUNDS = settings.CHAT_HISTORY_WINDOW_ROUNDS
    WINDOW_MESSAGES = WINDOW_ROUNDS * 2  # 每轮2条消息(user+assistant)

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_active_session(self, user_id: int, page_id: str) -> Optional[dict]:
        """
        获取当前页面的活跃会话及窗口内消息
        Returns:
            会话信息及窗口内消息列表，无活跃会话返回None
        """
        # 查询活跃会话
        result = await self.db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .where(ChatSession.page_id == page_id)
            .where(ChatSession.is_active == True)
        )
        session = result.scalar_one_or_none()

        if not session:
            return None

        # 查询窗口内的活跃消息
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .where(ChatMessage.is_active == True)
            .order_by(ChatMessage.sequence_number.asc())
        )
        messages = result.scalars().all()

        return {
            "id": str(session.id),
            "page_id": session.page_id,
            "message_count": session.message_count,
            "created_at": session.created_at,
            "messages": [
                {
                    "id": str(msg.id),
                    "role": msg.role,
                    "content": msg.content,
                    "text_blocks": msg.text_blocks,
                    "highlight_ids": msg.highlight_ids,
                    "sequence_number": msg.sequence_number,
                    "created_at": msg.created_at,
                }
                for msg in messages
            ],
        }

    async def create_session(self, user_id: int, page_id: str) -> ChatSession:
        """
        创建新会话，自动关闭该页面所有旧会话
        """
        # 软删除该页面所有活跃会话
        await self.db.execute(
            update(ChatSession)
            .where(ChatSession.user_id == user_id)
            .where(ChatSession.page_id == page_id)
            .where(ChatSession.is_active == True)
            .values(is_active=False, deleted_at=datetime.now())
        )

        # 创建新会话
        session = ChatSession(
            user_id=user_id, page_id=page_id, is_active=True, message_count=0
        )
        self.db.add(session)
        await self.db.flush()  # 获取ID

        return session

    async def save_message(
        self,
        session_id: UUID,
        role: str,
        content: str,
        highlight_ids: Optional[list] = None,
        text_blocks: Optional[list] = None,
    ) -> ChatMessage:
        """
        保存消息并递增会话计数器
        """
        # 获取会话并递增计数器
        result = await self.db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        session = result.scalar_one()
        session.message_count += 1

        # 创建消息
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            text_blocks=text_blocks,
            highlight_ids=highlight_ids,
            sequence_number=session.message_count,
            is_active=True,
        )
        self.db.add(message)

        return message

    async def apply_sliding_window(self, session_id: UUID) -> int:
        """
        应用滑动窗口，标记窗口外的消息为非活跃
        Returns:
            被标记为非活跃的消息数量
        """
        # 获取当前消息总数
        result = await self.db.execute(
            select(ChatSession.message_count).where(ChatSession.id == session_id)
        )
        total = result.scalar()

        if total <= self.WINDOW_MESSAGES:
            return 0

        # 计算截断点
        cutoff = total - self.WINDOW_MESSAGES

        # 标记早期消息为非活跃
        result = await self.db.execute(
            update(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .where(ChatMessage.sequence_number <= cutoff)
            .where(ChatMessage.is_active == True)
            .values(is_active=False)
        )

        return result.rowcount

    async def get_window_messages(self, session_id: UUID) -> list:
        """
        获取窗口内的活跃消息（用于构建上下文）
        """
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .where(ChatMessage.is_active == True)
            .order_by(ChatMessage.sequence_number.asc())
        )
        return result.scalars().all()

    async def reset_page_sessions(self, user_id: int, page_id: str) -> int:
        """
        软删除用户在该页面的所有活跃会话
        Returns:
            被重置的会话数量
        """
        result = await self.db.execute(
            update(ChatSession)
            .where(ChatSession.user_id == user_id)
            .where(ChatSession.page_id == page_id)
            .where(ChatSession.is_active == True)
            .values(is_active=False, deleted_at=datetime.now())
        )

        return result.rowcount

    @staticmethod
    async def cleanup_old_messages(db: AsyncSession) -> int:
        """
        清理超过保留期的非活跃消息
        Returns:
            删除的消息数量
        """
        cutoff_date = datetime.now() - timedelta(
            days=settings.CHAT_MESSAGE_RETENTION_DAYS
        )

        result = await db.execute(
            delete(ChatMessage)
            .where(ChatMessage.is_active == False)
            .where(ChatMessage.created_at < cutoff_date)
        )

        return result.rowcount
