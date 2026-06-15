// ============================================================
// API: Print Upload — Upload and analyze PDF
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { analyzePdf } from '@/lib/pdf-analyzer';
import { calculatePrintCost } from '@/lib/pricing';
import { PrinterService } from '@/services/PrinterService';
import { SessionService } from '@/services/SessionService';
import { serialBridge } from '@/services/SerialBridge';

// POST /api/print/upload
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sessionCode = formData.get('sessionCode') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!sessionCode) {
      return NextResponse.json(
        { success: false, error: 'Session code is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    
    if (!isPdf && !isImage) {
      return NextResponse.json(
        { success: false, error: 'Only PDF and Image files are accepted' },
        { status: 400 }
      );
    }

    // Find session
    const session = SessionService.getByCode(sessionCode.toUpperCase());
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 404 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Analyze PDF or default for images
    let totalPages = 1;
    let analysis = null;
    
    if (isPdf) {
      analysis = await analyzePdf(buffer, file.name);
      totalPages = analysis.total_pages;
    } else {
      analysis = {
        total_pages: 1,
        color_pages: 1,
        bw_pages: 0,
        is_color: true,
        dimensions: { width: 0, height: 0 }
      };
    }

    // Save file
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, `${session.id}_${file.name}`);
    await writeFile(filePath, buffer);

    // Calculate default cost (BW, single-sided, 1 copy)
    const costInfo = calculatePrintCost({
      totalPages: totalPages,
      colorMode: 'bw',
      duplex: false,
      copies: 1,
      pageRange: 'all',
      paperSize: 'a4',
    });

    // Create print job
    const printJob = PrinterService.createJob({
      sessionId: session.id,
      fileName: file.name,
      filePath,
      fileSize: buffer.length,
      totalPages: totalPages,
      colorMode: 'bw',
      duplex: 0,
      copies: 1,
      pageRange: 'all',
      paperSize: 'a4',
      printQuality: 'normal',
      estimatedSheets: costInfo.estimatedSheets,
      estimatedCost: costInfo.estimatedCost,
    });

    // Update session status
    SessionService.updateStatus(session.id, 'active');

    // Update physical TFT screen
    serialBridge.setScreen('file_received', {
      filename: file.name,
      pages: totalPages
    });

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        printJob,
        costInfo,
      },
    });
  } catch (error) {
    console.error('[API] Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}
