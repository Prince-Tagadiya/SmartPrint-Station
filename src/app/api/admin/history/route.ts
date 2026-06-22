// ============================================================
// API: Admin History — Print/Scan history with filters & CSV
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrinterService } from '@/services/PrinterService';
import { ScannerService } from '@/services/ScannerService';

// GET /api/admin/history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // today, week, month, all
    const type = searchParams.get('type') || 'all'; // print, scan, all
    const format = searchParams.get('format') || 'json'; // json, csv

    let from: string | undefined;
    const now = new Date();

    switch (filter) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        from = weekAgo.toISOString();
        break;
      }
      case 'month': {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
      }
    }

    const printHistory = type !== 'scan' ? PrinterService.getHistory({ from, limit: 200 }) : [];
    const scanHistory = type !== 'print' ? ScannerService.getHistory({ from, limit: 200 }) : [];

    if (format === 'csv') {
      let csv = '';
      if (type !== 'scan') {
        csv += 'Type,Session ID,File Name,Pages,Copies,Color,Duplex,Cost,Payment Status,Print Status,Timestamp\n';
        for (const job of printHistory) {
          csv += `Print,${job.session_id},${job.file_name},${job.total_pages},${job.copies},${job.color_mode},${job.duplex ? 'Yes' : 'No'},₹${job.estimated_cost},${job.payment_status},${job.print_status},${job.created_at}\n`;
        }
      }
      if (type !== 'print') {
        if (type === 'all') csv += '\n';
        csv += 'Type,Session ID,Scan Mode,Pages,Status,Timestamp\n';
        for (const job of scanHistory) {
          csv += `Scan,${job.session_id},${job.scan_mode},${job.total_pages},${job.status},${job.created_at}\n`;
        }
      }

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="kiosk_history_${filter}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        printHistory,
        scanHistory,
        filter,
        type,
      },
    });
  } catch (error) {
    console.error('[API] History error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load history' },
      { status: 500 }
    );
  }
}
