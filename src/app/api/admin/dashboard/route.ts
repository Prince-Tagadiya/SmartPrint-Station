// ============================================================
// API: Admin Dashboard — Aggregated stats
// ============================================================

import { NextResponse } from 'next/server';
import { PrinterService } from '@/services/PrinterService';
import { ScannerService } from '@/services/ScannerService';
import { SessionService } from '@/services/SessionService';
import { PaperService } from '@/services/PaperService';
import type { DashboardStats } from '@/types';

// GET /api/admin/dashboard
export async function GET() {
  try {
    const printerStatus = PrinterService.getStatus();
    const scannerStatus = ScannerService.getStatus();
    const activeSessions = SessionService.getActiveSessions();
    const todayStats = PrinterService.getTodayStats();
    const monthStats = PrinterService.getMonthStats();
    const totalScans = ScannerService.getTotalScans();
    const paperInventory = PaperService.getInventory();

    const stats: DashboardStats = {
      printer_online: !!printerStatus.is_online,
      scanner_online: !!scannerStatus.is_online,
      active_sessions: activeSessions.length,
      pages_printed_today: todayStats.pages,
      pages_printed_month: monthStats.pages,
      total_scans: totalScans,
      revenue_today: todayStats.revenue,
      revenue_month: monthStats.revenue,
      paper_remaining: paperInventory.reduce((sum, p) => sum + p.current_count, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        stats,
        printerStatus,
        scannerStatus,
        paperInventory,
        activeSessions,
      },
    });
  } catch (error) {
    console.error('[API] Dashboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}
