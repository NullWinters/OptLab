from pydantic import BaseModel, Field
from typing import Annotated, List


class SimpleSchema(BaseModel):
    text: Annotated[str, Field(..., description="Text of the agent")]


class ButtonInfo(BaseModel):
    id: str = Field(..., description="Button element ID")
    description: str = Field(..., description="Button description")
    type: str = Field(default="normal", description="Button type for future extension")


class AssistantRequest(BaseModel):
    message: str = Field(..., description="User's question")
    guidebook: str = Field(..., description="Page guidebook text")
    buttons: List[ButtonInfo] = Field(..., description="Available buttons on the page")


class AssistantSchema(BaseModel):
    text: Annotated[str, Field(..., description="回答用户问题的文本说明")]
    highlight_ids: Annotated[List[str], Field(default_factory=list, description="需要高亮标记的按钮ID数组，按操作顺序排列")]

