// ============================================================
// API: Scan Download — Download scanned PDF
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { ScannerService } from '@/services/ScannerService';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// GET /api/scan/download/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = ScannerService.getJob(Number(id));

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Scan job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Scan not yet completed' },
        { status: 400 }
      );
    }

    if (!job.output_path) {
      return NextResponse.json(
        { success: false, error: 'Scan output not found' },
        { status: 404 }
      );
    }

    const { readFile } = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(process.cwd(), job.output_path);

    const pdfBytes = await readFile(filePath);
    const url = new URL(_request.url);
    const isDownload = url.searchParams.get('download') === 'true';

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="scan_${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[API] Download scan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to download scan' },
      { status: 500 }
    );
  }
}
