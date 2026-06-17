// ============================================================
// API: Scan Finish — Finalize scan and generate PDF
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { ScannerService } from '@/services/ScannerService';
import { SessionService } from '@/services/SessionService';

// POST /api/scan/finish
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const job = ScannerService.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Scan job not found' },
        { status: 404 }
      );
    }

    const result = await ScannerService.finishScan(jobId);
    SessionService.updateStatus(job.session_id, 'completed');

    const updatedJob = ScannerService.getJob(jobId);

    return NextResponse.json({
      success: true,
      data: {
        scanJob: updatedJob,
        downloadUrl: result.downloadUrl,
      },
    });
  } catch (error) {
    console.error('[API] Finish scan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to finish scan' },
      { status: 500 }
    );
  }
}
