from app.schemas.base import APIModel


class HealthStatus(APIModel):
    status: str
    provider: str
    model: str
