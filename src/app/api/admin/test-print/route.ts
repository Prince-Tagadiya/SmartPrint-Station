import { NextResponse } from 'next/server';
import { ScannerService } from '@/services/ScannerService';
import { PrinterService } from '@/services/PrinterService';
import { PaymentService } from '@/services/PaymentService';
import { stat } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { scanJobId } = await req.json();
    if (!scanJobId) return NextResponse.json({ success: false, error: 'scanJobId is required' }, { status: 400 });

    const status = PrinterService.getStatus();
    if (!status.is_online) {
      return NextResponse.json({ success: false, error: 'Printer is offline' }, { status: 400 });
    }

    const scanJob = ScannerService.getJob(scanJobId);
    if (!scanJob || !scanJob.output_path) {
      return NextResponse.json({ success: false, error: 'Scan job not found or incomplete' }, { status: 404 });
    }

    const filePath = path.join(process.cwd(), scanJob.output_path);
    const fileStat = await stat(filePath);

    // Create print job from scan
    const newJob = PrinterService.createJob({
      sessionId: scanJob.session_id,
      fileName: path.basename(filePath),
      filePath: filePath,
      fileSize: fileStat.size,
      totalPages: scanJob.total_pages || 1,
      colorMode: 'bw',
      duplex: 0,
      copies: 1,
      pageRange: 'all',
      paperSize: 'a4',
      printQuality: 'normal',
      estimatedSheets: scanJob.total_pages || 1,
      estimatedCost: 0, // Free test print
    });

    // Bypass payment and start print
    const payment = await PaymentService.createPayment(newJob.id, 0, 'test_print_bypass');
    await PaymentService.simulatePaymentSuccess(payment.id);

    // Run async print
    PrinterService.startPrint(newJob.id).catch(console.error);

    return NextResponse.json({ success: true, message: 'Test print sent' });
  } catch (error: any) {
    console.error('[API] Test print error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start test print' },
      { status: 500 }
    );
  }
}
