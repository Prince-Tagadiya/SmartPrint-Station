import { NextResponse } from 'next/server';
import { SessionService } from '@/services/SessionService';
import { ScannerService } from '@/services/ScannerService';
import { PrinterService } from '@/services/PrinterService';
import getDb from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Job ID required' }, { status: 400 });
    }

    const scanJob = ScannerService.getJob(Number(jobId));
    if (!scanJob) {
      return NextResponse.json({ success: false, error: 'Scan job not found' }, { status: 404 });
    }

    // Create a new print session
    const session = SessionService.create('print');

    // Create a print job from the scan
    const totalPages = scanJob.total_pages || 1;
    
    // Generate a mock PDF and write it to disk so the printer can print it
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const { writeFile, mkdir } = await import('fs/promises');
    const path = await import('path');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 1; i <= totalPages; i++) {
      const page = pdfDoc.addPage([595, 842]);
      page.drawText(`Scanned Page ${i} of ${totalPages}`, { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
      page.drawText(`Scan Mode: ${scanJob.scan_mode}`, { x: 50, y: 710, size: 14, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(`Session: ${scanJob.session_id}`, { x: 50, y: 685, size: 12, font, color: rgb(0.5, 0.5, 0.5) });
      page.drawText(`[Mock scanned content - ready for print]`, { x: 50, y: 400, size: 16, font, color: rgb(0.6, 0.6, 0.6) });
    }
    const pdfBytes = await pdfDoc.save();
    
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const fileName = `scan_${jobId}_print.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, Buffer.from(pdfBytes));

    const db = getDb();
    
    // Get pricing
    const priceStr = db.prepare('SELECT value FROM settings WHERE key = ?').get('pricing_bw_single') as { value: string };
    const pricePerPage = Number(priceStr?.value || '1');
    const estimatedCost = totalPages * pricePerPage;

    const newJob = PrinterService.createJob({
      sessionId: session.id,
      fileName: fileName,
      filePath: filePath,
      fileSize: pdfBytes.length,
      totalPages: totalPages,
      colorMode: 'bw',
      duplex: 0,
      copies: 1,
      pageRange: 'all',
      paperSize: 'a4',
      printQuality: 'normal',
      estimatedSheets: totalPages,
      estimatedCost: estimatedCost,
    });

    return NextResponse.json({ success: true, sessionCode: session.session_code, jobId: newJob.id });
  } catch (error) {
    console.error('[API] Scan to print error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create print job' },
      { status: 500 }
    );
  }
}
