'use client';

import { useEffect, useState } from 'react';

export default function AdminErrorModal() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/printer/status');
        const data = await res.json();
        if (data.success && data.data) {
          const p = data.data;
          let currentError = null;

          if (!p.is_online) currentError = 'Printer is Offline! Check power and USB connection.';
          else if (p.tray_status === 'out') currentError = 'Paper Tray is Open! Please insert the tray.';
          else if (p.paper_remaining <= 0) currentError = 'Out of Paper! Please refill the tray.';

          // Only show if it's a new error or hasn't been dismissed
          if (currentError && currentError !== dismissedError) {
            setErrorMsg(currentError);
          } else if (!currentError) {
            setErrorMsg(null);
            setDismissedError(null); // Reset when printer is healthy
          }
        }
      } catch { /* ignore */ }
    };
    
    checkStatus();
    const i = setInterval(checkStatus, 3000);
    return () => clearInterval(i);
  }, [dismissedError]);

  if (!errorMsg) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in pointer-events-auto">
      <div className="bg-kiosk-surface text-kiosk-text max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden animate-slide-up border border-kiosk-danger/20">
        <div className="bg-kiosk-danger p-6 flex flex-col items-center justify-center text-white">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-4">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <h2 className="text-3xl font-bold uppercase tracking-wide">Hardware Alert</h2>
        </div>
        <div className="p-8 text-center">
          <p className="text-2xl font-medium mb-8">{errorMsg}</p>
          <button
            onClick={() => {
              setDismissedError(errorMsg);
              setErrorMsg(null);
            }}
            className="kiosk-btn kiosk-btn-lg kiosk-btn-ghost w-full border-kiosk-border-light font-bold"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}
