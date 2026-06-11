import { NextResponse } from 'next/server';
import { serialBridge } from '@/services/SerialBridge';

export async function POST() {
  try {
    await serialBridge.disconnect();
    return NextResponse.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    console.error('[API] Disconnect port error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
