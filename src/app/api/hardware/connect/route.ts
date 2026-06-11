import { NextRequest, NextResponse } from 'next/server';
import { serialBridge } from '@/services/SerialBridge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path } = body;

    if (!path) {
      return NextResponse.json(
        { success: false, error: 'Port path is required' },
        { status: 400 }
      );
    }

    const success = await serialBridge.connect(path);
    if (success) {
      return NextResponse.json({ success: true, message: `Connected to ${path}` });
    } else {
      return NextResponse.json(
        { success: false, error: `Failed to connect to ${path}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] Connect port error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
