# Roadmap and project status

**Status: not production-ready.** The core storefront, escrow contract, database
persistence, authentication, order ownership, and rate limiting are implemented
and verified in CI. The items below are the remaining work before any production
deployment.

Legend: ✅ done · 🟡 partial · ⛔ not done

## Delivered

- ✅ Storefront (catalog, cart, checkout, orders), FastAPI AI service, Soroban escrow.
- ✅ Dispute/arbiter flow in the contract (buyer/seller initiate, arbiter resolves) + app.
- ✅ Integer pricing and `BigInt` stroop conversion; Stellar asset validation.
- ✅ PostgreSQL order persistence (migrations, repository, JSON importer).
- ✅ Authentication (scrypt + server-side sessions), owner-scoped orders.
- ✅ Shared Postgres rate limiting (auth, checkout, order actions, AI proxy).
- ✅ Security scanning (malware/secret/CodeQL) and branch protection.
- ✅ Indexer cursor persistence (Postgres when configured) + retry handling.

## Remaining work

### Blockchain / escrow
- ⛔ Redeploy the dispute-enabled escrow contract (adds `arbiter` to `create`) and update `ESCROW_CONTRACT_ID` / arbiter config.
- ⛔ Contract ABI compatibility check automation and a dispute smoke test on testnet.
- ⛔ Independent security audit of the Soroban contract (the arbiter is a trusted role; not decentralised).

### Identity and access
- ⛔ Wallet ↔ account signature linking (funds are on-chain-authorized; order visibility is session-based).
- ⛔ Password reset and email verification (requires email infrastructure).
- ⛔ Admin role enforcement (schema has `role`; no admin endpoints/guards).

### Reliability and limits
- ⛔ Shared rate limiting inside the Python AI service (the Next proxy currently fronts it).
- 🟡 Webhook rate limiting (intentionally HMAC-authenticated + retryable; not rate-limited).
- 🟡 Indexer restart/rollback and duplicate-event integration tests.
- ⛔ Full Docker Compose app startup (only an optional `migrate` tool service exists).

### Security and tests
- 🟡 HTTP-level IDOR route tests (repository-level ownership is tested).
- ⛔ FastAPI CORS/security-header review beyond the existing explicit `CORS_ORIGINS`.
- ⛔ Production error handling review (avoid leaking internals), broader security regression tests.

### Product
- 🟡 Order detail/payment status UI (order detail exists; dispute history is minimal).
- ⛔ Align the catalog `currency` label with the configured settlement asset.
- ⛔ Accessibility and responsive pass across all pages.

## Non-goals (for now)

- Solana integration is not implemented; see [docs/solana.md](docs/solana.md) for the decision and adapter plan.
- No Mainnet deployment or real-funds automation.

## Notes

- Multi-instance deployments require `DATABASE_URL` (Postgres) and auth enabled.
- Never run destructive migrations or contract deployments without a backup and explicit authorization.
