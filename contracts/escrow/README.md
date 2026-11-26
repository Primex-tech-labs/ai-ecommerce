# Escrow (Soroban)

A minimal escrow contract for the AI commerce storefront. It holds a payment token
until the buyer releases it to the seller, the seller refunds it to the buyer, or
a configured arbiter resolves a dispute.

## Lifecycle

```
create -> Created -> fund -> Funded -> release -> Released
                                   \-> refund  -> Refunded
                                   \-> dispute -> Disputed -> resolve(release) -> Released
                                                           \-> resolve(refund) -> Refunded
```

- `create(order_id, buyer, seller, arbiter, token, amount)` — register a new escrow and its arbiter
- `fund(order_id)` — buyer transfers the amount into the contract
- `release(order_id)` — buyer authorizes payment to the seller
- `refund(order_id)` — seller returns funds to the buyer
- `dispute(order_id, initiator)` — buyer or seller opens a dispute on a funded order
- `resolve(order_id, arbiter, release_to_seller)` — arbiter pays the seller or refunds the buyer
- `get(order_id)` — read the escrow record

Only the configured arbiter can resolve, and only while the order is `Disputed`.
The arbiter is stored per order, so it cannot touch unrelated orders.

Errors: `AlreadyExists=1`, `NotFound=2`, `InvalidStatus=3`, `InvalidAmount=4`,
`NotArbiter=5`, `NotParty=6`.

Events: `created`, `funded`, `released`, `refunded`, `disputed`. Resolution emits
the existing `released`/`refunded` event.

## Develop

```bash
cargo test
```

On Windows the host `cdylib` may fail to link (PE export limit). Run tests in WSL,
or temporarily set `crate-type = ["rlib"]` in `Cargo.toml`. CI runs the full suite
on Linux.

## Build the wasm

```bash
# with the Stellar CLI installed
stellar contract build
```

The contract targets `soroban-sdk` v28. Deploy with `stellar contract deploy` (or
the `@repo/stellar` deploy script) and record the resulting contract id in
`ESCROW_CONTRACT_ID`.

> The dispute flow adds an `arbiter` argument to `create`. Redeploy the contract
> and update `ESCROW_CONTRACT_ID` before enabling disputes in the app.
