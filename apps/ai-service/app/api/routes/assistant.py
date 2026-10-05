from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.providers.factory import get_provider
from app.schemas.chat import ChatMessage, ChatReply, ChatRequest

router = APIRouter(tags=["assistant"])


@router.post("/assistant/chat", response_model=ChatReply)
async def chat(
    request: ChatRequest,
    settings: Settings = Depends(get_settings),
) -> ChatReply:
    provider = get_provider(settings)
    result = await provider.chat(request.messages, request.context)
    return ChatReply(
        message=ChatMessage(role="assistant", content=result.content),
        provider=result.provider,
        model=result.model,
        usage=result.usage,
    )
