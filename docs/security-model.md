# Security Model

This document describes how `ai-ecommerce` protects funds, order state, and the
indexer pipeline, and — importantly — what it does **not** yet protect.

## Trust boundaries

| Component | Trust level | Notes |
| --- | --- | --- |
| Soroban escrow contract | **Authoritative** | Owns funds and the real order state. |
| Browser wallet | Holds the user's keys | Signs transactions; keys never reach the server. |
| Next.js server | Semi-trusted | Builds transactions, verifies webhooks, stores a read model. |
| Indexer | Semi-trusted | Forwards on-chain events to the web app. |
| Order JSON store | **Derived** | A convenience read model, not a source of truth. |

The server is **non-custodial**: it never holds a buyer's, seller's, arbiter's,
or merchant's secret key, and it never signs value-moving transactions on a
user's behalf.

## Payment and escrow authorization

The escrow contract (`contracts/escrow`) is the security boundary for funds:

- `create` requires the **buyer** to authorize the order (and records the arbiter).
- `fund` requires the **buyer** to authorize the token transfer into escrow.
- `release` requires the **buyer** to authorize paying the seller.
- `refund` requires the **seller** to authorize returning funds to the buyer.
- `dispute` requires the **buyer or seller** and only works on a funded order.
- `resolve` requires the **configured arbiter** and only works on a disputed order.

Every state-changing call checks the current `Status` and returns
`InvalidStatus` on illegal transitions, which prevents duplicate settlement
(e.g. releasing twice, refunding after release, or resolving a dispute twice).
The arbiter is stored per order, so an arbiter configured for one order cannot
resolve a different order.

Because the browser builds the transaction and signs it with the user's wallet,
the server-side `release`/`refund`/`dispute`/`resolve` routes only *prepare*
transactions. They additionally reject orders in the wrong state and, for
release/refund, require the requested source to equal the on-record buyer/seller.
The dispute route requires the source to be a party; the resolve route requires
the source to equal `STELLAR_ARBITER_ADDRESS` and the order to be `disputed`.

Stellar transaction sequence numbers plus the 180-second transaction timeout
provide replay protection.

## Dispute flow

```
create -> funded -> disputed -> released  (arbiter releases to seller)
                            \-> refunded  (arbiter refunds buyer)
```

- Either party opens a dispute on a funded order (`POST /api/orders/:id/dispute`).
- Only the arbiter can resolve (`POST /api/orders/:id/resolve` with
  `decision: "release" | "refund"`).
- The arbiter is configured per order at creation (`STELLAR_ARBITER_ADDRESS`) and
  cannot alter unrelated orders.
- This introduces a trusted third party for disputes; that trust is explicit and
  documented in [`dispute.md`](dispute.md) and [ADR 0001](adr/0001-stellar-escrow.md).

## Webhook authentication

The indexer forwards escrow events to `POST /api/orders` with an HMAC-SHA256
signature (`x-indexer-signature`) computed over the raw request body using
`ORDERS_WEBHOOK_SECRET`. The web app verifies it with a timing-safe comparison,
caps the body at 10 KB, validates the event shape, and **fails closed in
production**: if the secret is unset and `NODE_ENV=production`, it returns `503`.
Unsigned events are accepted only in development, with a warning. The indexer
likewise refuses to start unsigned in production.

## Order state machine and idempotency

`upsertFromEvent` is forward-only and idempotent:

- `created` → `funded` → (`disputed`) → `released` / `refunded`
- events older than the stored ledger are ignored,
- duplicate or regressive events never change the stored order,
- terminal states (`released`, `refunded`) are never overwritten,
- transaction hashes are preserved across transitions.

## Indexer reliability

- Cursor persisted to `INDEXER_CURSOR_FILE` and reloaded on start.
- The cursor only advances after a successful webhook delivery; failures retry.
- Events are processed in ledger order.

## Financial correctness

- Catalog prices are integer major units; `pricing.ts` uses integer arithmetic
  only and rejects fractional or overflowing totals.
- `toTokenAmount` converts integer major units to stroops via `BigInt`
  (1 unit = 10,000,000 stroops), rejecting non-integer, non-positive, or
  overflowing values.
- The backend always recomputes the total from the catalog; client prices are
  never trusted.

## Security headers

`next.config.mjs` sets `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`, a baseline `Content-Security-Policy`,
and `Strict-Transport-Security` in production. The CSP is intentionally
permissive (`'unsafe-inline'`, `'unsafe-eval'`, broad `connect-src`) to avoid
breaking wallets and dev tooling; tighten it once the exact external origins are
known.

## Secret handling

- No secret keys or seed phrases are stored in the application.
- AI provider keys remain server-side; never exposed to the browser.
- `.env` is git-ignored; only `.env.example` is committed.

## Known limitations (not production-ready)

1. **Order store is a JSON file**, not a database. Safe for a single writer, not
   multi-instance. PostgreSQL exists in `docker-compose` but is not wired in.
2. **Authentication and owner-scoped orders** are implemented when `DATABASE_URL` is set (server-side scrypt sessions; `/orders` is owner-scoped). Without a database, auth is disabled for dev/e2e. Wallet
   signatures protect funds, not order visibility.
3. **Rate limiting** is implemented for auth, checkout, order actions, and the AI proxy via PostgreSQL; the Python AI service and webhook endpoint are not independently rate-limited (the webhook is HMAC-authenticated and intentionally retryable).
4. **Arbiter is a trusted role** (no decentralised dispute jury).
5. **No Solana integration** — see [`solana.md`](solana.md).
6. The contract has not been independently audited, and the dispute-enabled
   contract must be redeployed (it changes the `create` ABI).

## Reporting a vulnerability

See [`SECURITY.md`](../SECURITY.md).
