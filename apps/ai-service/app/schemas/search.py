from app.schemas.base import APIModel


class SearchRequest(APIModel):
    query: str
    limit: int = 5


class SearchHit(APIModel):
    product_id: str
    score: float
