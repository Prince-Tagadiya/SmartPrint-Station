// ============================================================
// API: Admin Settings — Get/Update settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

// GET /api/admin/settings
export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[API] Settings GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();

    const updateStmt = db.prepare(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    );

    const updateMany = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) {
        updateStmt.run(key, String(value));
      }
    });

    updateMany(Object.entries(body));

    // Return updated settings
    const rows = db.prepare('SELECT * FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[API] Settings PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
