from typing import Literal

from pydantic import Field

from app.schemas.base import APIModel

Role = Literal["system", "user", "assistant"]


class ChatMessage(APIModel):
    role: Role
    content: str


class ChatContext(APIModel):
    product_ids: list[str] = Field(default_factory=list)
    cart_variant_ids: list[str] = Field(default_factory=list)


class ChatRequest(APIModel):
    messages: list[ChatMessage]
    context: ChatContext | None = None


class ChatUsage(APIModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0


class ChatReply(APIModel):
    message: ChatMessage
    provider: str
    model: str
    usage: ChatUsage | None = None
