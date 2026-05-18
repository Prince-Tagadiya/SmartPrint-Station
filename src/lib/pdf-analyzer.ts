// ============================================================
// PDF Analyzer — Extract metadata using pdf-lib
// ============================================================

import { PDFDocument } from 'pdf-lib';
import type { FileAnalysis } from '@/types';

export async function analyzePdf(buffer: Buffer, fileName: string): Promise<FileAnalysis> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();

    return {
      file_name: fileName,
      file_size: buffer.length,
      total_pages: totalPages,
      mime_type: 'application/pdf',
    };
  } catch (error) {
    console.error('[PDF] Analysis failed:', error);
    throw new Error('Failed to analyze PDF file. Please ensure it is a valid PDF.');
  }
}
