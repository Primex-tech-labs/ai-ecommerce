from app.core.config import Settings
from app.providers.anthropic import AnthropicProvider
from app.providers.base import LLMProvider
from app.providers.local import LocalProvider
from app.providers.openai import OpenAIProvider
from app.providers.stub import StubProvider


def get_provider(settings: Settings) -> LLMProvider:
    provider = settings.ai_provider.lower()
    if provider == "openai":
        return OpenAIProvider(settings)
    if provider == "anthropic":
        return AnthropicProvider(settings)
    if provider == "local":
        return LocalProvider(settings)
    return StubProvider()
