# Stellar & Soroban

The storefront can settle orders on Stellar using a Soroban escrow contract, with
wallet-based signing in the browser and an indexer that reconciles on-chain events.

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

## Develop the contract

```bash
cd contracts/escrow
cargo test                 # native unit tests (soroban-sdk testutils)
stellar contract build     # produces the deployable wasm (requires stellar-cli v25.2.0+)
```

## Local network

```bash
docker compose --profile stellar up stellar
```

This starts Stellar Quickstart in standalone mode with Soroban RPC exposed on
`http://localhost:8001`. Point `STELLAR_RPC_URL` at its `/soroban/rpc` path.

## Deploy the contract

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/escrow.wasm \
  --source <identity> \
  --network testnet
```

Record the printed contract id in `ESCROW_CONTRACT_ID`.

## Run the indexer

```bash
INDEXER_START_LEDGER=0 ORDERS_WEBHOOK_URL=http://localhost:3000/api/orders pnpm --filter @repo/indexer dev
```
