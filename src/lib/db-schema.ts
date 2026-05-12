// ============================================================
// Database Schema — SQLite
// ============================================================

export const SCHEMA_SQL = `
-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('print', 'scan')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'active', 'completed', 'expired', 'cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

-- Print Jobs
CREATE TABLE IF NOT EXISTS print_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  total_pages INTEGER NOT NULL,
  color_mode TEXT NOT NULL DEFAULT 'bw' CHECK(color_mode IN ('bw', 'color')),
  duplex INTEGER NOT NULL DEFAULT 0,
  copies INTEGER NOT NULL DEFAULT 1,
  page_range TEXT DEFAULT 'all',
  paper_size TEXT NOT NULL DEFAULT 'a4' CHECK(paper_size IN ('a4', 'legal')),
  print_quality TEXT NOT NULL DEFAULT 'normal' CHECK(print_quality IN ('draft', 'normal', 'high')),
  sizing TEXT NOT NULL DEFAULT 'fit' CHECK(sizing IN ('fit', 'fill')),
  estimated_sheets INTEGER NOT NULL,
  estimated_cost REAL NOT NULL,
  orientation TEXT DEFAULT 'portrait' CHECK(orientation IN ('portrait', 'landscape')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'processing', 'failed', 'success')),
  payment_id TEXT,
  print_status TEXT NOT NULL DEFAULT 'queued' CHECK(print_status IN ('queued', 'printing', 'completed', 'failed', 'cancelled')),
  current_page INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scan Jobs
CREATE TABLE IF NOT EXISTS scan_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  scan_mode TEXT NOT NULL CHECK(scan_mode IN ('single', 'multi', 'adf', 'id_card', 'book')),
  total_pages INTEGER DEFAULT 0,
  output_path TEXT,
  download_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'scanning', 'processing', 'completed', 'failed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  print_job_id INTEGER REFERENCES print_jobs(id),
  amount REAL NOT NULL,
  upi_id TEXT,
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed', 'success')),
  qr_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Paper Inventory
CREATE TABLE IF NOT EXISTS paper_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_size TEXT NOT NULL DEFAULT 'a4',
  capacity INTEGER NOT NULL DEFAULT 500,
  current_count INTEGER NOT NULL DEFAULT 500,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Paper Refill Logs
CREATE TABLE IF NOT EXISTS paper_refill_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_size TEXT NOT NULL,
  previous_count INTEGER NOT NULL,
  sheets_added INTEGER NOT NULL,
  new_count INTEGER NOT NULL,
  refilled_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Machine Event Logs
CREATE TABLE IF NOT EXISTS event_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL CHECK(event_category IN ('printer', 'scanner', 'payment', 'system', 'hardware')),
  description TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Printer Status
CREATE TABLE IF NOT EXISTS printer_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  printer_model TEXT DEFAULT 'Generic Printer',
  is_online INTEGER DEFAULT 1,
  current_job_id INTEGER,
  queue_length INTEGER DEFAULT 0,
  paper_remaining INTEGER DEFAULT 500,
  toner_level INTEGER DEFAULT 100,
  ink_c INTEGER,
  ink_m INTEGER,
  ink_y INTEGER,
  ink_k INTEGER,
  duplex_available INTEGER DEFAULT 1,
  adf_available INTEGER DEFAULT 1,
  tray_status TEXT DEFAULT 'in',
  paper_loaded TEXT DEFAULT 'A4',
  current_error TEXT,
  last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scanner Status
CREATE TABLE IF NOT EXISTS scanner_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'Kiosk Scanner',
  is_online INTEGER NOT NULL DEFAULT 1,
  current_job_id INTEGER REFERENCES scan_jobs(id),
  last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hardware Events (future ESP32 sensors)
CREATE TABLE IF NOT EXISTS hardware_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_type TEXT NOT NULL CHECK(sensor_type IN ('mpu6050', 'hall', 'door', 'paper', 'nfc', 'rfid')),
  event_type TEXT NOT NULL,
  raw_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export const SEED_SQL = `
-- Seed Printer Status
INSERT OR IGNORE INTO printer_status (id, name, printer_model, is_online, queue_length, paper_remaining, toner_level, duplex_available, adf_available, tray_status, paper_loaded)
VALUES (1, 'No Printer Connected', 'Generic Printer', 0, 0, 500, 100, 1, 0, 'in', 'A4');

-- Seed Scanner Status
INSERT OR IGNORE INTO scanner_status (id, name, is_online)
VALUES (1, 'Kiosk Scanner', 1);

-- Seed Paper Inventory
INSERT OR IGNORE INTO paper_inventory (id, paper_size, capacity, current_count)
VALUES (1, 'a4', 500, 500);

-- Seed Default Settings
INSERT OR REPLACE INTO settings (key, value) VALUES ('pricing_bw_single', '1');
INSERT OR REPLACE INTO settings (key, value) VALUES ('pricing_bw_duplex', '1.5');
INSERT OR REPLACE INTO settings (key, value) VALUES ('pricing_color_single', '5');
INSERT OR REPLACE INTO settings (key, value) VALUES ('pricing_color_duplex', '8');
INSERT OR REPLACE INTO settings (key, value) VALUES ('pricing_scan_per_page', '2');
INSERT OR REPLACE INTO settings (key, value) VALUES ('session_timeout_minutes', '30');
INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_payment_approve', 'true');
INSERT OR REPLACE INTO settings (key, value) VALUES ('kiosk_name', 'Print Kiosk');

-- Seed initial system event
INSERT INTO event_logs (event_type, event_category, description) 
VALUES ('system_start', 'system', 'Kiosk system initialized');
`;
