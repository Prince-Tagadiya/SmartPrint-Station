// ============================================================
// API: Print Start — Start printing (requires payment success)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrinterService } from '@/services/PrinterService';
import { serialBridge } from '@/services/SerialBridge';

// POST /api/print/start
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

    const job = PrinterService.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Print job not found' },
        { status: 404 }
      );
    }

    // CRITICAL: Verify payment is successful
    if (job.payment_status !== 'success') {
      return NextResponse.json(
        { success: false, error: 'Payment must be completed before printing' },
        { status: 403 }
      );
    }

    // Check printer status
    const printerStatus = PrinterService.getStatus();
    if (!printerStatus.is_online) {
      return NextResponse.json(
        { success: false, error: 'Printer is offline' },
        { status: 503 }
      );
    }

    // Start print job (non-blocking - runs in background)
    PrinterService.startPrint(jobId).catch((err) => {
      console.error('[API] Print execution error:', err);
      PrinterService.updateJob(jobId, { print_status: 'failed' });
    });
    
    serialBridge.setScreen('printing');

    return NextResponse.json({
      success: true,
      data: { message: 'Print job started', jobId },
    });
  } catch (error) {
    console.error('[API] Start print error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start print job' },
      { status: 500 }
    );
  }
}
