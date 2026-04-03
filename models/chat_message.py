from datetime import datetime
from typing import Optional
from uuid import uuid4, UUID

from sqlalchemy import ForeignKey, Boolean, DateTime, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from . import Base


class ChatMessage(Base):
    """聊天消息表，仅存储对话轮次(user/assistant)"""

    __tablename__ = "chat_message"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("chat_session.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    text_blocks: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    highlight_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), nullable=False
    )
