// ============================================================
// API: Event Logs — Machine event logs
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { EventService } from '@/services/EventService';
import type { EventCategory } from '@/types';

// GET /api/admin/events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as EventCategory | null;
    const limit = Number(searchParams.get('limit')) || 100;

    const events = EventService.getEvents({ category: category || undefined, limit });
    const hardwareEvents = EventService.getHardwareEvents(50);

    return NextResponse.json({
      success: true,
      data: { events, hardwareEvents },
    });
  } catch (error) {
    console.error('[API] Events error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load events' },
      { status: 500 }
    );
  }
}
