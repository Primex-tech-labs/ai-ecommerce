from app.schemas.base import APIModel


class RecommendationRequest(APIModel):
    product_id: str | None = None
    user_id: str | None = None
    query: str | None = None
    limit: int = 5


class Recommendation(APIModel):
    product_id: str
    score: float
    reason: str
