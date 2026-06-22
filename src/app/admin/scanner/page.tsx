'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ScannerStatus } from '@/types';

export default function ScannerPage() {
  const [scanner, setScanner] = useState<ScannerStatus | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/scanner/status');
    const data = await res.json();
    if (data.success) setScanner(data.data);
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
  }, [load]);

  if (!scanner) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Scanner Monitoring</h1>

      <div className="kiosk-card">
        <div className="flex items-center gap-3 mb-6">
          <span className={`kiosk-status-dot ${scanner.is_online ? 'online' : 'offline'}`} />
          <h2 className="text-xl font-bold">{scanner.name}</h2>
          <span className={`kiosk-badge text-xs ${scanner.is_online ? 'bg-kiosk-success-bg text-kiosk-success border-kiosk-success/20' : 'bg-kiosk-danger-bg text-kiosk-danger border-kiosk-danger/20'}`}>
            {scanner.is_online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-kiosk-text-muted uppercase tracking-wider mb-1">Current Job</p>
            <p className="text-lg font-semibold">{scanner.current_job_id ? `Job #${scanner.current_job_id}` : 'No Active Job'}</p>
          </div>
          <div>
            <p className="text-xs text-kiosk-text-muted uppercase tracking-wider mb-1">Last Heartbeat</p>
            <p className="text-lg font-semibold">{new Date(scanner.last_heartbeat).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Supported Scan Modes */}
      <div className="kiosk-card">
        <h2 className="font-semibold mb-4">Supported Scan Modes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {['Single Page', 'Multi Page', 'ADF Scan', 'ID Card', 'Book Scan'].map((mode) => (
            <div key={mode} className="flex items-center gap-2 p-3 rounded-lg bg-kiosk-surface-raised">
              <span className="text-kiosk-success">✓</span>
              <span className="text-sm">{mode}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
