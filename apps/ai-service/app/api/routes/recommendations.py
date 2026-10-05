from fastapi import APIRouter

from app.core.catalog import PRODUCTS
from app.core.recommender import recommend_similar
from app.core.search import semantic_search
from app.schemas.recommendation import Recommendation, RecommendationRequest

router = APIRouter(tags=["recommendations"])


@router.post("/recommendations", response_model=list[Recommendation])
async def recommendations(request: RecommendationRequest) -> list[Recommendation]:
    if request.product_id:
        results = recommend_similar(request.product_id, request.limit)
        return [
            Recommendation(
                product_id=product["id"],
                score=round(score, 4),
                reason=f"Shares tags with {request.product_id}",
            )
            for product, score in results
        ]

    if request.query:
        hits = semantic_search(request.query, request.limit)
        return [
            Recommendation(
                product_id=product_id,
                score=round(score, 4),
                reason=f"Matches query: {request.query}",
            )
            for product_id, score in hits
        ]

    popular = sorted(PRODUCTS, key=lambda product: product["popularity"], reverse=True)
    return [
        Recommendation(
            product_id=product["id"],
            score=round(product["popularity"], 4),
            reason="Popular right now",
        )
        for product in popular[: request.limit]
    ]
