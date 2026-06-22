// ============================================================
// API: Paper Management — Status and Refill
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PaperService } from '@/services/PaperService';

// GET /api/admin/paper — Get paper status
export async function GET() {
  try {
    const inventory = PaperService.getInventory();
    const refillHistory = PaperService.getRefillHistory();

    return NextResponse.json({
      success: true,
      data: { inventory, refillHistory },
    });
  } catch (error) {
    console.error('[API] Paper status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get paper status' },
      { status: 500 }
    );
  }
}

// POST /api/admin/paper — Refill paper
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paperSize, sheets, mode = 'add' } = body;

    if (!paperSize || typeof sheets !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Paper size and valid sheets count are required' },
        { status: 400 }
      );
    }

    const normalizedSize = paperSize.toLowerCase();
    const refillLog = PaperService.refill(normalizedSize, sheets, mode);
    const inventory = PaperService.getInventory();

    // Send reset/exit command to printer to clear "Change Exit" hardware error
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      await execAsync('cancel -a Brother_DCP_T525W');
    } catch (e) {
      console.warn('Failed to send clear command to printer', e);
    }

    return NextResponse.json({
      success: true,
      data: { refillLog, inventory },
    });
  } catch (error) {
    console.error('[API] Paper refill error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refill paper' },
      { status: 500 }
    );
  }
}
