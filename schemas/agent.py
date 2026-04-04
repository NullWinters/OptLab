from pydantic import BaseModel, Field
from typing import Annotated, List, Optional, Literal


class SimpleSchema(BaseModel):
    text: Annotated[str, Field(..., description="Text of the agent")]


class ButtonInfo(BaseModel):
    id: str = Field(..., description="UI element ID")
    description: str = Field(..., description="UI element description")
    type: Literal["normal", "optional", "svg", "modal"] = Field(
        default="normal", description="UI element type"
    )


class AssistantRequest(BaseModel):
    message: str = Field(..., description="User's question")
    page_id: str = Field(..., description="Page identifier for loading server-side docs")
    guidebook: str = Field(..., description="Page guidebook text")
    buttons: List[ButtonInfo] = Field(..., description="Available UI elements on the page")
    graph_context: Optional[dict] = Field(default=None, description="2D/3D graph status context")


class AssistantSchema(BaseModel):
    text: Annotated[str, Field(..., description="回答用户问题的文本说明")]
    text_blocks: Annotated[List[str], Field(default_factory=list, description="可分段展示的回复文本数组")]
    highlight_ids: Annotated[List[str], Field(default_factory=list, description="需要高亮标记的UI元素ID数组，按操作顺序排列")]

