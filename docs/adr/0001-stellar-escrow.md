# ADR 0001: Use Stellar/Soroban for escrow settlement

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

The storefront needs a payment path where a buyer's funds are held until the
buyer confirms delivery, with a refund path controlled by the seller. The
settlement layer must be inexpensive, have a mature testnet, and expose
programmatic transaction building so the browser can sign with a user's wallet
while the server stays non-custodial.

## Decision

Use a Soroban smart contract on Stellar as the escrow settlement layer, with:

- a typed TypeScript SDK (`packages/stellar`) that builds unsigned transactions,
- server routes that prepare transactions and never hold user keys,
- an event indexer that converts on-chain events into an off-chain order read
  model.

The contract enforces the state machine and the authorization rules
(buyer-authorizes create/fund/release, seller-authorizes refund).

## Alternatives considered

- **Custodial processor (Stripe-style):** simpler, but requires holding funds and
  KYC, and is not aligned with the project's on-chain settlement goal.
- **EVM/Solidity:** viable, but higher fees and a different toolchain; Stellar's
  low fees and Soroban SDK fit the existing stack.
- **No blockchain (database-only escrow):** loses verifiable, non-custodial
  settlement.

## Consequences

- Funds and state live on-chain; the web app stores only a derived read model.
- Users need a Stellar wallet and the correct network configuration.
- We must run and maintain an indexer to keep the read model in sync.
- Authorization is enforced by the contract, so the server can remain
  non-custodial; the trade-off is that refunds require the seller's signature.

## Follow-ups

- Wire the order read model to PostgreSQL for multi-instance deployments.
- Add a dispute/arbiter state if the product requires third-party resolution.
- Independent security audit before any mainnet deployment.
