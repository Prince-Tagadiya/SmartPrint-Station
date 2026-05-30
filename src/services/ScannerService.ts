// ============================================================
// Scanner Service — Mock scanner with multi-mode support
// ============================================================
// Interface designed for future SANE/eSCL driver replacement

import getDb from '@/lib/db';
import type { ScanJob, ScannerStatus, ScanMode } from '@/types';
import { EventService } from './EventService';

export class ScannerService {
  static getStatus(): ScannerStatus {
    const db = getDb();
    return db.prepare('SELECT * FROM scanner_status WHERE id = 1').get() as ScannerStatus;
  }

  static updateStatus(updates: Partial<ScannerStatus>): void {
    const db = getDb();
    const fields = Object.entries(updates)
      .filter(([key]) => key !== 'id')
      .map(([key]) => `${key} = @${key}`)
      .join(', ');

    if (fields) {
      db.prepare(`UPDATE scanner_status SET ${fields}, last_heartbeat = CURRENT_TIMESTAMP WHERE id = 1`)
        .run(updates);
    }
  }

  static createJob(sessionId: string, scanMode: ScanMode): ScanJob {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO scan_jobs (session_id, scan_mode, status) VALUES (?, ?, 'pending')
    `).run(sessionId, scanMode);

    EventService.log('scan_started', 'scanner', `Scan job started: ${scanMode} mode`);
    return db.prepare('SELECT * FROM scan_jobs WHERE id = ?').get(result.lastInsertRowid) as ScanJob;
  }

  static getJob(jobId: number): ScanJob | null {
    const db = getDb();
    return db.prepare('SELECT * FROM scan_jobs WHERE id = ?').get(jobId) as ScanJob | null;
  }

  static getJobBySession(sessionId: string): ScanJob | null {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM scan_jobs WHERE session_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(sessionId) as ScanJob | null;
  }

  static updateJob(jobId: number, updates: Partial<ScanJob>): void {
    const db = getDb();
    const fields = Object.entries(updates)
      .filter(([key]) => key !== 'id')
      .map(([key]) => `${key} = @${key}`)
      .join(', ');

    if (fields) {
      db.prepare(`UPDATE scan_jobs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`)
        .run({ ...updates, id: jobId });
    }
  }

  // Simulate or execute scanning a page
  static async scanPage(
    jobId: number,
    onProgress?: (pageCount: number) => void
  ): Promise<void> {
    const job = this.getJob(jobId);
    if (!job) throw new Error('Scan job not found');

    this.updateJob(jobId, { status: 'scanning' });
    this.updateStatus({ current_job_id: jobId });

    const newPageCount = (job.total_pages || 0) + 1;
    
    try {
      const path = await import('path');
      const { mkdir, writeFile } = await import('fs/promises');

      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadsDir, { recursive: true });
      const imgPath = path.join(uploadsDir, `scan_${jobId}_page${newPageCount}.jpeg`);

      const PRINTER_IP = process.env.PRINTER_IP;
      if (!PRINTER_IP) throw new Error("PRINTER_IP not set in .env");

      EventService.log('hardware', 'scanner', `Triggering hardware scan over eSCL to ${PRINTER_IP}`);

      const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
      <scan:ScanSettings xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm" xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03">
        <pwg:Version>2.0</pwg:Version>
        <scan:Intent>Document</scan:Intent>
        <pwg:ScanRegions>
          <pwg:ScanRegion>
            <pwg:ContentRegionUnits>escl:ThreeHundredthsOfInches</pwg:ContentRegionUnits>
            <pwg:Height>3300</pwg:Height>
            <pwg:Width>2550</pwg:Width>
            <pwg:XOffset>0</pwg:XOffset>
            <pwg:YOffset>0</pwg:YOffset>
          </pwg:ScanRegion>
        </pwg:ScanRegions>
        <pwg:InputSource>Platen</pwg:InputSource>
        <scan:ColorMode>RGB24</scan:ColorMode>
        <scan:DocumentFormat>image/jpeg</scan:DocumentFormat>
      </scan:ScanSettings>`;

      let res = await fetch(`http://${PRINTER_IP}/eSCL/ScanJobs`, {
        method: 'POST',
        body: xmlBody,
        headers: { 'Content-Type': 'text/xml' }
      });

      if (res.status === 503) {
        console.log("[ScannerService] Printer returned 503 (busy). Attempting to clear stuck job...");
        const statusRes = await fetch(`http://${PRINTER_IP}/eSCL/ScannerStatus`);
        const statusXml = await statusRes.text();
        const uriMatch = statusXml.match(/<pwg:JobUri>(.*?)<\/pwg:JobUri>/);
        if (uriMatch && uriMatch[1]) {
          const stuckJobUrl = `http://${PRINTER_IP}${uriMatch[1]}`;
          console.log("[ScannerService] Deleting stuck job:", stuckJobUrl);
          try { await fetch(stuckJobUrl, { method: 'DELETE' }); } catch(e) {}
          await new Promise(r => setTimeout(r, 2000)); // Wait for printer to recover
          
          // Retry
          res = await fetch(`http://${PRINTER_IP}/eSCL/ScanJobs`, {
            method: 'POST',
            body: xmlBody,
            headers: { 'Content-Type': 'text/xml' }
          });
        }
      }

      if (res.status !== 201) {
        throw new Error(`eSCL start failed: ${res.status}`);
      }

      let jobUrl = res.headers.get('location');
      if (!jobUrl) throw new Error("No location header returned");
      if (!jobUrl.startsWith('http')) {
        jobUrl = `http://${PRINTER_IP}${jobUrl}`;
      }

      // Poll until ready
      const statusUrl = `http://${PRINTER_IP}/eSCL/ScannerStatus`;
      while (true) {
        const statusRes = await fetch(statusUrl);
        const statusXml = await statusRes.text();
        if (statusXml.includes('Processing') || statusXml.includes('Completed')) {
          break;
        }
        if (statusXml.includes('Canceled')) {
          throw new Error("Scan job canceled");
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      // Download NextDocument
      const imgRes = await fetch(`${jobUrl}/NextDocument`);
      if (!imgRes.ok) throw new Error("Failed to download NextDocument");
      const arrayBuffer = await imgRes.arrayBuffer();
      await writeFile(imgPath, Buffer.from(arrayBuffer));

      // Gracefully close job
      try {
        await fetch(jobUrl, { method: 'DELETE' });
      } catch (e) {}

    } catch (err: any) {
      console.warn('Real eSCL scan failed, falling back to mock delay.', err);
      // Simulate scan delay (2 seconds per page)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.updateJob(jobId, { total_pages: newPageCount });

    if (onProgress) {
      onProgress(newPageCount);
    }
  }

  // Finish multi-page scan → generate combined PDF
  static async finishScan(jobId: number): Promise<{ downloadUrl: string }> {
    const job = this.getJob(jobId);
    if (!job) throw new Error('Scan job not found');

    this.updateJob(jobId, { status: 'processing' });

    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const { readFile, writeFile, stat } = await import('fs/promises');
      const path = await import('path');

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const totalPages = job.total_pages || 1;
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

      for (let i = 1; i <= totalPages; i++) {
        const imgPath = path.join(uploadsDir, `scan_${jobId}_page${i}.jpeg`);
        let hasImage = false;
        try {
          const fileStat = await stat(imgPath);
          if (fileStat.size > 0) {
            hasImage = true;
          }
        } catch { /* file missing, meaning mock scan */ }

        if (hasImage) {
          const imgBytes = await readFile(imgPath);
          const image = await pdfDoc.embedJpg(imgBytes);
          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        } else {
          // Mock scan page
          const page = pdfDoc.addPage([595, 842]);
          page.drawText(`Scanned Page ${i} of ${totalPages}`, { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
          page.drawText(`Scan Mode: ${job.scan_mode}`, { x: 50, y: 710, size: 14, font, color: rgb(0.4, 0.4, 0.4) });
          page.drawText(`[Mock scanned content - Hardware scan failed or unavailable]`, { x: 50, y: 400, size: 16, font, color: rgb(0.6, 0.6, 0.6) });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const fileName = `scan_${jobId}.pdf`;
      const outputPath = path.join(uploadsDir, fileName);
      await writeFile(outputPath, Buffer.from(pdfBytes));

      // Remove temp jpegs (optional cleanup)
      // const { unlink } = await import('fs/promises');
      // for (let i = 1; i <= totalPages; i++) {
      //   const imgPath = path.join(uploadsDir, `scan_${jobId}_page${i}.jpeg`);
      //   try { await unlink(imgPath); } catch { /* ignore */ }
      // }

    } catch (err) {
      console.error('Failed to generate PDF for scan', err);
      throw err;
    }

    const downloadUrl = `/api/scan/download/${jobId}`;
    const outputPath = `public/uploads/scan_${jobId}.pdf`;

    this.updateJob(jobId, {
      status: 'completed',
      output_path: outputPath,
      download_url: downloadUrl,
    });

    this.updateStatus({ current_job_id: null });
    EventService.log('scan_completed', 'scanner', `Scan job #${jobId} completed: ${job.total_pages} pages`);

    // --- ATTACH TO PRINT SESSION ---
    // Directly attach the scanned PDF to the session to seamlessly transition to the print flow
    try {
      const fs = await import('fs/promises');
      const { PrinterService } = await import('./PrinterService');
      const { SessionService } = await import('./SessionService');
      const { calculatePrintCost } = await import('@/lib/pricing');

      const fileBuf = await fs.readFile(outputPath);
      const totalPages = job.total_pages || 1;

      const costInfo = calculatePrintCost({
        totalPages: totalPages,
        colorMode: 'bw',
        duplex: false,
        copies: 1,
        pageRange: 'all',
        paperSize: 'a4',
      });

      PrinterService.createJob({
        sessionId: job.session_id,
        fileName: `Scanned_Doc_${jobId}.pdf`,
        filePath: outputPath,
        fileSize: fileBuf.length,
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

      SessionService.updateStatus(job.session_id, 'active');
      console.log(`[ScannerService] Successfully attached scan to print session!`);
    } catch (e) {
      console.error(`[ScannerService] Failed to attach scan to web session:`, e);
    }

    return { downloadUrl };
  }

  static getHistory(filter?: { from?: string; to?: string; limit?: number }): ScanJob[] {
    const db = getDb();
    let query = 'SELECT * FROM scan_jobs';
    const params: (string | number)[] = [];

    if (filter?.from) {
      query += ' WHERE created_at >= ?';
      params.push(filter.from);
      if (filter?.to) {
        query += ' AND created_at <= ?';
        params.push(filter.to);
      }
    }

    query += ' ORDER BY created_at DESC';
    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }

    return db.prepare(query).all(...params) as ScanJob[];
  }

  static getTotalScans(): number {
    const db = getDb();
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM scan_jobs WHERE status = 'completed'
    `).get() as { count: number };
    return result.count;
  }

  // ============================================================
  // One-Touch Scan Automation
  // ============================================================
  
  static async performOneTouchScan(sessionId: string, onPreparing?: () => void): Promise<{ path: string, size: number, pages: number }> {
    // 1. Create a dummy scan job
    const job = this.createJob(sessionId, 'single');
    
    // 2. Perform physical/mock scan
    await this.scanPage(job.id);
    
    // Notify preparing
    if (onPreparing) {
      onPreparing();
    }
    
    // 3. Finish scan to generate PDF
    await this.finishScan(job.id);
    
    // 4. Retrieve PDF details
    const finishedJob = this.getJob(job.id);
    if (!finishedJob || !finishedJob.output_path) {
      throw new Error("Failed to generate scan output.");
    }
    
    const { stat } = await import('fs/promises');
    const path = await import('path');
    
    const absolutePath = path.join(process.cwd(), finishedJob.output_path);
    const fileStat = await stat(absolutePath);
    
    return {
      path: finishedJob.output_path,
      size: fileStat.size,
      pages: finishedJob.total_pages || 1
    };
  }
}
