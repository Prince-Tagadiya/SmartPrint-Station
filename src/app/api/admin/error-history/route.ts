import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, description, created_at
      FROM event_logs 
      WHERE event_category = 'hardware' AND event_type = 'hardware_error'
      ORDER BY id DESC 
      LIMIT 10
    `).all();

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching hardware error history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 });
  }
}
