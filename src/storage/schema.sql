-- Blockbuster: Underground Database Schema (SQLite / SQLCipher)

CREATE TABLE IF NOT EXISTS real_estate_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  base_yield_per_min_cents INTEGER NOT NULL,
  is_compromised INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_operatives (
  id TEXT PRIMARY KEY NOT NULL,
  codename TEXT NOT NULL,
  role TEXT CHECK(role IN ('BENJAMIN', 'ELIAS', 'OPERATOR')) NOT NULL,
  status TEXT CHECK(status IN ('ACTIVE', 'BURNT', 'INCARCERATED', 'ON_COOLDOWN')) NOT NULL DEFAULT 'ACTIVE',
  tier INTEGER NOT NULL DEFAULT 1,
  salary_per_minute_cents INTEGER NOT NULL,
  efficiency REAL NOT NULL DEFAULT 1.0,
  heat_generated_per_min REAL NOT NULL DEFAULT 0.0,
  heat_dissipation_per_min REAL NOT NULL DEFAULT 0.0,
  sanity_drain_rate REAL NOT NULL DEFAULT 0.0,
  durability REAL NOT NULL DEFAULT 1.0,
  assigned_node_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(assigned_node_id) REFERENCES real_estate_nodes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS game_saves (
  id TEXT PRIMARY KEY NOT NULL,
  player_alias TEXT NOT NULL,
  cash_cents INTEGER NOT NULL,
  sanity REAL NOT NULL,
  heat REAL NOT NULL,
  distortion_index REAL NOT NULL,
  total_ticks INTEGER NOT NULL,
  last_tick_epoch_ms INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
