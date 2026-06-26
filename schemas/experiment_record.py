from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ExperimentRecordCreate(BaseModel):
    alias: str = Field(..., min_length=1, max_length=255, description="用户为本次保存起的别名")
    source_page: str = Field(..., description="实验来源页面标识，如 line-search.range_search.observation")
    payload: dict[str, Any] = Field(
        ...,
        description="实验数据：算法名称、测试函数、初始参数状态、追踪的迭代键值等",
    )


class ExperimentRecordListItem(BaseModel):
    id: int
    alias: str
    created_at: datetime
    source_page: str

    class Config:
        from_attributes = True


class ExperimentRecordDetail(BaseModel):
    id: int
    alias: str
    source_page: str
    payload: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class ExperimentRecordAliasUpdate(BaseModel):
    alias: str = Field(..., min_length=1, max_length=255, description="更新实验记录别名")
