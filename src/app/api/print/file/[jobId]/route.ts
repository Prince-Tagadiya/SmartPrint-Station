import { NextRequest, NextResponse } from 'next/server';
import { PrinterService } from '@/services/PrinterService';
import { readFile } from 'fs/promises';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = PrinterService.getJob(Number(jobId));

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Print job not found' },
        { status: 404 }
      );
    }
    const url = new URL(_request.url);
    const isPreview = url.searchParams.get('preview') === 'true';

    // Serve the JPEG thumbnail instead of the full PDF for mobile previews
    if (isPreview && job.file_name.toLowerCase().endsWith('.pdf') && job.file_name.startsWith('Scanned_Doc_')) {
      const match = job.file_name.match(/Scanned_Doc_(\d+)\.pdf/);
      if (match) {
        const scanJobId = match[1];
        const previewPath = `public/uploads/scan_${scanJobId}_page1.jpeg`;
        try {
          const previewBytes = await readFile(previewPath);
          return new NextResponse(previewBytes, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Content-Disposition': `inline; filename="preview_${scanJobId}.jpeg"`,
            },
          });
        } catch (e) {
          // If jpeg not found, fall back to PDF serving below
        }
      }
    }

    const fileBytes = await readFile(job.file_path);
    
    // Determine content type based on extension
    const ext = job.file_name.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') {
      contentType = 'application/pdf';
    } else if (ext === 'png') {
      contentType = 'image/png';
    } else if (ext === 'jpg' || ext === 'jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === 'gif') {
      contentType = 'image/gif';
    } else if (ext === 'webp') {
      contentType = 'image/webp';
    }

    return new NextResponse(fileBytes, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${job.file_name}"`,
      },
    });
  } catch (error) {
    console.error('[API] Download print file error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve print file' },
      { status: 500 }
    );
  }
}
