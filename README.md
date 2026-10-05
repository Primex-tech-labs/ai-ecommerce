# AI Commerce Framework

A framework for AI-assisted ecommerce storefronts. It ships a Next.js storefront, a
provider-agnostic Python AI service (OpenAI / Anthropic / local models / offline stub),
and shared TypeScript domain packages, wired together in a Turborepo + pnpm workspace.

## What is included

- **Storefront** (`apps/web`) - catalog, product pages, cart, checkout stub, and an AI
  shopping assistant panel.
- **AI service** (`apps/ai-service`) - FastAPI app exposing chat, recommendations, and
  semantic search with a swappable LLM provider.
- **Shared packages**
  - `@repo/commerce-core` - domain types, cart logic, and a catalog repository.
  - `@repo/ai-client` - typed client for the AI service.
  - `@repo/ui` - shared React components (product card, price, chat widget).

## Layout

```
apps/
  web/          Next.js storefront
  ai-service/   FastAPI + LLM providers
packages/
  commerce-core/  cart + catalog domain
  ai-client/      typed AI service client
  ui/             shared React components
docs/           architecture notes
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

## Docker

```bash
docker compose up --build
```

Starts Postgres, Redis, Ollama, and the AI service.

See [docs/architecture.md](docs/architecture.md) for request flows and extension points.
