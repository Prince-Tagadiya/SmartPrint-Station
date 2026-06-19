// ============================================================
// API: Session by Code — Get session details
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/services/SessionService';
import { PrinterService } from '@/services/PrinterService';
import { ScannerService } from '@/services/ScannerService';

// GET /api/sessions/[code]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const session = SessionService.getByCode(code.toUpperCase());

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get associated job data
    let printJob = null;
    let scanJob = null;
    let payment = null;

    if (session.type === 'print') {
      printJob = PrinterService.getJobBySession(session.id);
    } else {
      scanJob = ScannerService.getJobBySession(session.id);
      
      // Auto-create a PrintJob so the user can configure and print their scan
      if (scanJob && scanJob.status === 'completed') {
        printJob = PrinterService.getJobBySession(session.id);
        if (!printJob) {
          const { calculatePrintCost } = await import('@/lib/pricing');
          const path = await import('path');
          const fs = await import('fs/promises');
          const costInfo = calculatePrintCost({ totalPages: scanJob.total_pages || 1, colorMode: 'bw', duplex: false, copies: 1 });
          
          const relativePath = scanJob.output_path || `public/uploads/scan_${scanJob.id}.pdf`;
          const filePath = path.join(process.cwd(), relativePath);
          let fileSize = 0;
          try {
            fileSize = (await fs.stat(filePath)).size;
          } catch { }

          printJob = PrinterService.createJob({
            sessionId: session.id,
            fileName: `Scanned_Doc_${scanJob.id}.pdf`,
            filePath: relativePath,
            fileSize,
            totalPages: scanJob.total_pages || 1,
            colorMode: 'bw',
            duplex: 0,
            copies: 1,
            pageRange: 'all',
            paperSize: 'a4',
            printQuality: 'normal',
            orientation: 'portrait',
            estimatedSheets: costInfo.estimatedSheets,
            estimatedCost: costInfo.estimatedCost
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        session,
        printJob,
        scanJob,
        payment,
      },
    });
  } catch (error) {
    console.error('[API] Get session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
