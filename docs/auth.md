# Authentication and order ownership

Authentication is available when PostgreSQL is configured (`DATABASE_URL`). The
app uses server-side sessions and Node's built-in scrypt password hashing — no
third-party auth service and no custom cryptography.

## Architecture

- **Accounts** live in `users` (`email` unique case-insensitively, `password_hash`,
  `role`).
- **Sessions** live in `sessions` (`id`, `user_id`, `expires_at`, `revoked_at`,
  `user_agent`, `ip`). The browser holds only an opaque random session id in an
  `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie (`primex_session`).
- Passwords are hashed with `scrypt` (Node `crypto`) using a per-password salt;
  verification uses a timing-safe comparison.
- The authenticated identity is always derived from the verified session cookie —
  never from a client-supplied user id.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | email + password (min 10 chars); starts a session |
| POST | `/api/auth/login` | generic `invalid email or password` on failure |
| POST | `/api/auth/logout` | revokes the session and clears the cookie |

Rate limits (PostgreSQL-backed fixed window):

- register: 10 / hour per `ip|email`
- login: 10 / 15 min per `ip|email`
- checkout: 20 / hour per user
- successful auth responses set the session cookie; failures do not reveal
  whether an account exists.

`TRUST_PROXY=1` enables use of `x-forwarded-for`/`x-real-ip`. Leave it unset
unless the app is behind a trusted proxy that overwrites those headers.

## Order ownership

- Checkout (`POST /api/payments/stellar`) requires a session when auth is enabled
  and binds the order id to the authenticated user (`orders.owner_id`).
- `/orders` is owner-scoped: a signed-in user only sees their own orders. Without
  a database (dev/e2e), the legacy behaviour lists all orders.
- Private order endpoints (`release`, `refund`, `dispute`, `resolve`) require a
  session when auth is enabled, in addition to the existing party/arbiter checks.
- Fund movement is still authorized on-chain: `release` requires the buyer's
  signature, `refund` the seller's, and `resolve` the arbiter's. The server only
  prepares unsigned transactions.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Enables PostgreSQL, authentication, ownership and rate limiting |
| `SESSION_TTL_SECONDS` | Session lifetime (default 604800 = 7 days) |
| `TRUST_PROXY` | Trust `x-forwarded-for` / `x-real-ip` (default off) |

## Limitations

- **Wallet ↔ account linking is not implemented.** A user account owns the orders
  it creates at checkout, but the app does not cryptographically prove that the
  account controls the buyer/seller wallet address. Fund movement remains
  protected by on-chain signatures; order *visibility* is protected by sessions.
- Auth is disabled when no database is configured (development/e2e only).
- No password reset or email verification is implemented yet.
- Rate limiting for the AI service and webhook endpoint is not wired here (the
  webhook is HMAC-authenticated and retried intentionally).
