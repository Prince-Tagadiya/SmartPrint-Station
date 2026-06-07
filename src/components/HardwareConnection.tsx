'use client';

import { useState, useEffect } from 'react';

interface Port {
  path: string;
  manufacturer?: string;
  pnpId?: string;
}

export default function HardwareConnection() {
  const [ports, setPorts] = useState<Port[]>([]);
  const [activePort, setActivePort] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch status on load and poll every 3 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/hardware/serial');
      const data = await res.json();
      if (data.success) {
        setIsConnected(data.data.connected);
        setActivePort(data.data.activePort);
      }
      if (!data.data.connected) {
        fetchPorts();
      }
    } catch (err) {
      console.error('Failed to fetch hardware status:', err);
    }
  };

  const fetchPorts = async () => {
    try {
      const res = await fetch('/api/hardware/ports');
      const data = await res.json();
      if (data.success) {
        setPorts(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch ports:', err);
    }
  };

  const handleConnect = async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hardware/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (data.success) {
        setIsConnected(true);
        setActivePort(path);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Connection failed.');
    }
    setIsLoading(false);
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hardware/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsConnected(false);
        setActivePort(null);
        fetchPorts();
      }
    } catch (err) {
      setError('Disconnect failed.');
    }
    setIsLoading(false);
  };

  return (
    <div className="p-4 border border-kiosk-border rounded-lg bg-kiosk-surface/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-kiosk-success' : 'bg-kiosk-error animate-pulse'}`} />
          <div>
            <p className="font-semibold text-sm">ESP32 Status</p>
            <p className="text-xs text-kiosk-text-muted">
              {isConnected ? `Connected: ${activePort}` : 'Disconnected'}
            </p>
          </div>
        </div>
        {isConnected && (
          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="kiosk-btn kiosk-btn-danger py-1 px-3 text-xs min-h-0 h-auto"
          >
            Disconnect
          </button>
        )}
      </div>

      {error && <div className="text-xs text-kiosk-error mb-3">{error}</div>}

      {!isConnected && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-kiosk-text-muted">Select Port</label>
          <div className="flex gap-2">
            <select
              id="port-select"
              className="kiosk-input py-1.5 px-2 text-xs flex-1"
              defaultValue=""
            >
              <option value="" disabled>Select a port...</option>
              {ports.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}
                </option>
              ))}
            </select>
            <button
              disabled={isLoading}
              onClick={() => {
                const select = document.getElementById('port-select') as HTMLSelectElement;
                if (select.value) handleConnect(select.value);
              }}
              className="kiosk-btn kiosk-btn-primary py-1.5 px-3 text-xs min-h-0 h-auto"
            >
              {isLoading ? '...' : 'Connect'}
            </button>
            <button
              onClick={fetchPorts}
              disabled={isLoading}
              className="kiosk-btn kiosk-btn-ghost p-1.5 min-h-0 h-auto"
              title="Refresh Ports"
            >
              ↻
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
