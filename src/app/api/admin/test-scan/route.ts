import { NextResponse } from 'next/server';
import { SessionService } from '@/services/SessionService';
import { ScannerService } from '@/services/ScannerService';
import { PrinterService } from '@/services/PrinterService';

export async function POST() {
  try {
    const status = PrinterService.getStatus();
    if (!status.is_online) {
      return NextResponse.json({ success: false, error: 'Printer/Scanner is offline' }, { status: 400 });
    }

    // 1. Create a mock session
    const session = SessionService.create('scan');

    // 2. Create scan job
    const scanJob = ScannerService.createJob(session.id, 'single');

    // 3. Scan a page
    await ScannerService.scanPage(scanJob.id);

    // 4. Finish the scan (generates the PDF)
    await ScannerService.finishScan(scanJob.id);

    return NextResponse.json({ success: true, jobId: scanJob.id });
  } catch (error: any) {
    console.error('[API] Test scan error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start test scan' },
      { status: 500 }
    );
  }
}
