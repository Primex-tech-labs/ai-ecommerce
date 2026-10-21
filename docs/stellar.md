# Stellar & Soroban

The storefront can settle orders on Stellar using a Soroban escrow contract, with
wallet-based signing in the browser and an indexer that decodes on-chain events and
forwards them to an orders webhook.

## Components

- `contracts/escrow` — Rust/Soroban escrow contract (`create`, `fund`, `release`, `refund`, `get`)
- `packages/stellar` — typed TypeScript client (`@repo/stellar`) for config, contract calls,
  payments, and event reads
- `apps/web` — wallet connect, Stellar checkout, and API routes that build/submit transactions
- `apps/indexer` — polls escrow contract events and forwards them to an orders webhook

## Payment flow

```
WalletConnectButton (browser)         -> connect Freighter / Stellar Wallets Kit
StellarCheckoutButton (browser)
  -> POST /api/payments/stellar       -> build create+fund tx, simulate, assemble -> unsigned XDR
  -> wallet signs the XDR
  -> POST /api/payments/stellar/submit-> submit signed XDR, poll for result, return explorer URL
apps/indexer                          -> watch escrow events, notify orders webhook
```

The merchant receives funds only after the buyer calls `release`. If fulfilment fails, the
seller can `refund`.

## Configuration

See `.env.example`. Keys:

| Variable | Purpose |
| --- | --- |
| `STELLAR_NETWORK` | `local` \| `testnet` \| `futurenet` \| `mainnet` |
| `STELLAR_RPC_URL` | Soroban RPC endpoint |
| `STELLAR_HORIZON_URL` | Horizon endpoint (classic payments) |
| `ESCROW_CONTRACT_ID` | Deployed escrow contract id |
| `STELLAR_MERCHANT_ADDRESS` | Seller address that receives escrowed funds |
| `STELLAR_TOKEN_CONTRACT_ID` | Token contract (Stellar Asset Contract) used for payment |

## Deployed contract (testnet)

An escrow instance is deployed to Stellar testnet:

```
ESCROW_CONTRACT_ID=CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ
https://stellar.expert/explorer/testnet/contract/CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ
```

This instance was deployed from the current source (buyer-authorized `create`,
TTL bumps, failure-aware settlement):

- wasm upload: `506edc4b3426de18b7068af9cb82c69e66d53a1cfd3d6811c6d1ccf9305db952`
- contract creation: `198fab1b56f1fffeaf0b03dc2a5b274594692ccda03c640f58d7be70ea95a9c0`
- verified at ledger `5307853`, entry TTL extended to `5428812`

Verify it is live (reads the contract instance entry, so it fails for a missing
contract):

```bash
ESCROW_CONTRACT_ID=CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ \
  pnpm --filter @repo/stellar verify:contract
```

End-to-end testnet smoke test (creates two funded accounts, then runs
`create -> fund -> release` with the native XLM Stellar Asset Contract):

```bash
ESCROW_CONTRACT_ID=CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ \
  pnpm --filter @repo/stellar smoke:escrow
```

Expected: the seller's balance increases by the escrowed amount. Last verified
run (`ordermvhpnyas`, seller +1 XLM):

```
{"msg":"create","hash":"9d6fba6d7aacd6c86c42f3f3bba8b19d5f5bfcfaf20c896de3a49aba27d7c6c9"}
{"msg":"fund","hash":"1f1a33fd30f18f3197eb21368069c87668d917a1eb650f255b8ac5c9c673f53f"}
{"msg":"release","hash":"e4be8aad5ef404f4f01bbf145c65925b4a62e228f2d4d0680025eda25b70bdf3"}
{"msg":"done","sellerBefore":"100000000000","sellerAfter":"100010000000"}
```

## Develop the contract

```bash
cd contracts/escrow
cargo test                 # native unit tests (soroban-sdk testutils)
stellar contract build     # canonical deployable wasm (requires stellar-cli v25.2.0+)
```

If `stellar-cli` is unavailable, a wasm can still be produced for local deployment with:

```bash
SOROBAN_SDK_BUILD_SYSTEM_SUPPORTS_SPEC_SHAKING_V2=true \
  cargo build --target wasm32v1-none --release
```

That build skips spec shaking, so prefer `stellar contract build` for a canonical artifact.

> Windows note: native `cargo test` may fail to link the host `cdylib` (PE export limit).
> Test via WSL, or temporarily set `crate-type = ["rlib"]` in `contracts/escrow/Cargo.toml`.
> CI runs the full suite on Linux.

## Local network

```bash
docker compose --profile stellar up stellar
```

This starts Stellar Quickstart in standalone mode with Soroban RPC exposed on
`http://localhost:8001`. Point `STELLAR_RPC_URL` at its `/soroban/rpc` path.

## Deploy the contract

Using the bundled SDK script (no `stellar-cli` required):

```bash
pnpm --filter @repo/stellar deploy:escrow
```

It generates a funded testnet account via Friendbot, uploads the wasm, creates the
contract instance, and prints the contract id. Record it in `ESCROW_CONTRACT_ID`.

Or with the Stellar CLI:

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/escrow.wasm \
  --source <identity> \
  --network testnet
```

## Run the indexer

```bash
INDEXER_START_LEDGER=0 ORDERS_WEBHOOK_URL=http://localhost:3000/api/orders pnpm --filter @repo/indexer dev
```
