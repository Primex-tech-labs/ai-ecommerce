# Stellar & Soroban

The storefront can settle orders on Stellar using a Soroban escrow contract, with
wallet-based signing in the browser and an indexer that decodes on-chain events and
forwards them to an orders webhook.

## Components

- `contracts/escrow` — Rust/Soroban escrow contract (`create`, `fund`, `release`, `refund`, `get`)
- `packages/stellar` — typed TypeScript client (`@repo/stellar`) for config, contract calls,
  payments, and event reads
- `apps/web` — wallet connect, Stellar checkout, and API routes that build/submit transactions
- `apps/indexer` — polls escrow contract events, signs them, and forwards them to an orders webhook
- `.data/orders.json` — file-backed order store updated by the webhook (configurable via `ORDERS_FILE`)

## Payment flow

```
WalletConnectButton (browser)         -> connect Freighter / Stellar Wallets Kit
StellarCheckoutButton (browser)
  -> POST /api/payments/stellar       -> build create+fund tx, simulate, assemble -> unsigned XDR
  -> wallet signs the XDR
  -> POST /api/payments/stellar/submit-> submit signed XDR, poll for result, return explorer URL
apps/indexer                          -> watch escrow events, sign, POST /api/orders
apps/web order store                  -> verify HMAC, upsert order state
```

The merchant receives funds only after the buyer calls `release`. If fulfilment fails, the
seller can `refund`.

## Order lifecycle

```
created -> funded -> released
                  \-> refunded
```

1. The indexer decodes each escrow event (`created`, `funded`, `released`, `refunded`) and
   POSTs the JSON body to `ORDERS_WEBHOOK_URL`.
2. When `ORDERS_WEBHOOK_SECRET` is set, the indexer sends
   `x-indexer-signature: <hex HMAC-SHA256 of the raw body>`. The web route verifies it and
   rejects mismatches with `401`; without a secret the route logs a development warning and
   accepts the event.
3. `POST /api/orders` upserts the order into `ORDERS_FILE` (default `.data/orders.json`),
   guarded by an in-process write mutex.
4. The `/orders` page lists stored orders. `POST /api/orders/[orderId]/release` requires
   `source` to equal the order buyer; `POST /api/orders/[orderId]/refund` requires it to
   equal the seller. Each returns unsigned XDR for the wallet to sign, and the existing
   `/api/payments/stellar/submit` route submits it.

## Configuration

See `.env.example`. Keys:

| Variable                    | Purpose                                                  |
| --------------------------- | -------------------------------------------------------- |
| `STELLAR_NETWORK`           | `local` \| `testnet` \| `futurenet` \| `mainnet`         |
| `STELLAR_RPC_URL`           | Soroban RPC endpoint                                     |
| `STELLAR_HORIZON_URL`       | Horizon endpoint (classic payments)                      |
| `ESCROW_CONTRACT_ID`        | Deployed escrow contract id                              |
| `STELLAR_MERCHANT_ADDRESS`  | Seller address that receives escrowed funds              |
| `STELLAR_TOKEN_CONTRACT_ID` | Token contract (Stellar Asset Contract) used for payment (see [Test asset setup](#test-asset-sac-setup)) |
| `STELLAR_ASSET_CODE`        | Asset code used by `setup:sac` (1-12 alphanumeric characters) |
| `STELLAR_ASSET_ISSUER`      | Funded issuer account used by `setup:sac`                |
| `STELLAR_ASSET_ISSUER_SECRET` | Issuer secret used only by `setup:sac`; never commit it |
| `ORDERS_FILE`               | JSON order store path (default `.data/orders.json`)      |
| `ORDERS_WEBHOOK_URL`        | Webhook target for indexer events                        |
| `ORDERS_WEBHOOK_SECRET`     | Shared secret used to sign and verify webhook bodies     |

## Test asset (SAC) setup

Checkout moves value through a Stellar Asset Contract (SAC). Native XLM already
has one; a custom asset needs a funded issuer, an on-chain SAC instance, and
trustlines for the accounts that hold it.

### 1. Create and fund the issuer

The issuer must be a funded account on the target network. On testnet, the
Stellar CLI can create and fund one in a single step:

```bash
stellar keys generate issuer --network testnet --fund
stellar keys address issuer
```

Or fund an existing account with Friendbot:

```bash
curl "https://friendbot.stellar.org/?addr=<ISSUER_PUBLIC_KEY>"
```

For a throwaway demo keypair:

```ts
import { Keypair } from "@stellar/stellar-sdk";

const issuer = Keypair.random();
console.log(issuer.publicKey(), issuer.secret());
```

### 2. Create the SAC

The SAC id is deterministic: it is derived from the asset and the network
passphrase, so the script can print it before the contract exists. Run:

```bash
STELLAR_NETWORK=testnet \
STELLAR_ASSET_CODE=USDC \
STELLAR_ASSET_ISSUER=<ISSUER_PUBLIC_KEY> \
STELLAR_ASSET_ISSUER_SECRET=<ISSUER_SECRET> \
  pnpm --filter @repo/stellar setup:sac
```

The script loads the issuer account, submits
`Operation.createStellarAssetContract`, and prints the result:

```json
{"msg":"issuer","publicKey":"G...","network":"testnet","rpcUrl":"https://soroban-testnet.stellar.org"}
{"msg":"asset","code":"USDC","issuer":"G...","contractId":"C..."}
{"msg":"created","hash":"...","status":"SUCCESS","explorer":"https://stellar.expert/explorer/testnet/tx/..."}
{"msg":"sac","contractId":"C...","explorer":"https://stellar.expert/explorer/testnet/contract/C..."}
STELLAR_TOKEN_CONTRACT_ID=C...
```

Last verified testnet run (2026-10-25, throwaway `TSTDEMO` issuer):

```
STELLAR_TOKEN_CONTRACT_ID=CA4L6X62FJQA5SDVHYCIL3AEM63ZFV2Q72QQYJAM4ZAOFYFMGZNZQ4LS
creation tx: 0a2ef546b3b760fa7cf6f56717f684a42d4d3516254202574908c2749730ec28
```

That instance is a smoke-test artifact; create your own issuer and SAC for a
real checkout.

Copy the `STELLAR_TOKEN_CONTRACT_ID` line into `.env`. The checkout route
(`apps/web/src/app/api/payments/stellar/route.ts`) already passes this variable
to `buildCreateAndFundEscrow`, so no code change is needed after setting it.

The script fails with an actionable message when:

- a required environment variable is missing,
- `STELLAR_ASSET_ISSUER_SECRET` does not match `STELLAR_ASSET_ISSUER`,
- the issuer is not funded (it prints the Friendbot URL for the account).

Running it again for an existing asset reports `sac-exists` and prints the same
id instead of failing.

> Use a throwaway issuer on testnet. On mainnet the issuer needs real XLM for
> fees and the resulting contract controls a real asset; never paste a mainnet
> secret into a shell history or CI log.

### 3. Add trustlines and a balance

Stellar accounts must trust a non-native asset before they can hold it. The
buyer and the merchant both need a trustline, and the buyer needs a balance
before `fund` can move the asset into escrow.

With the Stellar CLI:

```bash
stellar tx new change-trust \
  --source <BUYER_IDENTITY> \
  --line "USDC:<ISSUER_PUBLIC_KEY>" \
  --network testnet

stellar tx new payment \
  --source issuer \
  --destination <BUYER_PUBLIC_KEY> \
  --asset "USDC:<ISSUER_PUBLIC_KEY>" \
  --amount 100 \
  --network testnet
```

Equivalent SDK operations:

```ts
import { Asset, Operation } from "@stellar/stellar-sdk";

const asset = new Asset("USDC", issuerPublicKey);
Operation.changeTrust({ asset });
Operation.payment({ destination: buyerPublicKey, asset, amount: "100" });
```

If a trustline is missing, `fund` fails during simulation because the escrow
contract cannot credit the buyer's balance.

### Deriving the id without creating it

The helper used by the tests is exported from `@repo/stellar`:

```ts
import { Networks } from "@stellar/stellar-sdk";
import { deriveSacContractId } from "@repo/stellar";

deriveSacContractId("USDC", issuerPublicKey, Networks.TESTNET);
// CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```

`deriveNativeSacContractId(networkPassphrase)` returns the id for native XLM.

## Deployed contract (testnet)

An escrow instance is deployed to Stellar testnet:

```
ESCROW_CONTRACT_ID=CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ
https://stellar.expert/explorer/testnet/contract/CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ
```

This instance was deployed from the current source (buyer-authorized `create`,
TTL bumps, failure-aware settlement):

- wasm upload: `506edc4b3426de18b7068af9cb82c69e66d53a1cfd3d6811c6d1ccf9305db952`
- wasm sha256: `dd9edcedd1aa61a67d9d65caa07f5f5767e0955d2610098c5f29ba2ebb65aee5`
- contract creation: `198fab1b56f1fffeaf0b03dc2a5b274594692ccda03c640f58d7be70ea95a9c0`
- verified at ledger `5307853`, entry TTL extended to `5428812`

Verify it is live (reads the contract instance entry, so it fails for a missing
contract):

```bash
ESCROW_CONTRACT_ID=CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ \
  pnpm --filter @repo/stellar verify:contract
```

### Testnet smoke test

The smoke test deploys a fresh escrow from the locally built wasm, creates a Stellar
Asset Contract (SAC) for a throwaway asset, funds buyer and seller through Friendbot,
then exercises the full `create -> fund -> release` lifecycle with the
`@repo/stellar` transaction builders. Token balances are asserted before and after
each step, so a partial flow fails loudly.

It only runs when `STELLAR_SMOKE_TEST=1` is set, and it skips cleanly when Soroban RPC
is unreachable. Build the escrow wasm first (see
[Develop the contract](#develop-the-contract)):

```bash
cd contracts/escrow
stellar contract build
cd ../..

STELLAR_SMOKE_TEST=1 pnpm --filter @repo/stellar smoke:escrow
```

Optional environment variables:

| Variable                     | Default                         | Purpose                                                |
| ---------------------------- | ------------------------------- | ------------------------------------------------------ |
| `STELLAR_RPC_URL`            | testnet Soroban RPC             | RPC endpoint used for the run                          |
| `STELLAR_HORIZON_URL`        | testnet Horizon                 | Horizon endpoint for classic trustline/payment setup   |
| `STELLAR_NETWORK_PASSPHRASE` | testnet                         | Must resolve to the testnet passphrase                 |
| `STELLAR_FRIENDBOT`          | `https://friendbot.stellar.org` | Account funding endpoint                               |
| `STELLAR_SMOKE_ASSET_CODE`   | `SMOKE`                         | Asset code for the throwaway SAC (1-12 letters/digits) |

A successful run ends with a transcript like:

```json
{"msg":"network","rpcUrl":"https://soroban-testnet.stellar.org","status":"healthy","latestLedger":123}
{"msg":"sac","contractId":"C...","hash":"..."}
{"msg":"deployed","contractId":"C...","explorer":"https://stellar.expert/explorer/testnet/contract/C..."}
{"msg":"create","orderId":"smoke...","hash":"...","status":"SUCCESS"}
{"msg":"fund","orderId":"smoke...","hash":"...","status":"SUCCESS"}
{"msg":"release","orderId":"smoke...","hash":"...","status":"SUCCESS"}
{"msg":"balances","amount":"100000000","buyer":{"before":"...","after":"..."},"seller":{"before":"...","after":"..."},"escrow":{"before":"0","after":"0"}}
{"msg":"done","escrowContractId":"C...","sacContractId":"C...","orderId":"smoke...","wasmHash":"...","hashes":{"sac":"...","create":"...","fund":"...","release":"...","wasmUpload":"...","contractCreate":"..."}}
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
INDEXER_START_LEDGER=0 \
ORDERS_WEBHOOK_URL=http://localhost:3000/api/orders \
ORDERS_WEBHOOK_SECRET=dev-secret \
  pnpm --filter @repo/indexer dev
```

Set the same `ORDERS_WEBHOOK_SECRET` on the web app so it can verify the
`x-indexer-signature` header. If it is unset, the webhook still accepts events but logs a
development-only warning.
