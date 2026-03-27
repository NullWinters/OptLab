from datetime import datetime

from pydantic import BaseModel, Field, field_validator
import html
import re


def _sanitize(s: str) -> str:
    """对输入字符串做基础 HTML 转义，防止存储型 XSS。"""
    return html.escape(str(s))


class NoteItemCreate(BaseModel):
    experiment_key: str = Field(..., max_length=255)
    title: str = Field(default="", max_length=500)
    content: str = Field(default="")
    sort_order: int = Field(default=0)

    @field_validator("experiment_key", mode="before")
    @classmethod
    def sanitize_key(cls, v: str) -> str:
        return _sanitize(v)

    @field_validator("title", mode="before")
    @classmethod
    def sanitize_title(cls, v: str) -> str:
        return _sanitize(v)

    @field_validator("content", mode="before")
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        # 内容允许 LaTeX / Markdown，仅转义 HTML 危险字符
        return _sanitize(v)


class NoteItemUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    content: str | None = Field(default=None)
    sort_order: int | None = Field(default=None)

    @field_validator("title", mode="before")
    @classmethod
    def sanitize_title(cls, v):
        if v is None:
            return v
        return _sanitize(v)

    @field_validator("content", mode="before")
    @classmethod
    def sanitize_content(cls, v):
        if v is None:
            return v
        return _sanitize(v)


class NoteItemOut(BaseModel):
    id: int
    experiment_key: str
    title: str
    content: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
