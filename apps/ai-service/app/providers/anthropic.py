import httpx

from app.core.config import Settings
from app.providers.base import ChatResult, LLMProvider
from app.providers.openai import SYSTEM_PROMPT
from app.schemas.chat import ChatContext, ChatMessage, ChatUsage


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, settings: Settings) -> None:
        self.model = settings.anthropic_model
        self._api_key = settings.anthropic_api_key
        self._timeout = settings.request_timeout
        self._base_url = "https://api.anthropic.com/v1"

    async def chat(
        self,
        messages: list[ChatMessage],
        context: ChatContext | None = None,
    ) -> ChatResult:
        system = next(
            (message.content for message in messages if message.role == "system"),
            SYSTEM_PROMPT,
        )
        conversation = [message.model_dump() for message in messages if message.role != "system"]
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "system": system,
            "messages": conversation,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/messages",
                headers={
                    "x-api-key": self._api_key,
                    "anthropic-version": "2023-06-01",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        content = "".join(block["text"] for block in data["content"] if block["type"] == "text")
        usage = data.get("usage") or {}
        return ChatResult(
            content=content,
            provider=self.name,
            model=self.model,
            usage=ChatUsage(
                prompt_tokens=usage.get("input_tokens", 0),
                completion_tokens=usage.get("output_tokens", 0),
            ),
        )
