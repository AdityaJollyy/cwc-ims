-- ============================================================
-- CWC Inventory Management — Database Schema
-- ============================================================
-- Single source of truth. Run via: node seed.js
-- (or paste into Supabase SQL Editor after dropping all tables)
--
-- Employee IDs : manually entered by admin (e.g. "EMP001").
-- Assets       : identified internally by UUID only — no human-facing
--                code. Display uses product_name / serial_number.
--
-- "Returnable vs consumed-on-issue" for bulk-inventory items
-- is a per-issuance decision — recorded on consumable_assignments,
-- NOT on the consumables table itself, so the same item (e.g. mouse)
-- can be issued either way.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  full_name     TEXT,
  role          TEXT        NOT NULL DEFAULT 'viewer'
                            CHECK (role IN ('super_admin', 'admin', 'viewer')),
  password_hash TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Categories ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        UNIQUE NOT NULL,
  description TEXT,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Category Custom Fields ────────────────────────────────────
CREATE TABLE IF NOT EXISTS category_fields (
  id            SERIAL      PRIMARY KEY,
  category_id   INTEGER     NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  field_name    TEXT        NOT NULL,
  field_label   TEXT        NOT NULL,
  field_type    TEXT        NOT NULL DEFAULT 'text'
                CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select')),
  field_options JSONB,
  is_required   BOOLEAN     NOT NULL DEFAULT false,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, field_name)
);

-- ─── Employees ────────────────────────────────────────────────
-- employee_id is entered by admin and serves as the unique display identifier.
-- The internal UUID (id) is used for all foreign key relationships.
CREATE TABLE IF NOT EXISTS employees (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,
  division    TEXT,
  designation TEXT,
  mobile      TEXT,
  email       TEXT,
  remarks     TEXT,
  is_archived BOOLEAN     NOT NULL DEFAULT false,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_archived  ON employees(is_archived);

-- ─── Assets ───────────────────────────────────────────────────
-- Identified internally by UUID (id). No human-facing code.
CREATE TABLE IF NOT EXISTS assets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     INTEGER     NOT NULL REFERENCES categories(id),
  product_name    TEXT,
  model           TEXT,
  serial_number   TEXT,
  asset_number    TEXT,
  purchase_date   DATE,
  warranty_expiry DATE,
  status          TEXT        NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'assigned', 'under_repair', 'damaged', 'retired')),
  custom_fields   JSONB       DEFAULT '{}',
  remarks         TEXT,
  created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_category_id ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_status      ON assets(status);

-- ─── Asset Assignments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID        NOT NULL REFERENCES employees(id),
  asset_id         UUID        NOT NULL REFERENCES assets(id),
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  returned_at      TIMESTAMPTZ,
  return_condition TEXT        CHECK (return_condition IN ('good', 'damaged')),
  returned_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  return_remarks   TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  remarks          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_employee_id ON assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_asset_id    ON assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_assignments_is_active   ON assignments(is_active);

-- ─── Consumables (Bulk Inventory) ─────────────────────────────
-- Items bought in bulk: cartridges, cables, mice, keyboards, etc.
-- Whether an issuance is returnable or consumed is decided at issue
-- time (consumable_assignments.is_returnable), not here.
CREATE TABLE IF NOT EXISTS consumables (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  category         TEXT,
  unit             TEXT,
  current_stock    INTEGER     NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  damaged_quantity INTEGER     NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
  remarks          TEXT,
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Stock Transactions ───────────────────────────────────────
-- Audit log for every stock movement: in, out, damaged, issued, returned.
-- employee_id is populated only for issued / returned movements.
CREATE TABLE IF NOT EXISTS stock_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id    UUID        NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  transaction_type TEXT        NOT NULL
                   CHECK (transaction_type IN ('stock_in', 'stock_out', 'damaged', 'issued', 'returned')),
  quantity         INTEGER     NOT NULL CHECK (quantity >= 0),
  reference        TEXT,
  remarks          TEXT,
  performed_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  employee_id      UUID        REFERENCES employees(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_consumable_id ON stock_transactions(consumable_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_employee_id   ON stock_transactions(employee_id);

-- ─── Consumable Assignments (Issuances) ──────────────────────
-- Tracks each issuance of a bulk-inventory item to an employee.
--   is_returnable = true  → must be returned later (e.g. mouse, keyboard)
--   is_returnable = false → consumed on issue (e.g. cartridge, ink);
--                           record is kept for history but is_active
--                           closes immediately.
CREATE TABLE IF NOT EXISTS consumable_assignments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id     UUID        NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  employee_id       UUID        NOT NULL REFERENCES employees(id),
  quantity          INTEGER     NOT NULL CHECK (quantity > 0),
  is_returnable     BOOLEAN     NOT NULL DEFAULT false,
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  returned_at       TIMESTAMPTZ,
  returned_quantity INTEGER     CHECK (returned_quantity IS NULL OR returned_quantity >= 0),
  return_condition  TEXT        CHECK (return_condition IN ('good', 'damaged')),
  returned_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  return_remarks    TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  remarks           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cons_assignments_consumable    ON consumable_assignments(consumable_id);
CREATE INDEX IF NOT EXISTS idx_cons_assignments_employee      ON consumable_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_cons_assignments_is_active     ON consumable_assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_cons_assignments_is_returnable ON consumable_assignments(is_returnable);

-- ─── Auto-update updated_at trigger function ──────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_assignments_updated_at
    BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_consumables_updated_at
    BEFORE UPDATE ON consumables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_consumable_assignments_updated_at
    BEFORE UPDATE ON consumable_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
