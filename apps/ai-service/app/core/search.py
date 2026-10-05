from app.core.catalog import PRODUCTS, overlap, product_text, tokenize


def semantic_search(query: str, limit: int = 5) -> list[tuple[str, float]]:
    tokens = tokenize(query)
    scored = [
        (product["id"], overlap(tokens, tokenize(product_text(product)))) for product in PRODUCTS
    ]
    scored.sort(key=lambda entry: entry[1], reverse=True)
    return [hit for hit in scored if hit[1] > 0][:limit]
