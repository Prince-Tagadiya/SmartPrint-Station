// ============================================================
// API: Scan Start — Start a scan job
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { ScannerService } from '@/services/ScannerService';
import { SessionService } from '@/services/SessionService';
import type { ScanMode } from '@/types';

// POST /api/scan/start
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionCode, scanMode } = body;

    if (!sessionCode || !scanMode) {
      return NextResponse.json(
        { success: false, error: 'Session code and scan mode are required' },
        { status: 400 }
      );
    }

    const validModes: ScanMode[] = ['single', 'multi', 'adf', 'id_card', 'book'];
    if (!validModes.includes(scanMode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid scan mode' },
        { status: 400 }
      );
    }

    const session = SessionService.getByCode(sessionCode.toUpperCase());
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const scannerStatus = ScannerService.getStatus();
    if (!scannerStatus.is_online) {
      return NextResponse.json(
        { success: false, error: 'Scanner is offline' },
        { status: 503 }
      );
    }

    const scanJob = ScannerService.createJob(session.id, scanMode);
    SessionService.updateStatus(session.id, 'active');

    // For single/adf modes, start scanning immediately
    if (scanMode === 'single' || scanMode === 'adf') {
      ScannerService.scanPage(scanJob.id).then(() => {
        ScannerService.finishScan(scanJob.id);
      });
    }

    return NextResponse.json({
      success: true,
      data: { scanJob },
    });
  } catch (error) {
    console.error('[API] Scan start error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start scan' },
      { status: 500 }
    );
  }
}
