# Database (PostgreSQL)

Orders can be persisted in PostgreSQL instead of the legacy JSON file.

## Backend selection

The server picks the backend at request time in `apps/web/src/lib/orders-server.ts`:

- `DATABASE_URL` set → PostgreSQL repository (`orders-pg.ts`).
- `DATABASE_URL` unset → the legacy JSON store (`orders.ts`), used for local dev
  and the Playwright e2e run.

Both implementations share the same forward-only, idempotent order semantics.

## Schema

Initial migration: `apps/web/db/migrations/0001_init.sql`.

| Table | Purpose |
| --- | --- |
| `users` | Accounts (`email` unique case-insensitively, `password_hash`, `role`). |
| `sessions` | Server-side sessions (id, user, expiry, revocation). |
| `orders` | Order read model + escrow metadata, status, ledger, amount, tx hashes. |
| `order_items` | Line items (variant, quantity, unit price, line total). |
| `payments` | One row per on-chain tx (kind, hash, ledger); unique per tx. |
| `disputes` | One row per order; `open` / `resolved_seller` / `resolved_buyer`. |
| `indexer_state` | Cursor persistence (for DB-backed indexers). |
| `rate_limits` | Shared fixed-window counters for endpoint rate limiting. |

Key constraints: order status is a `CHECK` over the five states; `status_rank`
enforces the forward-only machine; amounts are non-negative `bigint` stroops;
`payments` has `UNIQUE (order_id, kind, tx_hash)` for idempotency.

## Migrations

Migrations are plain `.sql` files with an optional `.down.sql`, applied by
`apps/web/db/migrate.mjs`, which records versions in `schema_migrations`.

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/primex
pnpm --filter @repo/web db:migrate     # apply pending
pnpm --filter @repo/web db:status      # show applied/pending
pnpm --filter @repo/web db:rollback    # revert the latest migration
```

Migrations run in a transaction each; the runner never auto-runs at app startup.
CI runs `db:migrate` against a `postgres:16` service before the test suite.

## Importing the legacy JSON store

```bash
# Always back up first
cp apps/web/.data/orders.json apps/web/.data/orders.backup.json

export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/primex
pnpm --filter @repo/web db:import-orders --dry-run   # validate only
pnpm --filter @repo/web db:import-orders             # idempotent import
```

The importer validates each order, preserves status/ledger/amount/tx hashes,
inserts payment rows, and uses `ON CONFLICT (id) DO NOTHING` so re-running it
skips existing orders. Existing JSON data is never deleted.

## Backup and restore

```bash
# Backup
pg_dump "$DATABASE_URL" --format=custom --file=primex-$(date +%F).dump

# Restore into an empty database (creates objects; does not drop anything)
pg_restore --dbname="$DATABASE_URL" --no-owner primex-$(date +%F).dump
```

Do not run rollbacks or restores against production without a verified backup
and explicit authorization.

## Indexer cursor

When `DATABASE_URL` is set, the indexer persists its cursor in `indexer_state`
(id `escrow`) so restarts and multiple instances resume safely; otherwise it uses
`INDEXER_CURSOR_FILE`. The startup log reports the active `cursor` backend.

## CI verification

CI runs `db:migrate` against a PostgreSQL service, the DB integration tests, an
idempotent JSON import (twice), and a `db:rollback` + `db:migrate` cycle to prove
migrations are reversible.
