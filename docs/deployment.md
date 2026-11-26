# Deployment and verification

This document covers deploying the app and verifying the Soroban escrow contract.
**Nothing here has been deployed to Mainnet by this repository's automation.**

## Database

1. Provision PostgreSQL 14+ and set `DATABASE_URL`.
2. Back up first if the database already exists:
   `pg_dump "$DATABASE_URL" --format=custom --file=backup-$(date +%F).dump`
3. Apply migrations (never run destructive steps without a backup):
   `pnpm --filter @repo/web db:migrate`
4. Optionally import legacy JSON orders:
   `pnpm --filter @repo/web db:import-orders`
5. Start the app with `DATABASE_URL` set (enables auth, ownership, rate limiting).

Compose: `docker compose up -d postgres`, then
`docker compose --profile tools run --rm migrate`.

## Soroban escrow contract (Stellar testnet only)

The escrow contract targets `soroban-sdk` 28 and the dispute-enabled ABI adds an
`arbiter` argument to `create` plus `dispute`/`resolve`.

```bash
cd contracts/escrow
cargo fmt --check
cargo clippy --all-targets
cargo test                       # unit tests for create/fund/release/refund/dispute/resolve
stellar contract build           # requires Stellar CLI 21+
stellar contract deploy --wasm target/wasm32v1-none/release/escrow.wasm --network testnet
```

After deploying, set:

```env
ESCROW_CONTRACT_ID=<new contract id>
STELLAR_ARBITER_ADDRESS=<arbiter public key>
NEXT_PUBLIC_STELLAR_ARBITER_ADDRESS=<same>
STELLAR_TOKEN_CONTRACT_ID=<SAC contract id>
STELLAR_MERCHANT_ADDRESS=<merchant public key>
```

Verification:

- `cargo test` must pass (13 tests: lifecycle + dispute/arbiter + duplicate resolution).
- Optional live smoke test (uses throwaway testnet keys, no real funds):
  `STELLAR_SMOKE_TEST=1 pnpm --filter @repo/stellar smoke:escrow`
- Confirm the deployed contract exposes `dispute` and `resolve` (e.g. via the
  Stellar CLI contract interface inspection) before enabling the dispute UI.

## Notes

- The repository does **not** auto-deploy contracts or overwrite
  `ESCROW_CONTRACT_ID`; update configuration deliberately.
- Never use Mainnet or real funds in automated tests.
- Do not run `db:rollback` in production without a verified backup.
