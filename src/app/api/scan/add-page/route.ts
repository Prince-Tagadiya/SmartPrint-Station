// ============================================================
// API: Scan Add Page — Add page in multi-page mode
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { ScannerService } from '@/services/ScannerService';

// POST /api/scan/add-page
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

    await ScannerService.scanPage(jobId);
    const updatedJob = ScannerService.getJob(jobId);

    return NextResponse.json({
      success: true,
      data: { scanJob: updatedJob },
    });
  } catch (error) {
    console.error('[API] Add page error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add page' },
      { status: 500 }
    );
  }
}
