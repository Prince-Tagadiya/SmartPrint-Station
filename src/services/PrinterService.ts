// ============================================================
// Printer Service — Mock printer with realistic state machine
// ============================================================
// Interface designed for future CUPS/IPP driver replacement

import getDb from '@/lib/db';
import type { PrintJob, PrinterStatus } from '@/types';
import { EventService } from './EventService';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export interface IPrinterDriver {
  print(job: PrintJob): Promise<void>;
}

export class PrinterService {
  private static printingInterval: ReturnType<typeof setInterval> | null = null;

  static getStatus(): PrinterStatus {
    const db = getDb();
    return db.prepare('SELECT * FROM printer_status WHERE id = 1').get() as PrinterStatus;
  }

  static async syncRealStatus(): Promise<void> {
    try {
      const status = this.getStatus();
      if (!status.printer_model) return;

      // Parse CUPS status
      const { stdout } = await execAsync(`lpoptions -p "${status.printer_model}"`);
      const updates: Partial<PrinterStatus> = {};
      
      // Default to assuming it is online until we parse reasons
      let isActuallyOnline = 1;
      let newError: string | null = null;

      const markerMatch = stdout.match(/marker-levels=([\d,]+)/);
      if (markerMatch) {
        const levels = markerMatch[1].split(',').map(Number);
        const avgLevel = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
        updates.toner_level = avgLevel;
        if (levels.length >= 4) {
          updates.ink_m = levels[0];
          updates.ink_c = levels[1];
          updates.ink_y = levels[2];
          updates.ink_k = levels[3];
        }
      }

      // Check general CUPS errors
      const reasonsMatch = stdout.match(/printer-state-reasons=([\w,-]+)/);
      if (reasonsMatch) {
        const reasons = reasonsMatch[1].split(',');
        for (const reason of reasons) {
          if (reason === 'none') continue;
          if (reason.includes('media-empty') || reason.includes('tray-missing')) newError = 'Paper Tray 1 not detected';
          else if (reason.includes('media-jam')) newError = 'Paper Jam';
          else if (reason.includes('toner-empty')) newError = 'Ink Empty';
          // Intentionally ignoring 'offline' or 'not-connected' since macOS CUPS often marks network printers as offline when idle
          else if (reason.includes('error') || reason.includes('warning')) newError = reason.replace(/-/g, ' ');
        }
      }

      // Default tray status if no paper error
      if (newError === 'Paper Tray 1 not detected') {
        updates.tray_status = 'out';
      } else {
        updates.tray_status = 'in';
      }

      // Force online if connected manually via UI or ENV
      updates.is_online = 1;

      if (newError && status.current_error !== newError) {
        updates.current_error = newError;
        EventService.log('hardware_error', 'hardware', newError);
      } else if (!newError && status.current_error) {
        // Error resolved
        updates.current_error = null;
      }

      if (Object.keys(updates).length > 0) {
        this.updateStatus(updates);
      }
    } catch (e) {
      // If `lpoptions` throws an error, assume it is still online to avoid locking up the kiosk for idle network printers
      const status = this.getStatus();
      if (!status.is_online) {
        this.updateStatus({ is_online: 1, current_error: null });
      }
    }
  }

  static updateStatus(updates: Partial<PrinterStatus>): void {
    const db = getDb();
    const fields = Object.entries(updates)
      .filter(([key]) => key !== 'id')
      .map(([key]) => `${key} = @${key}`)
      .join(', ');

    if (fields) {
      db.prepare(`UPDATE printer_status SET ${fields}, last_heartbeat = CURRENT_TIMESTAMP WHERE id = 1`)
        .run(updates);
    }
  }

  static connectPrinter(model: string): void {
    if (!model) {
      throw new Error('Printer model is required');
    }
    // We assume it is online upon explicit connection, syncRealStatus will correct this shortly after if it's actually off
    this.updateStatus({ printer_model: model, name: model, is_online: 1, current_error: null });
    EventService.log('printer_connected', 'hardware', `Configured real printer: ${model}`);
  }

  static disconnectPrinter(): void {
    const db = getDb();
    // Explicitly set printer_model to NULL when the user wants to detach the printer
    db.prepare('UPDATE printer_status SET printer_model = NULL, is_online = 0, current_error = NULL, tray_status = ? WHERE id = 1').run('in');
    EventService.log('printer_disconnected', 'hardware', `Printer disconnected manually`);
  }

  static setTrayStatus(status: 'in' | 'out'): void {
    this.updateStatus({ tray_status: status });
    EventService.log(status === 'out' ? 'paper_tray_open' : 'paper_tray_closed', 'hardware', `Printer tray is ${status}`);
  }

  static loadPaper(paperType: string): void {
    this.updateStatus({ paper_loaded: paperType, tray_status: 'in' });
    EventService.log('paper_loaded', 'hardware', `Paper loaded: ${paperType}`);
  }

  static createJob(params: {
    sessionId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    totalPages: number;
    colorMode: string;
    duplex: number;
    copies: number;
    pageRange: string;
    paperSize: string;
    printQuality: string;
    orientation?: string;
    estimatedSheets: number;
    estimatedCost: number;
  }): PrintJob {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO print_jobs (
        session_id, file_name, file_path, file_size, total_pages,
        color_mode, duplex, copies, page_range, paper_size, print_quality,
        estimated_sheets, estimated_cost, orientation
      ) VALUES (
        @sessionId, @fileName, @filePath, @fileSize, @totalPages,
        @colorMode, @duplex, @copies, @pageRange, @paperSize, @printQuality,
        @estimatedSheets, @estimatedCost, @orientation
      )
    `).run({
      ...params,
      orientation: params.orientation || 'portrait'
    });

    return db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(result.lastInsertRowid) as PrintJob;
  }

  static getJob(jobId: number): PrintJob | null {
    const db = getDb();
    return db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(jobId) as PrintJob | null;
  }

  static getJobBySession(sessionId: string): PrintJob | null {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM print_jobs WHERE session_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(sessionId) as PrintJob | null;
  }

  static updateJob(jobId: number, updates: Partial<PrintJob>): void {
    const db = getDb();
    const fields = Object.entries(updates)
      .filter(([key]) => key !== 'id')
      .map(([key]) => `${key} = @${key}`)
      .join(', ');

    if (fields) {
      db.prepare(`UPDATE print_jobs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`)
        .run({ ...updates, id: jobId });
    }
  }

  static updateJobSettings(jobId: number, settings: {
    color_mode: string;
    duplex: number;
    copies: number;
    page_range: string;
    paper_size: string;
    print_quality: string;
    estimated_sheets: number;
    estimated_cost: number;
    orientation?: string;
    sizing?: string;
  }): void {
    const db = getDb();
    db.prepare(`
      UPDATE print_jobs SET
        color_mode = ?, duplex = ?, copies = ?, page_range = ?,
        paper_size = ?, print_quality = ?, estimated_sheets = ?,
        estimated_cost = ?, orientation = COALESCE(?, orientation), sizing = COALESCE(?, sizing), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      settings.color_mode, settings.duplex, settings.copies, settings.page_range,
      settings.paper_size, settings.print_quality, settings.estimated_sheets,
      settings.estimated_cost, settings.orientation || null, settings.sizing || null, jobId
    );
  }

  private static async bakePrintFile(job: PrintJob): Promise<string> {
    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const { readFile, writeFile } = await import('fs/promises');
      const path = await import('path');

      const fileBytes = await readFile(job.file_path);
      const pdfDoc = await PDFDocument.create();

      // A4 portrait dimensions
      const a4Width = 595.28;
      const a4Height = 841.89;
      const isLandscape = job.orientation === 'landscape';
      const targetW = isLandscape ? a4Height : a4Width;
      const targetH = isLandscape ? a4Width : a4Height;

      if (job.file_name.match(/\.(jpg|jpeg|png|webp|heic|gif)$/i)) {
        const sharp = (await import('sharp')).default || await import('sharp');
        // Auto-orient based on EXIF and convert to JPEG for universal PDF compatibility
        const processedImageBuffer = await sharp(fileBytes)
          .rotate() // Auto-orients based on EXIF tag
          .jpeg({ quality: 100 }) // Convert anything (WEBP/HEIC/PNG) to high-quality JPEG
          .toBuffer();

        const image = await pdfDoc.embedJpg(processedImageBuffer);
        const page = pdfDoc.addPage([a4Width, a4Height]);

        const imgWidth = image.width;
        const imgHeight = image.height;

        const widthRatio = targetW / imgWidth;
        const heightRatio = targetH / imgHeight;
        const scale = job.sizing === 'fill' ? Math.max(widthRatio, heightRatio) : Math.min(widthRatio, heightRatio);

        const finalWidth = imgWidth * scale;
        const finalHeight = imgHeight * scale;

        const cx = (targetW - finalWidth) / 2;
        const cy = (targetH - finalHeight) / 2;

        if (isLandscape) {
          page.drawImage(image, {
            x: a4Width - cy,
            y: cx,
            width: finalWidth,
            height: finalHeight,
            rotate: degrees(90)
          });
        } else {
          page.drawImage(image, {
            x: cx,
            y: cy,
            width: finalWidth,
            height: finalHeight,
            rotate: degrees(0)
          });
        }
      } else {
        // It's a PDF! Embed pages onto perfect A4 portrait sheets with correct rotation/scaling
        const srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
        const embeddedPages = await pdfDoc.embedPages(srcPdf.getPages());

        for (const embeddedPage of embeddedPages) {
          const page = pdfDoc.addPage([a4Width, a4Height]);
          const imgWidth = embeddedPage.width;
          const imgHeight = embeddedPage.height;

          const widthRatio = targetW / imgWidth;
          const heightRatio = targetH / imgHeight;
          const scale = job.sizing === 'fill' ? Math.max(widthRatio, heightRatio) : Math.min(widthRatio, heightRatio);

          const finalWidth = imgWidth * scale;
          const finalHeight = imgHeight * scale;

          const cx = (targetW - finalWidth) / 2;
          const cy = (targetH - finalHeight) / 2;

          if (isLandscape) {
            page.drawPage(embeddedPage, {
              x: a4Width - cy,
              y: cx,
              width: finalWidth,
              height: finalHeight,
              rotate: degrees(90)
            });
          } else {
            page.drawPage(embeddedPage, {
              x: cx,
              y: cy,
              width: finalWidth,
              height: finalHeight,
              rotate: degrees(0)
            });
          }
        }
      }

      const bakedBytes = await pdfDoc.save();
      const bakedFileName = `baked_${job.id}.pdf`;
      const bakedPath = path.join(process.cwd(), 'public', 'uploads', bakedFileName);
      await writeFile(bakedPath, Buffer.from(bakedBytes));
      
      console.log(`[PrinterService] Successfully baked print file: ${bakedPath}`);
      return bakedPath;
    } catch (e) {
      console.error('[PrinterService] Failed to bake print file:', e);
      return job.file_path; // Fallback to original
    }
  }

  // Mock print simulation - simulates page-by-page printing
  static async startPrint(
    jobId: number,
    onProgress?: (currentPage: number, totalPages: number) => void
  ): Promise<void> {
    const job = this.getJob(jobId);
    if (!job) throw new Error('Print job not found');
    if (job.payment_status !== 'success') throw new Error('Payment not completed');

    const status = this.getStatus();
    if (status.tray_status === 'out') {
      throw new Error('Paper tray is open. Please close it to continue printing.');
    }

    const effectivePages = job.estimated_sheets;

    // Update job and printer status
    this.updateJob(jobId, { print_status: 'printing', current_page: 0 });
    this.updateStatus({ current_job_id: jobId, queue_length: 0 });
    EventService.log('print_started', 'printer', `Print job #${jobId} started: ${job.file_name}`);

    // Send it to the real hardware using the configured printer model
    if (status.printer_model) {
      try {
        const finalFilePath = await this.bakePrintFile(job);
        const isBaked = finalFilePath !== job.file_path;
        
        const duplexFlag = job.duplex ? '-o sides=two-sided-long-edge' : '-o sides=one-sided';
        const colorFlag = job.color_mode === 'bw' ? '-o ColorModel=Grayscale' : '-o ColorModel=Color';
        const copiesFlag = `-n ${job.copies}`;
        const mediaFlag = `-o media=${job.paper_size === 'legal' ? 'Legal' : 'A4'}`;
        const orientationFlag = isBaked ? '' : (job.orientation === 'landscape' ? '-o landscape' : '');
        const sizingFlag = isBaked ? '' : (job.sizing === 'fill' ? '-o scaling=100' : '-o fit-to-page');
        
        const command = `lp -d "${status.printer_model}" ${copiesFlag} ${duplexFlag} ${colorFlag} ${mediaFlag} ${orientationFlag} ${sizingFlag} "${finalFilePath}"`;
        await execAsync(command);
        EventService.log('print_hardware_sent', 'hardware', `Sent to real printer via lp: ${command}`);
      } catch (err: any) {
        EventService.log('print_hardware_error', 'hardware', `Failed to send to real printer: ${err.message}`);
        console.error('Print command failed', err);
      }
    }

    // Simulate page-by-page printing for the UI progress bar (at least 3 seconds per page)
    return new Promise((resolve, reject) => {
      let currentPage = 0;
      const interval = setInterval(() => {
        currentPage++;
        this.updateJob(jobId, { current_page: currentPage });

        if (onProgress) {
          onProgress(currentPage, effectivePages);
        }

        if (currentPage >= effectivePages) {
          clearInterval(interval);
          this.printingInterval = null;

          // Decrement paper
          const db = getDb();
          db.prepare(`
            UPDATE paper_inventory SET current_count = MAX(0, current_count - ?), updated_at = CURRENT_TIMESTAMP
            WHERE paper_size = ?
          `).run(effectivePages, job.paper_size);

          db.prepare(`
            UPDATE printer_status SET paper_remaining = (
              SELECT current_count FROM paper_inventory WHERE paper_size = ?
            ), current_job_id = NULL WHERE id = 1
          `).run(job.paper_size);

          this.updateJob(jobId, { print_status: 'completed', current_page: effectivePages });
          EventService.log('print_completed', 'printer', `Print job #${jobId} completed: ${job.file_name}`);
          resolve();
        }
      }, 3000); // 3000ms (3 seconds) per page simulation to ensure UI stays visible

      this.printingInterval = interval;
    });
  }

  static cancelPrint(jobId: number): void {
    if (this.printingInterval) {
      clearInterval(this.printingInterval);
      this.printingInterval = null;
    }
    this.updateJob(jobId, { print_status: 'cancelled' });
    this.updateStatus({ current_job_id: null });
    EventService.log('print_cancelled', 'printer', `Print job #${jobId} cancelled`);
  }

  static getHistory(filter?: { from?: string; to?: string; limit?: number }): PrintJob[] {
    const db = getDb();
    let query = 'SELECT * FROM print_jobs';
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

    return db.prepare(query).all(...params) as PrintJob[];
  }

  static getTodayStats(): { pages: number; jobs: number; revenue: number } {
    const db = getDb();
    const result = db.prepare(`
      SELECT 
        COALESCE(SUM(estimated_sheets), 0) as pages,
        COUNT(*) as jobs,
        COALESCE(SUM(CASE WHEN payment_status = 'success' THEN estimated_cost ELSE 0 END), 0) as revenue
      FROM print_jobs
      WHERE date(created_at) = date('now')
    `).get() as { pages: number; jobs: number; revenue: number };
    return result;
  }

  static getMonthStats(): { pages: number; revenue: number } {
    const db = getDb();
    const result = db.prepare(`
      SELECT 
        COALESCE(SUM(estimated_sheets), 0) as pages,
        COALESCE(SUM(CASE WHEN payment_status = 'success' THEN estimated_cost ELSE 0 END), 0) as revenue
      FROM print_jobs
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get() as { pages: number; revenue: number };
    return result;
  }
}
