import { NextResponse } from 'next/server';
import { serialBridge } from '@/services/SerialBridge';

export async function GET() {
  try {
    const ports = await serialBridge.getAvailablePorts();
    return NextResponse.json({ success: true, data: ports });
  } catch (error) {
    console.error('[API] Fetch ports error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch serial ports' },
      { status: 500 }
    );
  }
}
