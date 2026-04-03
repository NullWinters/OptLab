"""
聊天会话相关的 Pydantic Schema
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field
from schemas.agent import ButtonInfo


class ChatMessageOut(BaseModel):
    """聊天消息输出"""

    id: str
    role: str
    content: str
    text_blocks: Optional[List[str]] = None
    highlight_ids: Optional[List[str]] = None
    sequence_number: int
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionOut(BaseModel):
    """聊天会话输出（包含窗口内消息）"""

    id: str
    page_id: str
    message_count: int
    created_at: datetime
    messages: List[ChatMessageOut]

    class Config:
        from_attributes = True


class ChatSessionQueryOut(BaseModel):
    """会话查询响应 - 包含 exists 标志"""

    exists: bool = Field(..., description="是否存在活跃会话")
    id: Optional[str] = Field(None, description="会话ID")
    page_id: str = Field(..., description="页面ID")
    message_count: int = Field(0, description="消息数量")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    messages: List[ChatMessageOut] = Field(default_factory=list, description="消息列表")

    class Config:
        from_attributes = True


class ChatSessionCreate(BaseModel):
    """创建会话请求"""

    page_id: str = Field(..., description="页面标识符")


class ChatSessionReset(BaseModel):
    """重置会话请求"""

    page_id: str = Field(..., description="页面标识符")


class ChatMessageCreate(BaseModel):
    """发送消息请求"""

    session_id: Optional[str] = Field(None, description="会话ID，不提供则无记忆")
    message: str = Field(..., description="用户消息")
    page_id: str = Field(..., description="页面标识符")
    guidebook: str = Field(..., description="页面指导书")
    buttons: List[ButtonInfo] = Field(..., description="可用按钮列表")
    graph_context: Optional[dict] = Field(default=None, description="页面图状态摘要")


class ChatMessageResponse(BaseModel):
    """聊天消息响应"""

    text: str = Field(..., description="AI回复内容")
    text_blocks: List[str] = Field(default_factory=list, description="可分段回复内容")
    highlight_ids: List[str] = Field(
        default_factory=list, description="需要高亮的按钮ID"
    )
    session_id: str = Field(..., description="会话ID")
