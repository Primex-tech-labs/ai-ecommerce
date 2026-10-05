from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.providers.factory import get_provider
from app.schemas.health import HealthStatus

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthStatus)
async def health(settings: Settings = Depends(get_settings)) -> HealthStatus:
    provider = get_provider(settings)
    return HealthStatus(status="ok", provider=provider.name, model=provider.model)
