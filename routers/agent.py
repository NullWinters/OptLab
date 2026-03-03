from fastapi import APIRouter
from fastapi.responses import JSONResponse
from schemas.agent import AssistantRequest
from core.agent import ask_assistant

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.post("/chat")
async def chat(request: AssistantRequest):
    try:
        result = await ask_assistant(
            message=request.message,
            page_id=request.page_id,
            guidebook=request.guidebook,
            buttons=[b.model_dump() for b in request.buttons],
        )
        return result
    except RuntimeError as e:
        return JSONResponse(status_code=503, content={"detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})
