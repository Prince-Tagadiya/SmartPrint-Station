// ============================================================
// Paper Service — Paper inventory management
// ============================================================

import getDb from '@/lib/db';
import type { PaperInventory, PaperRefillLog } from '@/types';
import { EventService } from './EventService';

export class PaperService {
  static getInventory(): PaperInventory[] {
    const db = getDb();
    return db.prepare('SELECT * FROM paper_inventory ORDER BY paper_size').all() as PaperInventory[];
  }

  static getBySize(paperSize: string): PaperInventory | null {
    const db = getDb();
    return db.prepare('SELECT * FROM paper_inventory WHERE paper_size = ?').get(paperSize) as PaperInventory | null;
  }

  static decrementPaper(paperSize: string, sheets: number): void {
    const db = getDb();
    const inv = this.getBySize(paperSize);
    if (!inv) return;

    const newCount = Math.max(0, inv.current_count - sheets);
    db.prepare(`
      UPDATE paper_inventory SET current_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE paper_size = ?
    `).run(newCount, paperSize);

    // Sync printer status
    db.prepare(`
      UPDATE printer_status SET paper_remaining = ? WHERE id = 1
    `).run(newCount);

    // Check for low paper warning
    if (newCount <= 50 && newCount > 0) {
      EventService.log('paper_low', 'printer', `Paper low: ${newCount} sheets remaining (${paperSize})`);
    } else if (newCount === 0) {
      EventService.log('paper_empty', 'printer', `Paper empty (${paperSize})`);
    }
  }

  static refill(paperSize: string, sheets: number, mode: 'add' | 'set' = 'add'): PaperRefillLog {
    const db = getDb();
    const inv = this.getBySize(paperSize);
    if (!inv) throw new Error(`Paper inventory not found for size: ${paperSize}`);

    const previousCount = inv.current_count;
    let newCount = previousCount;
    let sheetsAdded = 0;

    if (mode === 'add') {
      newCount = Math.min(inv.capacity, previousCount + sheets);
      sheetsAdded = newCount - previousCount;
    } else {
      newCount = Math.min(inv.capacity, Math.max(0, sheets));
      sheetsAdded = newCount - previousCount;
    }

    // Update inventory
    db.prepare(`
      UPDATE paper_inventory SET current_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE paper_size = ?
    `).run(newCount, paperSize);

    // Sync printer status
    db.prepare(`
      UPDATE printer_status SET paper_remaining = ? WHERE id = 1
    `).run(newCount);

    // Log refill
    const result = db.prepare(`
      INSERT INTO paper_refill_logs (paper_size, previous_count, sheets_added, new_count)
      VALUES (?, ?, ?, ?)
    `).run(paperSize, previousCount, sheetsAdded, newCount);

    EventService.log('paper_refilled', 'printer', 
      `Paper ${mode === 'add' ? 'refilled' : 'set'}: ${sheetsAdded > 0 ? '+' : ''}${sheetsAdded} sheets (${previousCount} → ${newCount}) [${paperSize}]`);

    return db.prepare('SELECT * FROM paper_refill_logs WHERE id = ?').get(result.lastInsertRowid) as PaperRefillLog;
  }

  static getRefillHistory(limit: number = 20): PaperRefillLog[] {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM paper_refill_logs ORDER BY refilled_at DESC LIMIT ?'
    ).all(limit) as PaperRefillLog[];
  }
}
