# Changelog

All notable changes to the AI Commerce Framework are documented here. This
project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-21

### Added

- Next.js storefront with catalog, cart, checkout, an AI assistant and a
  Stellar wallet escrow checkout.
- FastAPI AI service with OpenAI, Anthropic, local and offline providers.
- Soroban escrow contract plus a typed TypeScript SDK and an event indexer.
- File-backed order store fed by HMAC-signed indexer webhooks, an `/orders`
  dashboard, and buyer-release / seller-refund actions.
- Vitest coverage for pricing, event decoding, order storage, webhook
  signatures and action validation; strict mypy in CI.
- Live testnet escrow `CBBWLHEI3HUBZOVHCKSYGARLRGZYQ4VZCHYBYAIQN2A727J3COI7LMOQ`
  with a verified `create -> fund -> release` smoke run.

### Fixed

- Event decoding now reads the event name and order id from the correct topics
  and parses the body; amounts are JSON-safe.
- Orders are priced server-side from the catalog instead of trusting the client.
- Failed transactions no longer report success or clear the cart.
- Escrow `create` requires buyer authorization and persistent entries are
  TTL-bumped.
- Local network defaults point at the Quickstart port; the indexer advances its
  cursor when no events are found.

### Security

- Escrow tests cover missing auth, wrong executor, deadline violations and
  duplicate release.
