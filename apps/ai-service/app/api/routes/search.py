from fastapi import APIRouter

from app.core.search import semantic_search
from app.schemas.search import SearchHit, SearchRequest

router = APIRouter(tags=["search"])


@router.post("/search/semantic", response_model=list[SearchHit])
async def semantic(request: SearchRequest) -> list[SearchHit]:
    hits = semantic_search(request.query, request.limit)
    return [SearchHit(product_id=product_id, score=round(score, 4)) for product_id, score in hits]
