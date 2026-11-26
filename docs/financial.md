# Monetary units and asset precision

This document defines the canonical money representation so amounts are not
silently misinterpreted.

## Canonical representation

- **Catalog price (`variant.price.amount`)** is an **integer in major units of
  the settlement asset** (for the current XLM/stellar-asset checkout, e.g.
  `399` means `399` units). It is not cents and not a float.
  - Note: the catalog's `currency: "USD"` field is **display metadata only** and
    is not used in settlement. The asset actually settled is the Stellar Asset
    Contract configured in `STELLAR_TOKEN_CONTRACT_ID`.
- **Cart totals** are computed in integer major units with `Number` safe-integer
  checks (`apps/web/src/lib/pricing.ts`); fractional or overflowing totals throw.
- **Stored order amounts** are integer **stroops** (`orders.amount_stroops`,
  `bigint`), including the arber/settlement amount.
- **Transaction amounts** are integer stroops passed to the Soroban contract
  (`i128`).

## Conversion

- 1 Stellar asset unit = `10,000,000` stroops (7 decimal places).
- `toTokenAmount` / `toAssetStroops` use `BigInt` only, reject zero/negative/
  fractional inputs, and reject values above `i64::MAX`.
- The checkout recomputes the total server-side from the catalog; client prices
  are never trusted.

## Asset identity and precision

- Assets are identified by **network + code + issuer** (credit) or **native**
  (XLM). Symbol alone is not an identity.
- All Stellar classic assets (native and issued, including SAC-wrapped assets)
  use **7 decimals**. Non-Stellar assets are not supported.
- `apps/web/src/lib/asset.ts` validates asset code/issuer and converts amounts.
- Checkout requires `STELLAR_TOKEN_CONTRACT_ID` to be a valid Stellar contract
  address; arbitrary/misconfigured target contracts are rejected.

## Known limitations

- The storefront settles in a single configured Stellar asset; per-asset
  precision beyond Stellar's uniform 7 decimals is not implemented.
- The catalog `currency` label ("USD") is cosmetic and should be aligned with the
  configured settlement asset in a future change.
