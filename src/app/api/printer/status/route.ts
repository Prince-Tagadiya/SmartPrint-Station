// ============================================================
// API: Printer Status
// ============================================================

import { NextResponse } from 'next/server';
import { PrinterService } from '@/services/PrinterService';

export async function GET() {
  try {
    await PrinterService.syncRealStatus();
    const status = PrinterService.getStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error: any) {
    console.error('[API] Printer status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get printer status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, model, paperLoaded } = body;

    if (action === 'connect') {
      PrinterService.connectPrinter(model || 'Generic Printer');
    } else if (action === 'disconnect') {
      PrinterService.disconnectPrinter();
    } else if (action === 'tray_out') {
      PrinterService.setTrayStatus('out');
    } else if (action === 'tray_in') {
      PrinterService.loadPaper(paperLoaded || 'A4');
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: PrinterService.getStatus() });
  } catch (error: any) {
    console.error('[API] Printer action error:', error);
    // Even on error (like unsupported printer), return the current status so the UI updates to show the rejection
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to perform printer action',
      data: PrinterService.getStatus() 
    });
  }
}
