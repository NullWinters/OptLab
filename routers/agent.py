"""
AI助手路由 - 支持上下文记忆的聊天会话管理
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.agent import ask_assistant
from core.auth import get_current_user
from core.chat_service import ChatService
from dependencies import get_session
from models.user import User
from schemas.agent import AssistantSchema
from schemas.chat import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionOut,
    ChatSessionQueryOut,
    ChatSessionReset,
)
import settings
from langchain_deepseek import ChatDeepSeek

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.get("/session", response_model=ChatSessionQueryOut)
async def get_ai_session(
        page_id: str = Query(..., description="页面标识符"),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_session),
):
    """
    获取当前用户在指定页面的活跃会话
    无论会话是否存在都返回200，通过exists字段标识状态
    """
    service = ChatService(db)
    session = await service.get_active_session(current_user.id, page_id)

    if not session:
        return {
            "exists": False,
            "id": None,
            "page_id": page_id,
            "message_count": 0,
            "created_at": None,
            "messages": [],
        }

    return {
        "exists": True,
        "id": str(session["id"]),
        "page_id": session["page_id"],
        "message_count": session["message_count"],
        "created_at": session["created_at"],
        "messages": session["messages"],
    }


@router.post("/session", response_model=dict)
async def create_ai_session(
        data: ChatSessionCreate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_session),
):
    """
    为当前页面创建新会话（自动关闭旧会话）
    用户发第一条消息时调用
    """
    service = ChatService(db)
    session = await service.create_session(current_user.id, data.page_id)
    await db.commit()

    return {
        "id": str(session.id),
        "page_id": session.page_id,
        "message_count": session.message_count,
        "created_at": session.created_at,
    }


@router.post("/session/reset")
async def reset_ai_session(
        data: ChatSessionReset,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_session),
):
    """
    软删除当前页面的所有活跃会话
    重置按钮调用
    """
    service = ChatService(db)
    count = await service.reset_page_sessions(current_user.id, data.page_id)
    await db.commit()

    return {"message": "会话已重置", "reset_count": count}


@router.post("/chat", response_model=ChatMessageResponse)
async def chat(
        data: ChatMessageCreate,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_session),
):
    """
    发送消息，支持上下文记忆
    提供session_id则使用上下文，不提供则无记忆
    """
    try:
        # 如果有session_id，使用上下文模式
        if data.session_id:
            service = ChatService(db)
            session_id = UUID(data.session_id)

            # 验证会话存在且属于当前用户
            session_data = await service.get_active_session(
                current_user.id, data.page_id
            )
            if not session_data or session_data["id"] != data.session_id:
                raise HTTPException(status_code=404, detail="会话不存在或已过期")

            # 保存用户消息
            await service.save_message(session_id, "user", data.message)

            # 应用滑动窗口
            await service.apply_sliding_window(session_id)
            await db.commit()

            # 获取窗口内消息构建上下文
            messages = await service.get_window_messages(session_id)
            history = [
                {"role": msg.role, "content": msg.content}
                for msg in messages[:-1]  # 排除刚保存的用户消息
            ]

            # 调用AI（带上下文）
            result = await _ask_with_context(
                message=data.message,
                page_id=data.page_id,
                guidebook=data.guidebook,
                buttons=data.buttons,
                history=history,
            )

            # 保存AI回复
            await service.save_message(
                session_id, "assistant", result.text, result.highlight_ids
            )
            await db.commit()

            return ChatMessageResponse(
                text=result.text,
                highlight_ids=result.highlight_ids,
                session_id=data.session_id,
            )

        else:
            # 无记忆模式（向后兼容）
            result = await ask_assistant(
                message=data.message,
                page_id=data.page_id,
                guidebook=data.guidebook,
                buttons=data.buttons,
            )

            return ChatMessageResponse(
                text=result.text, highlight_ids=result.highlight_ids, session_id=""
            )

    except HTTPException:
        raise
    except RuntimeError as e:
        return JSONResponse(status_code=503, content={"detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})


async def _ask_with_context(
        message: str, page_id: str, guidebook: str, buttons: list, history: list
) -> AssistantSchema:
    """
    带上下文调用AI助手
    """
    llm = ChatDeepSeek(
        model=settings.DEEPSEEK_MODEL,
        temperature=settings.DEEPSEEK_TEMPERATURE,
        api_key=settings.DEEPSEEK_API_KEY,
    )

    # 构建带上下文的系统提示
    buttons_desc = "\n".join(
        [
            f"- ID: `{b['id']}`, 描述: {b['description']}, 类型: {b['type']}"
            for b in buttons
        ]
    )

    system_prompt = (
        "你是一个流程观察页面的操作助手，帮助用户理解和使用该页面的各项功能。\n\n"
        f"以下是页面指导书：\n{guidebook}\n\n"
        f"以下是页面上所有可用的按钮/控件及其信息：\n{buttons_desc}\n\n"
    )

    system_prompt += (
        "以下是你和用户的对话历史（最近的对话）：\n"
        "请基于上下文继续回答用户问题。\n\n"
        "回答要求：\n"
        '1. "text" 字段：简洁、清晰地回答用户问题\n'
        '2. "highlight_ids" 字段：按钮ID数组，按操作顺序排列\n\n'
        "注意：\n"
        "- highlight_ids 中的 ID 必须来自可用按钮列表\n"
        "- 如果询问算法原理，highlight_ids 返回空数组\n"
        "- 如果问题无关，礼貌回应并返回空数组"
    )

    # 构建消息列表
    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    # 调用模型
    structured_llm = llm.with_structured_output(AssistantSchema)
    result = await structured_llm.ainvoke(messages)
    return result
