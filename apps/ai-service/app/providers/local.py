import httpx

from app.core.config import Settings
from app.providers.base import ChatResult, LLMProvider
from app.providers.openai import SYSTEM_PROMPT
from app.schemas.chat import ChatContext, ChatMessage, ChatUsage


class LocalProvider(LLMProvider):
    name = "local"

    def __init__(self, settings: Settings) -> None:
        self.model = settings.local_model
        self._base_url = settings.local_base_url.rstrip("/")
        self._timeout = settings.request_timeout

    async def chat(
        self,
        messages: list[ChatMessage],
        context: ChatContext | None = None,
    ) -> ChatResult:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                *[message.model_dump() for message in messages],
            ],
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage") or {}
        return ChatResult(
            content=content,
            provider=self.name,
            model=self.model,
            usage=ChatUsage(
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
            ),
        )
