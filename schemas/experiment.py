from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ExperimentNoteBase(BaseModel):
    reflection: str = Field(..., description="用户在实验中的思考、问题与感想")
    extra_data: dict[str, Any] | None = Field(
        default=None, description="可选的结构化实验数据（参数、结果等）"
    )


class ExperimentNoteCreate(ExperimentNoteBase):
    experiment_key: str = Field(
        ...,
        description="实验唯一标识，例如 'line-search.range_search.observation'",
    )


class ExperimentNoteUpdate(ExperimentNoteBase):
    pass


class ExperimentNoteOut(BaseModel):
    id: int
    experiment_key: str
    reflection: str
    extra_data: dict[str, Any] | None
    updated_at: datetime

    class Config:
        from_attributes = True

