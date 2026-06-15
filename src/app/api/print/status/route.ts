// ============================================================
// API: Print Status — Get current print job status
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrinterService } from '@/services/PrinterService';

// GET /api/print/status?jobId=X or ?sessionId=X
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const sessionId = searchParams.get('sessionId');

    let job = null;
    if (jobId) {
      job = PrinterService.getJob(Number(jobId));
    } else if (sessionId) {
      job = PrinterService.getJobBySession(sessionId);
    }

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Print job not found' },
        { status: 404 }
      );
    }

    const printerStatus = PrinterService.getStatus();

    return NextResponse.json({
      success: true,
      data: {
        printJob: job,
        printerStatus,
      },
    });
  } catch (error) {
    console.error('[API] Print status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get print status' },
      { status: 500 }
    );
  }
}
