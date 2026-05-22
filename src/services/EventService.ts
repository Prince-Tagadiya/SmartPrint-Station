// ============================================================
// Event Service — Centralized event logging
// ============================================================

import getDb from '@/lib/db';
import type { EventLog, EventCategory, HardwareEvent, SensorType } from '@/types';

export class EventService {
  static log(
    eventType: string,
    category: EventCategory,
    description?: string,
    metadata?: Record<string, unknown>
  ): EventLog {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO event_logs (event_type, event_category, description, metadata)
      VALUES (?, ?, ?, ?)
    `).run(eventType, category, description || null, metadata ? JSON.stringify(metadata) : null);

    return db.prepare('SELECT * FROM event_logs WHERE id = ?').get(result.lastInsertRowid) as EventLog;
  }

  static logHardwareEvent(
    sensorType: SensorType,
    eventType: string,
    rawData?: Record<string, unknown>
  ): HardwareEvent {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO hardware_events (sensor_type, event_type, raw_data)
      VALUES (?, ?, ?)
    `).run(sensorType, eventType, rawData ? JSON.stringify(rawData) : null);

    // Also log to general event log
    this.log(eventType, 'hardware', `Hardware: ${sensorType} - ${eventType}`, rawData);

    return db.prepare('SELECT * FROM hardware_events WHERE id = ?').get(result.lastInsertRowid) as HardwareEvent;
  }

  static getEvents(filter?: {
    category?: EventCategory;
    from?: string;
    to?: string;
    limit?: number;
  }): EventLog[] {
    const db = getDb();
    let query = 'SELECT * FROM event_logs';
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.category) {
      conditions.push('event_category = ?');
      params.push(filter.category);
    }
    if (filter?.from) {
      conditions.push('created_at >= ?');
      params.push(filter.from);
    }
    if (filter?.to) {
      conditions.push('created_at <= ?');
      params.push(filter.to);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';
    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    } else {
      query += ' LIMIT 200';
    }

    return db.prepare(query).all(...params) as EventLog[];
  }

  static getHardwareEvents(limit: number = 50): HardwareEvent[] {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM hardware_events ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as HardwareEvent[];
  }

  static getRecentEvents(count: number = 10): EventLog[] {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM event_logs ORDER BY created_at DESC LIMIT ?'
    ).all(count) as EventLog[];
  }
}
