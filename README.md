# AI Commerce Framework

[![CI](https://github.com/Primex-tech-labs/ai-ecommerce/actions/workflows/ci.yml/badge.svg)](https://github.com/Primex-tech-labs/ai-ecommerce/actions/workflows/ci.yml)

An open-source framework for building **AI-assisted ecommerce storefronts with on-chain
settlement**. It combines a Next.js storefront, a provider-agnostic Python AI service, and
a Soroban escrow contract on Stellar, wired together in a Turborepo + pnpm workspace.

- Storefront with catalog, cart, checkout, and an AI shopping assistant.
- Plug-and-play LLM providers: OpenAI, Anthropic, local models, or an offline stub.
- Stellar/Soroban escrow for trust-minimized payments, with a wallet checkout flow.
- Fully typed TypeScript packages and a tested Rust smart contract.

## What is included

- **Storefront** (`apps/web`) - catalog, product pages, cart, checkout, an AI shopping
  assistant panel, and Stellar wallet checkout.
- **AI service** (`apps/ai-service`) - FastAPI app exposing chat, recommendations, and
  semantic search with a swappable LLM provider.
- **Stellar / Soroban** - a Soroban escrow contract (`contracts/escrow`), a typed
  TypeScript SDK (`@repo/stellar`), and an event indexer (`apps/indexer`).
- **Shared packages**
  - `@repo/commerce-core` - domain types, cart logic, and a catalog repository.
  - `@repo/ai-client` - typed client for the AI service.
  - `@repo/stellar` - Stellar/Soroban config, escrow, payments, and events.
  - `@repo/ui` - shared React components (product card, price, chat widget).

## Demo

- Live escrow contract on Stellar testnet:
  [`CCFAUBBGENQD76EIRC7NJ3LFTDJEMSUFJ7UBWP3F6SHMFLX2HRVAB4CV`](https://stellar.expert/explorer/testnet/contract/CCFAUBBGENQD76EIRC7NJ3LFTDJEMSUFJ7UBWP3F6SHMFLX2HRVAB4CV)
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
| `pnpm build`     | Build all packages and apps              |
| `pnpm lint`      | ESLint across the workspace              |
| `pnpm typecheck` | Type-check all TypeScript packages       |
| `pnpm test`      | Run Vitest suites                        |
| `pnpm ai:dev`    | Run the FastAPI service with reload      |
| `pnpm ai:test`   | Run the Python test suite                |
| `pnpm --filter @repo/indexer dev` | Run the Soroban event indexer |

## Stellar / Soroban

The checkout can settle orders through a Soroban escrow contract. See
[docs/stellar.md](docs/stellar.md) for the payment flow, deployment, and local network.

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
