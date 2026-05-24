// ============================================================
// Session Service — Session lifecycle management
// ============================================================

import getDb from '@/lib/db';
import { generateSessionCode, generateSessionId } from '@/lib/session';
import type { Session, SessionType } from '@/types';

export class SessionService {
  static create(type: SessionType): Session {
    const db = getDb();
    const id = generateSessionId();
    let code = generateSessionCode();

    // Ensure unique code
    let attempts = 0;
    while (attempts < 10) {
      const existing = db.prepare('SELECT id FROM sessions WHERE session_code = ?').get(code);
      if (!existing) break;
      code = generateSessionCode();
      attempts++;
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    // Terminate any currently active or waiting sessions to ensure only 1 session at a time
    db.prepare(`
      UPDATE sessions SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('waiting', 'active')
    `).run();

    db.prepare(`
      INSERT INTO sessions (id, session_code, type, status, expires_at)
      VALUES (?, ?, ?, 'waiting', ?)
    `).run(id, code, type, expiresAt);

    return this.getById(id)!;
  }

  static getById(id: string): Session | null {
    const db = getDb();
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | null;
  }

  static getByCode(code: string): Session | null {
    const db = getDb();
    return db.prepare('SELECT * FROM sessions WHERE session_code = ?').get(code) as Session | null;
  }

  static updateStatus(id: string, status: string): void {
    const db = getDb();
    db.prepare(`
      UPDATE sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, id);
  }

  static getActiveSessions(): Session[] {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM sessions 
      WHERE status IN ('waiting', 'active') 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC
    `).all() as Session[];
  }

  static cleanupExpired(): number {
    const db = getDb();
    const result = db.prepare(`
      UPDATE sessions SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('waiting', 'active') 
      AND expires_at IS NOT NULL 
      AND expires_at <= datetime('now')
    `).run();
    return result.changes;
  }

  static getAll(limit: number = 50): Session[] {
    const db = getDb();
    return db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?').all(limit) as Session[];
  }
}
