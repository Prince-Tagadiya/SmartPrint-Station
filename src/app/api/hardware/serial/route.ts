import { NextRequest, NextResponse } from 'next/server';
import { serialBridge } from '@/services/SerialBridge';

export async function GET() {
  const status = serialBridge.getStatus();
  return NextResponse.json({ success: true, data: status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cmd, data } = body;

    if (!cmd) {
      return NextResponse.json({ success: false, error: 'Command required' }, { status: 400 });
    }

    const success = serialBridge.sendCommand(cmd, data || {});

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'ESP32 not connected' }, { status: 503 });
    }
  } catch (error) {
    console.error('[API] Hardware Serial error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
