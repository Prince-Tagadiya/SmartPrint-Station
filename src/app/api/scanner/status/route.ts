// ============================================================
// API: Scanner Status
// ============================================================

import { NextResponse } from 'next/server';
import { ScannerService } from '@/services/ScannerService';

export async function GET() {
  try {
    const status = ScannerService.getStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error('[API] Scanner status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get scanner status' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { action, model } = await req.json();

    if (action === 'connect') {
      ScannerService.updateStatus({ is_online: 1, name: model });
    } else if (action === 'disconnect') {
      ScannerService.updateStatus({ is_online: 0, name: null });
    }

    return NextResponse.json({ success: true, data: ScannerService.getStatus() });
  } catch (error) {
    console.error('[API] Scanner POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process scanner action' }, { status: 500 });
  }
}
