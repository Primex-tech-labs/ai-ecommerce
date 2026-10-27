# AI Commerce Framework

[![CI](https://github.com/Primex-tech-labs/ai-ecommerce/actions/workflows/ci.yml/badge.svg)](https://github.com/Primex-tech-labs/ai-ecommerce/actions/workflows/ci.yml)

An open-source framework for building **AI-assisted ecommerce storefronts with on-chain
settlement**. It combines a Next.js storefront, a provider-agnostic Python AI service, and
a Soroban escrow contract on Stellar, wired together in a Turborepo + pnpm workspace.

- Storefront with catalog, cart, checkout, an AI shopping assistant, and an orders
  dashboard for escrow release/refund.
- Plug-and-play LLM providers: OpenAI, Anthropic, local models, or an offline stub.
- Stellar/Soroban escrow settlement with a wallet checkout flow (buyer-authorized
  orders, on-chain escrow, buyer release / seller refund).
- A file-backed order store fed by signed indexer webhooks and a lifecycle view for
  release/refund actions.
- Fully typed TypeScript packages and a tested Rust smart contract.

## What is included

- **Storefront** (`apps/web`) - catalog, product pages, cart, checkout, an AI shopping
  assistant panel, Stellar wallet checkout, and an orders page for release/refund.
- **AI service** (`apps/ai-service`) - FastAPI app exposing chat, recommendations, and
  keyword search with a swappable LLM provider.
- **Stellar / Soroban** - a Soroban escrow contract (`contracts/escrow`), a typed
  TypeScript SDK (`@repo/stellar`), and an event indexer (`apps/indexer`) that feeds the
  order store through a signed webhook.
- **Shared packages**
  - `@repo/commerce-core` - domain types, cart logic, and a catalog repository.
  - `@repo/ai-client` - typed client for the AI service.
  - `@repo/stellar` - Stellar/Soroban config, escrow, payments, and events.
  - `@repo/ui` - shared React components (product card, price, chat widget).

## Demo

- Live escrow contract on Stellar testnet:
  [`CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ`](https://stellar.expert/explorer/testnet/contract/CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ)
- End-to-end escrow flow (`create -> fund -> release`): `pnpm --filter @repo/stellar smoke:escrow`
- Storefront locally: `pnpm dev` then open http://localhost:3000

## Layout

```
apps/
  web/          Next.js storefront
  ai-service/   FastAPI + LLM providers
  indexer/      Soroban escrow event indexer
packages/
  commerce-core/  cart + catalog domain
  ai-client/      typed AI service client
  stellar/        Stellar/Soroban SDK wrappers
  ui/             shared React components
contracts/
  escrow/         Soroban escrow contract (Rust)
docs/           architecture + Stellar notes
infra/          infrastructure assets
```

## Prerequisites

- Node.js 20+ and pnpm 9+ (for the TypeScript workspace)
- Python 3.11+ (for the AI service)
- Docker (optional, for Postgres / Redis / Ollama)

## Quickstart

```bash
pnpm install
cp .env.example .env

# One-time Python setup for the AI service
cd apps/ai-service && pip install -e ".[dev]" && cd ../..

pnpm ai:dev      # http://localhost:8000
pnpm dev         # http://localhost:3000
```

The AI service defaults to the offline `stub` provider, so the storefront works with no
API keys. Set `AI_PROVIDER` and the matching key to use a real model.

### Run the AI service directly

```bash
cd apps/ai-service
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

## Providers

Set `AI_PROVIDER` in `apps/ai-service/.env` (or the root `.env`):

| Value       | Requires            | Notes                                  |
| ----------- | ------------------- | -------------------------------------- |
| `stub`      | nothing             | Offline, rule-based, used in CI/tests  |
| `openai`    | `OPENAI_API_KEY`    | Chat Completions API                   |
| `anthropic` | `ANTHROPIC_API_KEY` | Messages API                           |
| `local`     | Ollama              | Any OpenAI-compatible local endpoint   |

Add a provider by subclassing `LLMProvider` in `apps/ai-service/app/providers` and
registering it in `factory.py`.

## Scripts

| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | Run all TypeScript dev servers (Turbo)   |
| `pnpm build`     | Build the web app (Turbo runs build scripts) |
| `pnpm lint`      | ESLint across the workspace              |
| `pnpm typecheck` | Type-check all TypeScript packages       |
| `pnpm test`      | Run Vitest suites                        |
| `pnpm e2e`       | Run Playwright purchase-flow tests       |
| `pnpm ai:dev`    | Run the FastAPI service with reload      |
| `pnpm ai:test`   | Run the Python test suite                |
| `pnpm --filter @repo/indexer dev` | Run the Soroban event indexer |

## End-to-end tests

The Playwright suite in `e2e/` covers browsing the catalog, opening a product,
adding/updating/removing cart items, and reaching checkout. `pnpm e2e` starts
both the storefront and the AI service with `AI_PROVIDER=stub`, so no API keys
are required.

```bash
pnpm exec playwright install chromium   # once per machine
pnpm e2e
```

Traces, screenshots, and videos are captured on failure in `test-results/`, and
the HTML report is written to `playwright-report/`. CI uploads both artifacts
when the job fails.

## Stellar / Soroban

The checkout can settle orders through a Soroban escrow contract. See
[docs/stellar.md](docs/stellar.md) for the payment flow, deployment, and local network.

### Order lifecycle

The escrow contract emits `created`, `funded`, `released`, and `refunded` events. The
indexer forwards each event to `POST /api/orders`, signing the raw body with
`ORDERS_WEBHOOK_SECRET`. The web app verifies the HMAC-SHA256 signature and upserts the
order into the JSON file at `ORDERS_FILE` (default `.data/orders.json`).

```
created -> funded -> released
                  \-> refunded
```

The `/orders` page lists stored orders. A connected buyer can request `release`, and the
seller can request `refund`; the browser signs the returned XDR and submits it through
`/api/payments/stellar/submit`.

| Variable | Purpose |
| --- | --- |
| `ORDERS_FILE` | JSON order store path (default `.data/orders.json`) |
| `ORDERS_WEBHOOK_URL` | Indexer webhook target (default `http://localhost:3000/api/orders`) |
| `ORDERS_WEBHOOK_SECRET` | Shared HMAC-SHA256 secret for indexer webhooks |

```bash
cd contracts/escrow && cargo test          # contract unit tests
docker compose --profile stellar up stellar # local Stellar Quickstart node
```

## Docker

```bash
docker compose up --build
```

Starts Postgres, Redis, Ollama, and the AI service.

See [docs/architecture.md](docs/architecture.md) for request flows and extension points.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New contributors can start with issues labeled
`good first issue`.

## License

MIT - see [LICENSE](LICENSE).
