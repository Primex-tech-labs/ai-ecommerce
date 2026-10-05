from dataclasses import dataclass

from app.schemas.chat import ChatContext, ChatMessage, ChatUsage


@dataclass
class ChatResult:
    content: str
    provider: str
    model: str
    usage: ChatUsage | None = None


class LLMProvider:
    name: str = "base"
    model: str = "base"

    async def chat(
        self,
        messages: list[ChatMessage],
        context: ChatContext | None = None,
    ) -> ChatResult:
        raise NotImplementedError

    async def complete(self, prompt: str) -> str:
        result = await self.chat([ChatMessage(role="user", content=prompt)])
        return result.content

    @staticmethod
    def _last_user_message(messages: list[ChatMessage]) -> str:
        for message in reversed(messages):
            if message.role == "user":
                return message.content
        return ""
