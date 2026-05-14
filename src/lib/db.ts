// ============================================================
// Database Connection — SQLite via better-sqlite3
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import { SCHEMA_SQL, SEED_SQL } from './db-schema';

// In serverless environments (Vercel, Netlify), process.cwd() is read-only.
const DB_PATH = process.env.NODE_ENV === 'production' && !process.env.LOCAL_PROD
  ? '/tmp/kiosk.db'
  : path.join(process.cwd(), 'kiosk.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(database: Database.Database): void {
  // Check if tables exist
  const tableCheck = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
    .get();

  if (!tableCheck) {
    // Create all tables
    database.exec(SCHEMA_SQL);
    // Seed default data
    database.exec(SEED_SQL);
    console.log('[DB] Database initialized with schema and seed data');
  } else {
    // Migration: Add orientation column to print_jobs if not exists
    try {
      const pragma = database.prepare("PRAGMA table_info(print_jobs)").all() as any[];
      const hasOrientation = pragma.some(col => col.name === 'orientation');
      if (!hasOrientation) {
        database.exec("ALTER TABLE print_jobs ADD COLUMN orientation TEXT DEFAULT 'portrait';");
        console.log("[DB] Migrated: Added orientation column to print_jobs table");
      }
    } catch (e) {
      console.error("[DB] Migration error adding orientation:", e);
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;
