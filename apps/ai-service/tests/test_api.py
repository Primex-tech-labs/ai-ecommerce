from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["provider"] == "stub"


def test_chat_returns_assistant_message() -> None:
    response = client.post(
        "/assistant/chat",
        json={"messages": [{"role": "user", "content": "headphones for travel"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["message"]["role"] == "assistant"
    assert body["message"]["content"]


def test_recommendations_by_query() -> None:
    response = client.post("/recommendations", json={"query": "travel audio", "limit": 2})
    assert response.status_code == 200
    assert len(response.json()) <= 2


def test_semantic_search() -> None:
    response = client.post("/search/semantic", json={"query": "smart home assistant"})
    assert response.status_code == 200
    assert isinstance(response.json(), list)
