# Solana integration decision

**Status: not implemented.** This document records the decision and a concrete
plan. No Solana code, wallet adapter, transaction, or placeholder UI exists in
this repository.

## Decision

Do **not** add Solana at this time.

## Rationale

- The product's settlement model is built around a specific Stellar/Soroban
  escrow contract with buyer/seller authorization rules and an event indexer.
  Porting it is non-trivial and cannot be done safely by superficial stubbing.
- Multi-chain support adds wallet-adapter complexity, a second transaction
  verifier, a second indexer, and a second set of assets to reconcile.
- Adding a nonfunctional Solana path would misrepresent the project's
  capabilities and increase the security surface without user value.

## If multi-chain support becomes justified

Introduce a payment adapter boundary rather than branching inside existing code:

```
packages/payments/            (shared interface + order/payment types)
  core/                       shared order + payment contracts
  stellar/                    current @repo/stellar implementation
  solana/                     new implementation
```

The interface would cover:

- `createPaymentIntent(order) -> UnsignedTransactionLike`
- `submitSignedTransaction(payload) -> { hash, status }`
- `readPaymentStatus(orderId) -> PaymentStatus`
- `subscribeEvents(cursor, handler)` for the indexer

Each adapter has its own network config, verification rules, and event
decoding. The order read model and state machine remain chain-agnostic.

### Required work before shipping Solana

1. Define the shared payment adapter interface and refactor Stellar to
   implement it (no behavior change).
2. Implement a Solana escrow program or integrate an audited one.
3. Add a Solana wallet adapter, network switching, and transaction verification.
4. Add a Solana indexer with a persisted cursor and idempotent processing.
5. Add tests (unit + local validator integration) and documentation.
6. Keep Stellar assets, addresses, and transactions strictly separated from
   Solana ones.

Until all of the above is done and verified, the project remains Stellar-only.
