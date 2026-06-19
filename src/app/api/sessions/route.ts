// ============================================================
// API: Sessions — Create and list sessions
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/services/SessionService';
import type { SessionType } from '@/types';

// POST /api/sessions — Create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type: SessionType = body.type || 'print';

    if (!['print', 'scan'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid session type. Must be "print" or "scan".' },
        { status: 400 }
      );
    }

    const session = SessionService.create(type);
    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('[API] Create session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

// GET /api/sessions — List active sessions
export async function GET() {
  try {
    // Clean up expired sessions first
    SessionService.cleanupExpired();
    const sessions = SessionService.getActiveSessions();
    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error('[API] List sessions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}
