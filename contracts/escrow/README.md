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

On Windows the host `cdylib` may fail to link (PE export limit). Run tests in WSL, or
temporarily set `crate-type = ["rlib"]` in `Cargo.toml`. CI runs the full suite on Linux.

## Build the wasm

```bash
# with the Stellar CLI installed
stellar contract build
```

The contract targets `soroban-sdk` v28. Deploy with `stellar contract deploy` (or the
`@repo/stellar` deploy script) and record the resulting contract id in
`ESCROW_CONTRACT_ID`.

A testnet instance is deployed at `CCFAUBBGENQD76EIRC7NJ3LFTDJEMSUFJ7UBWP3F6SHMFLX2HRVAB4CV`.
