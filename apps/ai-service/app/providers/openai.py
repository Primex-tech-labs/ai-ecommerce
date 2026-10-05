import httpx

from app.core.config import Settings
from app.providers.base import ChatResult, LLMProvider
from app.schemas.chat import ChatContext, ChatMessage, ChatUsage

SYSTEM_PROMPT = (
    "You are a concise, helpful ecommerce shopping assistant. "
    "Recommend products, compare variants, and guide the shopper to checkout."
)


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, settings: Settings) -> None:
        self.model = settings.openai_model
        self._api_key = settings.openai_api_key
        self._timeout = settings.request_timeout
        self._base_url = "https://api.openai.com/v1"

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
                headers={"Authorization": f"Bearer {self._api_key}"},
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
