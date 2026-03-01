from pydantic import BaseModel, Field
from typing import Annotated, Literal

class ResponseOut(BaseModel):
    result:Annotated[Literal["Success","Failure"],Field("Success", description="Result of the operation")]