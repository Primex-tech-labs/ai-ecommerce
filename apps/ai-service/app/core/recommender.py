from app.core.catalog import PRODUCTS, by_id, overlap, product_text, tokenize


def recommend_from_query(query: str, limit: int = 5) -> list[dict]:
    tokens = tokenize(query)
    scored = [(product, overlap(tokens, tokenize(product_text(product)))) for product in PRODUCTS]
    scored.sort(key=lambda entry: (entry[1], entry[0]["popularity"]), reverse=True)
    return [product for product, score in scored if score > 0][:limit] or _popular(limit)


def _popular(limit: int) -> list[dict]:
    return sorted(PRODUCTS, key=lambda product: product["popularity"], reverse=True)[:limit]


def recommend_similar(product_id: str, limit: int = 5) -> list[tuple[dict, float]]:
    source = by_id(product_id)
    if source is None:
        return []
    source_tags = tokenize(" ".join(source["tags"]))
    scored = [
        (product, overlap(source_tags, tokenize(" ".join(product["tags"]))))
        for product in PRODUCTS
        if product["id"] != product_id
    ]
    scored.sort(key=lambda entry: entry[1], reverse=True)
    return scored[:limit]
