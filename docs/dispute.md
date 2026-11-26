# Dispute and arbiter flow

A funded escrow can be escalated to a dispute and resolved by a configured
arbiter. This document describes the contract and application behaviour.

## Design

- **Arbiter is per order.** It is set when the order is created
  (`create(order_id, buyer, seller, arbiter, token, amount)`), so an arbiter for
  one order cannot resolve another.
- **Either party can escalate.** The buyer or the seller may open a dispute on a
  `Funded` order.
- **Only the arbiter resolves.** The arbiter chooses to release the escrow to the
  seller or refund the buyer. Resolution is a normal token transfer from the
  contract, so no new custody model is introduced.
- **One-way state machine.** A dispute can only be opened from `Funded`, and can
  only be resolved once. Duplicate resolution is rejected by the status check.

```
Created --fund--> Funded --dispute--> Disputed --resolve(release=true)--> Released
                                        \------resolve(release=false)----> Refunded
```

## Contract API (soroban-sdk v28)

| Function | Caller | Effect |
| --- | --- | --- |
| `create(order_id, buyer, seller, arbiter, token, amount)` | buyer | Creates escrow, records arbiter |
| `fund(order_id)` | buyer | Moves tokens into the contract |
| `release(order_id)` | buyer | Pays the seller (non-disputed path) |
| `refund(order_id)` | seller | Refunds the buyer (non-disputed path) |
| `dispute(order_id, initiator)` | buyer or seller | Marks the order `Disputed` |
| `resolve(order_id, arbiter, release_to_seller)` | arbiter | Pays seller or refunds buyer |
| `get(order_id)` | anyone | Reads the escrow record |

Errors: `AlreadyExists=1`, `NotFound=2`, `InvalidStatus=3`, `InvalidAmount=4`,
`NotArbiter=5`, `NotParty=6`.

Events: `created`, `funded`, `released`, `refunded`, `disputed`. Resolution emits
the existing `released` or `refunded` event, which the indexer already understands.

## Application API

- `POST /api/orders/:orderId/dispute` with `{ source }`
  - `source` must equal the order buyer or seller.
  - Order must be `funded`.
  - Returns an unsigned XDR for the browser to sign.
- `POST /api/orders/:orderId/resolve` with `{ source, decision }`
  - `source` must equal `STELLAR_ARBITER_ADDRESS`.
  - `decision` is `"release"` (pay seller) or `"refund"` (pay buyer).
  - Order must be `disputed`.

Both routes return `409` for wrong state, `403` for unauthorised actors, and
`503` when Stellar is not configured. The browser signs the XDR and submits it to
`POST /api/payments/stellar/submit`.

## Indexer and order state

The contract emits a `disputed` event when a dispute opens; the indexer forwards
it (HMAC-signed) and the order read model transitions `funded -> disputed`.
Resolution emits `released` or `refunded`, returning the order to a terminal
state. The order store is forward-only, so duplicate or out-of-order events are
ignored.

## Deployment note

The dispute flow changes the `create` ABI (an `arbiter` argument). Deploy the
updated contract, then set:

```
ESCROW_CONTRACT_ID=<new contract id>
STELLAR_ARBITER_ADDRESS=<arbiter public key>
NEXT_PUBLIC_STELLAR_ARBITER_ADDRESS=<same, for UI visibility>
```

The arbiter public key is not secret; it only needs to sign resolutions.

## Trust assumptions and limitations

- The arbiter is a trusted third party. A malicious arbiter could resolve a
  dispute incorrectly, but cannot touch non-disputed or unrelated orders.
- There is no on-chain appeal or decentralised jury.
- There is no dispute deadline/timing rule yet; either party can escalate any
  funded order.
- Review [`security-model.md`](security-model.md) for the full threat model.
