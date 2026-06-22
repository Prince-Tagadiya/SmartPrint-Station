'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDate } from '@/lib/utils';
import type { PaperInventory, PaperRefillLog } from '@/types';

export default function PaperPage() {
  const [inventory, setInventory] = useState<PaperInventory[]>([]);
  const [refillHistory, setRefillHistory] = useState<PaperRefillLog[]>([]);
  const [refillSize, setRefillSize] = useState('a4');
  const [refillAmount, setRefillAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/paper');
    const data = await res.json();
    if (data.success) {
      setInventory(data.data.inventory);
      setRefillHistory(data.data.refillHistory);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefill = async () => {
    if (!refillAmount || Number(refillAmount) <= 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperSize: refillSize, sheetsAdded: Number(refillAmount) }),
      });
      const data = await res.json();
      if (data.success) {
        setInventory(data.data.inventory);
        setRefillAmount('');
        load();
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Paper Management</h1>

      {/* Current Inventory */}
      <div className="grid md:grid-cols-2 gap-4">
        {inventory.map((inv) => {
          const pct = inv.capacity > 0 ? (inv.current_count / inv.capacity) * 100 : 0;
          return (
            <div key={inv.id} className="kiosk-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">{inv.paper_size.toUpperCase()} Paper</h3>
                <span className={`kiosk-badge text-xs ${pct > 20 ? 'bg-kiosk-success-bg text-kiosk-success border-kiosk-success/20' : pct > 0 ? 'bg-kiosk-warning-bg text-kiosk-warning border-kiosk-warning/20' : 'bg-kiosk-danger-bg text-kiosk-danger border-kiosk-danger/20'}`}>
                  {pct > 20 ? 'OK' : pct > 0 ? 'LOW' : 'EMPTY'}
                </span>
              </div>
              <div className="text-center mb-4">
                <p className="text-4xl font-bold">{inv.current_count}</p>
                <p className="text-kiosk-text-muted text-sm">of {inv.capacity} capacity</p>
              </div>
              <div className="kiosk-progress h-3">
                <div
                  className={`kiosk-progress-bar h-full ${pct > 20 ? '' : 'bg-kiosk-danger'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Refill Paper */}
      <div className="kiosk-card">
        <h2 className="font-semibold mb-4">Refill Paper</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-sm text-kiosk-text-secondary block mb-1">Paper Size</label>
            <div className="kiosk-input w-32 flex items-center bg-kiosk-surface-raised cursor-not-allowed text-kiosk-text-muted">
              A4
            </div>
          </div>
          <div>
            <label className="text-sm text-kiosk-text-secondary block mb-1">Sheets Added</label>
            <input
              type="number"
              value={refillAmount}
              onChange={(e) => setRefillAmount(e.target.value)}
              placeholder="e.g. 120"
              className="kiosk-input w-36"
              min={1}
            />
          </div>
          <button
            onClick={handleRefill}
            disabled={!refillAmount || loading}
            className="kiosk-btn kiosk-btn-success"
          >
            {loading ? 'Refilling...' : 'REFILL PAPER'}
          </button>
        </div>
      </div>

      {/* Refill History */}
      {refillHistory.length > 0 && (
        <div className="kiosk-card">
          <h2 className="font-semibold mb-4">Refill History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-kiosk-text-muted border-b border-kiosk-border">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2 pr-4">Size</th>
                  <th className="text-right py-2 pr-4">Previous</th>
                  <th className="text-right py-2 pr-4">Added</th>
                  <th className="text-right py-2">New Total</th>
                </tr>
              </thead>
              <tbody>
                {refillHistory.map((log) => (
                  <tr key={log.id} className="border-b border-kiosk-border/50">
                    <td className="py-2 pr-4 text-kiosk-text-secondary">{formatDate(log.refilled_at)}</td>
                    <td className="py-2 pr-4 uppercase">{log.paper_size}</td>
                    <td className="py-2 pr-4 text-right">{log.previous_count}</td>
                    <td className="py-2 pr-4 text-right text-kiosk-success">+{log.sheets_added}</td>
                    <td className="py-2 text-right font-semibold">{log.new_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
