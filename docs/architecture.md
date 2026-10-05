# Overview

The framework separates commerce domain logic from AI capabilities so each side can evolve
independently. A Stellar/Soroban layer provides on-chain settlement for orders.

- **`@repo/commerce-core`** owns the domain: `Product`, `ProductVariant`, `Cart`, and pure
  cart operations. It also defines the `CatalogRepository` interface with an in-memory
  implementation used by the demo storefront.
- **`@repo/stellar`** wraps the Stellar SDK: network config, Soroban escrow calls, classic
  payments, and contract event reads.
- **`apps/web`** renders the storefront, proxies assistant traffic through a Next.js API
  route, and builds/submits Stellar transactions so keys never reach the browser.
- **`@repo/ai-client`** is a typed HTTP client for the AI service, usable from server
  components, route handlers, or tests.
- **`apps/ai-service`** exposes the AI capabilities and abstracts the model behind the
  `LLMProvider` interface.
- **`apps/indexer`** reconciles Soroban escrow events with orders.
- **`contracts/escrow`** is the Soroban escrow smart contract.

## Assistant request flow

```
ChatWidget (client)
  -> POST /api/assistant (Next.js route handler, server)
    -> AiClient.chat()
      -> POST /assistant/chat (FastAPI)
        -> LLMProvider.chat()  (stub | openai | anthropic | local)
```

Keeping the browser pointed at a same-origin Next.js route means provider credentials and
prompts stay on the server and CORS is limited to first-party calls.

## Settlement flow

```
StellarCheckoutButton (client)
  -> POST /api/payments/stellar        (build create+fund escrow, return unsigned XDR)
  -> wallet signs
  -> POST /api/payments/stellar/submit (submit + poll)
  -> apps/indexer observes escrow events -> orders webhook
```

See [stellar.md](stellar.md) for the contract lifecycle and deployment steps.

## Provider abstraction

`LLMProvider` (`apps/ai-service/app/providers/base.py`) requires a single method:

```python
async def chat(self, messages, context=None) -> ChatResult
```

`ChatResult` normalizes the response shape (content, provider, model, usage) across
vendors. The `stub` provider implements this with the local catalog so the storefront and
tests run with no external dependencies.

To add a provider:

1. Create `providers/<name>.py` subclassing `LLMProvider`.
2. Map provider settings in `app/core/config.py`.
3. Register it in `app/providers/factory.py`.

## Recommendations and search

The AI service keeps a lightweight product index in `app/core/catalog.py` and computes
tag/token overlap in `recommender.py` and `search.py`. This is intentionally simple and
deterministic. Replace those modules with vector search (pgvector, Qdrant, etc.) without
changing the API contracts.

## Data stores

`docker-compose.yml` provides Postgres, Redis, Ollama, and an optional Stellar Quickstart
node. The base scaffold does not require them; wire them in when you add persistence,
sessions, embeddings, or on-chain settlement.

## Extension points

- Swap `InMemoryCatalog` for a database-backed `CatalogRepository`.
- Persist carts server-side and merge with the localStorage cart in `CartProvider`.
- Add merchant `release`/`refund` endpoints backed by the escrow contract.
- Add streaming responses by extending `ChatReply` with an SSE endpoint.
