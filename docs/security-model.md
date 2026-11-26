# Security Model

This document describes how `ai-ecommerce` protects funds, order state, and the
indexer pipeline, and — importantly — what it does **not** yet protect. It is a
living document; update it when the trust model changes.

## Trust boundaries

| Component | Trust level | Notes |
| --- | --- | --- |
| Soroban escrow contract | **Authoritative** | Owns funds and the real order state. |
| Browser wallet | Holds the user's keys | Signs transactions; keys never reach the server. |
| Next.js server | Semi-trusted | Builds transactions, verifies webhooks, stores a read model. |
| Indexer | Semi-trusted | Forwards on-chain events to the web app. |
| Order JSON store | **Derived** | A convenience read model, not a source of truth. |

The server is **non-custodial**: it never holds a buyer's, seller's, or
merchant's secret key, and it never signs value-moving transactions on a user's
behalf.

## Payment and escrow authorization

The escrow contract (`contracts/escrow`) is the security boundary for funds:

- `create` requires the **buyer** to authorize the order.
- `fund` requires the **buyer** to authorize the token transfer into escrow.
- `release` requires the **buyer** to authorize paying the seller.
- `refund` requires the **seller** to authorize returning funds to the buyer.

Every state-changing call checks the current `Status` and returns
`InvalidStatus` on illegal transitions, which prevents duplicate settlement
(e.g. releasing twice, or refunding after release) and re-entrancy through
repeated calls.

Because the browser builds the transaction and signs it with the user's wallet,
the server-side `release`/`refund` routes only *prepare* transactions. The
routes additionally:

- reject orders that are not `funded` (`409`),
- require the requested `source` to equal the on-record buyer (release) or
  seller (refund),
- reject orders whose escrow contract id does not match the configured contract.

The server therefore cannot perform a release or refund by itself; a valid
signature from the correct wallet is still required, and the contract enforces
it. Stellar transaction sequence numbers plus the 180-second transaction timeout
provide replay protection.

## Webhook authentication

The indexer forwards escrow events to `POST /api/orders` with an HMAC-SHA256
signature (`x-indexer-signature`) computed over the raw request body using
`ORDERS_WEBHOOK_SECRET`. The web app:

- verifies the signature with a timing-safe comparison,
- caps the body size at 10 KB (`413`),
- validates the event shape before use,
- **fails closed in production**: if `ORDERS_WEBHOOK_SECRET` is unset and
  `NODE_ENV=production`, the endpoint returns `503` instead of accepting
  unsigned events. Unsigned events are only accepted in development, with a
  warning.

The indexer likewise refuses to start in production without a webhook secret.

## Order state machine and idempotency

Orders are a derived read model of on-chain events:

```
created -> funded -> released
                 \-> refunded
```

`upsertFromEvent` is forward-only and idempotent:

- events older than the stored ledger are ignored,
- duplicate or regressive events (a second `funded`, or `funded` after
  `released`) do not change the stored order,
- terminal states (`released`, `refunded`) are never overwritten,
- transaction hashes are preserved across transitions.

This lets the indexer safely re-deliver events after a restart or a webhook
failure without corrupting displayed state.

## Indexer reliability

- The cursor is persisted to `INDEXER_CURSOR_FILE` (default
  `.data/indexer-cursor.json`) and reloaded on start, so restarts resume rather
  than re-scan from scratch.
- The cursor only advances **after** an event is successfully delivered. A
  failed webhook causes the tick to stop and retry on the next interval instead
  of dropping the event.
- Events are processed in ledger order so cursor advancement is monotonic.

## Input validation

- Cart totals are recomputed server-side from the catalog; client-supplied
  prices are never trusted.
- Quantities must be integers in `1..=100`.
- Order ids used as contract symbols are constrained to `[A-Za-z0-9_-]{1,64}`.
- Stellar account ids are validated with `StrKey.isValidEd25519PublicKey`.
- Token amounts must be positive and finite before conversion to stroops.

## Secret handling

- No secret keys or seed phrases are stored in the application database.
- AI provider keys remain server-side (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`);
  they are never exposed to the browser.
- `.env` files are git-ignored; only `.env.example` is committed.

## Known limitations (not yet production-ready)

These are real, acknowledged gaps. They are documented rather than hidden:

1. **Order store is a JSON file**, not a database. It is safe for a single
   writer but not for multi-instance deployments. `docker-compose.yml` includes
   PostgreSQL, but it is not yet wired into the order repository. A migration to
   a Postgres-backed repository with row-level ownership is the recommended next
   step.
2. **No end-user authentication.** There is no login/session layer, so
   `/orders` (server-rendered) is not filtered by owner. Wallet signatures
   protect funds, but order *visibility* is not access-controlled.
3. **No dispute/arbiter flow.** Release is buyer-authorized and refund is
   seller-authorized. There is no third-party arbiter; adding one requires a new
   contract state and role.
4. **Financial math uses JavaScript `number`** in `pricing.ts` before conversion
   to stroops. Prices are catalog-controlled and rounded, but an integer
   minor-unit representation would be safer for arbitrary catalogs.
5. **No Solana integration.** See [`solana.md`](solana.md) for the decision and
   a concrete adapter plan.
6. The contract has not been independently audited.

## Reporting a vulnerability

See [`SECURITY.md`](../SECURITY.md).
