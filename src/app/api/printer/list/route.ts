import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export async function GET() {
  try {
    const { stdout } = await execAsync('lpstat -a');
    // Example output: "Brother_DCP_T525W accepting requests since Thu May 28 18:06:33 2026"
    const lines = stdout.split('\n').filter(line => line.trim().length > 0);
    const printers = lines.map(line => line.split(' ')[0]);

    if (process.env.PRINTER_NAME && !printers.includes(process.env.PRINTER_NAME)) {
      printers.unshift(process.env.PRINTER_NAME);
    }

    return NextResponse.json({ success: true, data: printers });
  } catch (error) {
    console.error('[API] Failed to list printers:', error);
    return NextResponse.json({ success: false, error: 'Failed to list printers' }, { status: 500 });
  }
}
