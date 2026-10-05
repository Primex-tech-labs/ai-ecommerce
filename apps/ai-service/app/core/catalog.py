import re

PRODUCTS: list[dict] = [
    {
        "id": "p-nebula",
        "name": "Nebula AI Robot Vacuum",
        "description": "Self-navigating vacuum with on-device vision and scheduling assistant.",
        "tags": ["smart-home", "ai", "cleaning"],
        "popularity": 0.9,
    },
    {
        "id": "p-lumen",
        "name": "Lumen Smart Display",
        "description": "Countertop display with a conversational shopping and recipe assistant.",
        "tags": ["smart-home", "display", "assistant"],
        "popularity": 0.7,
    },
    {
        "id": "p-sonic",
        "name": "Sonic AI Headphones",
        "description": "Adaptive noise cancelling headphones with real-time translation.",
        "tags": ["audio", "ai", "travel"],
        "popularity": 0.95,
    },
]

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> set[str]:
    return set(_TOKEN_RE.findall(text.lower()))


def product_text(product: dict) -> str:
    return f"{product['name']} {' '.join(product['tags'])} {product['description']}"


def by_id(product_id: str) -> dict | None:
    return next((item for item in PRODUCTS if item["id"] == product_id), None)


def overlap(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)
