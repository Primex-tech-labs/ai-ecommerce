from app.core.recommender import recommend_from_query
from app.providers.base import ChatResult, LLMProvider
from app.schemas.chat import ChatContext, ChatMessage, ChatUsage


class StubProvider(LLMProvider):
    name = "stub"
    model = "rule-based"

    async def chat(
        self,
        messages: list[ChatMessage],
        context: ChatContext | None = None,
    ) -> ChatResult:
        prompt = self._last_user_message(messages)
        products = recommend_from_query(prompt, limit=3)
        if products and prompt:
            lines = "\n".join(
                f"- {product['name']}: {product['description']}" for product in products
            )
            content = f'Based on "{prompt}", here are some options:\n{lines}'
        else:
            content = (
                "I can help you find products, compare variants, and build a cart. "
                "Tell me what you are shopping for."
            )
        return ChatResult(
            content=content,
            provider=self.name,
            model=self.model,
            usage=ChatUsage(
                prompt_tokens=len(prompt.split()),
                completion_tokens=len(content.split()),
            ),
        )
