# Escrow (Soroban)

A minimal escrow contract for the AI commerce storefront. It holds a payment token until
the buyer releases it to the seller, or the seller refunds it to the buyer.

## Lifecycle

```
create -> Created -> fund -> Funded -> release -> Released
                                   \-> refund  -> Refunded
```

- `create(order_id, buyer, seller, token, amount)` — register a new escrow
- `fund(order_id)` — buyer transfers the amount into the contract
- `release(order_id)` — buyer authorizes payment to the seller
- `refund(order_id)` — seller returns funds to the buyer
- `get(order_id)` — read the escrow record

Events: `created`, `funded`, `released`, `refunded`.

## Develop

```bash
cargo test
```

## Build the wasm

```bash
# with the Stellar CLI installed
stellar contract build
```

The contract targets `soroban-sdk` v28. Deploy with `stellar contract deploy` and record
the resulting contract id in `ESCROW_CONTRACT_ID`.
