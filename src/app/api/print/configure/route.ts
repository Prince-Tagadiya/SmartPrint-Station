// ============================================================
// API: Print Configure — Update print settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrinterService } from '@/services/PrinterService';
import { calculatePrintCost } from '@/lib/pricing';
import type { ColorMode, PaperSize, PrintQuality } from '@/types';

// POST /api/print/configure
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, colorMode, duplex, copies, pageRange, paperSize, printQuality, orientation, sizing } = body;

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

    // Calculate new cost with updated settings
    const cMode: ColorMode = colorMode || job.color_mode;
    const dup: boolean = duplex !== undefined ? duplex : !!job.duplex;
    const cop: number = copies || job.copies;
    const range: string = pageRange || job.page_range;
    const pSize: PaperSize = paperSize || job.paper_size;
    const pQuality: PrintQuality = printQuality || job.print_quality;
    const orient: string = orientation || job.orientation;
    const siz = sizing || job.sizing;

    const costInfo = calculatePrintCost({
      totalPages: job.total_pages,
      colorMode: cMode,
      duplex: dup,
      copies: cop,
      pageRange: range,
      paperSize: pSize,
    });

    // Update the job using PrinterService wrapper
    PrinterService.updateJobSettings(jobId, {
      color_mode: cMode,
      duplex: dup ? 1 : 0,
      copies: cop,
      page_range: range,
      paper_size: pSize,
      print_quality: pQuality,
      orientation: orient,
      sizing: siz,
      estimated_sheets: costInfo.estimatedSheets,
      estimated_cost: costInfo.estimatedCost,
    });

    const updatedJob = PrinterService.getJob(jobId);

    // Force an immediate sync to the kiosk TFT for true real-time updates
    import('@/services/SerialBridge').then(({ serialBridge }) => {
      serialBridge.syncState();
    });

    return NextResponse.json({
      success: true,
      data: {
        printJob: updatedJob,
        costInfo,
      },
    });
  } catch (error) {
    console.error('[API] Configure error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to configure print job' },
      { status: 500 }
    );
  }
}
