import { NextResponse } from 'next/server';
import { serialBridge } from '@/services/SerialBridge';
import { EventService } from '@/services/EventService';

export async function POST() {
  try {
    const success = serialBridge.sendCommand('resolve_tamper', {});
    
    if (!success) {
      return NextResponse.json({ success: false, error: 'Hardware not connected' }, { status: 503 });
    }

    EventService.logHardwareEvent('mpu6050', 'tamper_resolved', { source: 'dashboard' });

    return NextResponse.json({ success: true, message: 'Tamper resolved' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
