-- Initial schema for the AI commerce storefront.
-- Requires PostgreSQL 14+ (uses built-in gen_random_uuid()).

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_uniq ON users (lower(email));

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  user_agent text,
  ip text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE orders (
  id text PRIMARY KEY,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  buyer text NOT NULL DEFAULT '',
  seller text NOT NULL DEFAULT '',
  arbiter text,
  token text NOT NULL DEFAULT '',
  asset_code text,
  asset_issuer text,
  network text,
  escrow_contract_id text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('created', 'funded', 'disputed', 'released', 'refunded')),
  status_rank smallint NOT NULL CHECK (status_rank BETWEEN 1 AND 4),
  ledger bigint NOT NULL DEFAULT 0,
  amount_stroops bigint NOT NULL DEFAULT 0 CHECK (amount_stroops >= 0),
  create_tx_hash text,
  fund_tx_hash text,
  dispute_tx_hash text,
  release_tx_hash text,
  refund_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_owner_idx ON orders (owner_id);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_updated_idx ON orders (updated_at DESC);

CREATE TABLE order_items (
  id bigserial PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id text NOT NULL,
  product_id text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_major bigint NOT NULL CHECK (unit_price_major >= 0),
  line_total_stroops bigint NOT NULL CHECK (line_total_stroops >= 0)
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

CREATE TABLE payments (
  id bigserial PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('created', 'funded', 'disputed', 'released', 'refunded')),
  tx_hash text NOT NULL,
  ledger bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, kind, tx_hash)
);
CREATE INDEX payments_order_idx ON payments (order_id);

CREATE TABLE disputes (
  id bigserial PRIMARY KEY,
  order_id text NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  initiator text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved_seller', 'resolved_buyer')),
  opened_tx_hash text,
  resolved_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE indexer_state (
  id text PRIMARY KEY,
  cursor bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rate_limits (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
