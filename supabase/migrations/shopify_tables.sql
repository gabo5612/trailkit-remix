-- TrailKit Shopify App — New tables to add to your existing Supabase project
-- Run this in Supabase Dashboard → SQL Editor
-- This does NOT touch any existing tables (licenses, checkins, etc.)

-- ── Shopify OAuth sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopify_sessions (
  id           TEXT PRIMARY KEY,
  shop         TEXT NOT NULL,
  state        TEXT,
  is_online    BOOLEAN DEFAULT false,
  scope        TEXT,
  expires      TIMESTAMPTZ,
  access_token TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop ON shopify_sessions(shop);

-- ── Shops (one row per installed store) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS shopify_shops (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop           TEXT UNIQUE NOT NULL,
  plan           TEXT DEFAULT 'free',        -- free | pro
  subscription_id TEXT,
  installed_at   TIMESTAMPTZ DEFAULT now(),
  uninstalled_at TIMESTAMPTZ
);

-- ── Trail guides (one per shop, multiple allowed) ─────────────────────────
CREATE TABLE IF NOT EXISTS shopify_guides (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT 'New Guide',
  description   TEXT,
  cover_image_url TEXT,
  center_lat    NUMERIC(10, 7),
  center_lng    NUMERIC(10, 7),
  zoom_level    INTEGER DEFAULT 12,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopify_guides_shop ON shopify_guides(shop);

-- ── Routes (GPX-based, belong to a guide) ────────────────────────────────
CREATE TABLE IF NOT EXISTS shopify_routes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id        UUID NOT NULL REFERENCES shopify_guides(id) ON DELETE CASCADE,
  shop            TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT 'Route',
  color           TEXT DEFAULT '#ef4444',
  difficulty      TEXT DEFAULT 'moderate',   -- easy | moderate | hard | expert
  distance_km     NUMERIC(8, 2),
  elevation_gain_m INTEGER,
  gpx_data        TEXT,                       -- raw GPX XML
  route_coords    JSONB,                      -- [[lat,lng], ...] parsed from GPX
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopify_routes_guide ON shopify_routes(guide_id);
CREATE INDEX IF NOT EXISTS idx_shopify_routes_shop  ON shopify_routes(shop);

-- ── Points of Interest ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopify_pois (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id    UUID NOT NULL REFERENCES shopify_guides(id) ON DELETE CASCADE,
  shop        TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT 'POI',
  description TEXT,
  lat         NUMERIC(10, 7) NOT NULL,
  lng         NUMERIC(10, 7) NOT NULL,
  icon_type   TEXT DEFAULT 'default',       -- default | camping | water | viewpoint | danger | parking
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopify_pois_guide ON shopify_pois(guide_id);
CREATE INDEX IF NOT EXISTS idx_shopify_pois_shop  ON shopify_pois(shop);

-- ── RLS: only accessible via service role key (same pattern as existing tables)
ALTER TABLE shopify_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_shops    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_guides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_routes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_pois     ENABLE ROW LEVEL SECURITY;
