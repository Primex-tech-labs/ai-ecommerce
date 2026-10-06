# Contributing

Thanks for your interest in the AI Commerce Framework. This guide covers setup, the
development workflow, and what we expect from pull requests.

## Prerequisites

- Node.js 20+ and pnpm 9+
- Python 3.11+
- Rust and the `wasm32v1-none` target (only for `contracts/escrow`)
- Docker (optional, for Postgres / Redis / Ollama / a local Stellar node)

## Setup

```bash
pnpm install
cp .env.example .env
```

AI service (optional, for working on `apps/ai-service`):

```bash
cd apps/ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
```

## Running

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Storefront at http://localhost:3000 |
| `pnpm ai:dev` | AI service at http://localhost:8000 |
| `pnpm --filter @repo/indexer dev` | Soroban event indexer |
| `docker compose up --build` | Postgres, Redis, Ollama, AI service |
| `docker compose --profile stellar up stellar` | Local Stellar Quickstart node |

The AI service defaults to the offline `stub` provider, so no API keys are required.

## Project structure

- `apps/web` - Next.js storefront (catalog, cart, checkout, assistant, wallet)
- `apps/ai-service` - FastAPI AI service with swappable providers
- `apps/indexer` - Soroban escrow event indexer
- `packages/commerce-core` - domain types and cart logic
- `packages/ai-client` - typed client for the AI service
- `packages/stellar` - Stellar/Soroban config, escrow, payments, events
- `packages/ui` - shared React components
- `contracts/escrow` - Soroban escrow contract (Rust)

## Workflow

1. Find or open an issue. If it is part of a Drips Wave, **wait to be assigned before
   starting**.
2. Branch from `main` using a descriptive prefix: `feat/`, `fix/`, `docs/`, `test/`,
   `chore/`.
   - `git checkout -b feat/semantic-search`
3. Keep the change scoped to the issue.
4. Write clear commits using [Conventional Commits](https://www.conventionalcommits.org/):
   `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
5. Open a PR that links the issue with `Closes #<number>` and fill in the PR template.

## Checks before opening a PR

Run the checks relevant to what you changed:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build            # if apps/web changed

cd apps/ai-service
ruff check .
pytest                # if the AI service changed

cd contracts/escrow
cargo fmt --check
cargo clippy --all-targets
cargo test            # if the contract changed
```

Include the command output in your PR description.

## Style

- **TypeScript** - strict mode; avoid `any`; Prettier formats the code.
- **Python** - `ruff` for linting/formatting, `mypy` strict.
- **Rust** - `rustfmt` and `clippy`.
- Do not commit secrets. Use `.env` (git-ignored) and keep `.env.example` current.

## Adding an AI provider

1. Subclass `LLMProvider` in `apps/ai-service/app/providers`.
2. Add settings in `app/core/config.py`.
3. Register it in `app/providers/factory.py`.

## Reporting bugs and security issues

- Use the issue templates for bugs and feature requests.
- For security vulnerabilities, do not open a public issue; contact the maintainers
  privately.

## License

By contributing, you agree that your contributions are licensed under the MIT License.
