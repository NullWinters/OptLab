from pydantic import BaseModel, Field
from typing import Annotated, List

class SimpleSchema(BaseModel):
    text: Annotated[str,Field(..., description="Text of the agent")]

