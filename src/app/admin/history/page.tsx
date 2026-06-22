'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDate, formatCurrency, getStatusBgColor, cn } from '@/lib/utils';
import type { PrintJob, ScanJob } from '@/types';

type FilterPeriod = 'today' | 'week' | 'month' | 'all';
type FilterType = 'all' | 'print' | 'scan';

export default function HistoryPage() {
  const [printHistory, setPrintHistory] = useState<PrintJob[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanJob[]>([]);
  const [period, setPeriod] = useState<FilterPeriod>('today');
  const [type, setType] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/history?filter=${period}&type=${type}`);
      const data = await res.json();
      if (data.success) {
        setPrintHistory(data.data.printHistory || []);
        setScanHistory(data.data.scanHistory || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [period, type]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    window.open(`/api/admin/history?filter=${period}&type=${type}&format=csv`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Print & Scan History</h1>
        <button onClick={exportCsv} className="kiosk-btn kiosk-btn-ghost text-sm">
          ↓ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg overflow-hidden border border-kiosk-border">
          {(['today', 'week', 'month', 'all'] as FilterPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                period === p ? 'bg-kiosk-accent text-white' : 'text-kiosk-text-secondary hover:bg-kiosk-surface-hover'
              )}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-kiosk-border">
          {(['all', 'print', 'scan'] as FilterType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                type === t ? 'bg-kiosk-accent text-white' : 'text-kiosk-text-secondary hover:bg-kiosk-surface-hover'
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Print History */}
          {type !== 'scan' && printHistory.length > 0 && (
            <div className="kiosk-card">
              <h2 className="font-semibold mb-4">Print Jobs ({printHistory.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-kiosk-text-muted border-b border-kiosk-border text-left">
                      <th className="py-2 pr-3">File</th>
                      <th className="py-2 pr-3">Pages</th>
                      <th className="py-2 pr-3">Copies</th>
                      <th className="py-2 pr-3">Color</th>
                      <th className="py-2 pr-3">Duplex</th>
                      <th className="py-2 pr-3">Cost</th>
                      <th className="py-2 pr-3">Payment</th>
                      <th className="py-2 pr-3">Print</th>
                      <th className="py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printHistory.map((job) => (
                      <tr key={job.id} className="border-b border-kiosk-border/30">
                        <td className="py-2 pr-3 max-w-[150px] truncate">{job.file_name}</td>
                        <td className="py-2 pr-3">{job.total_pages}</td>
                        <td className="py-2 pr-3">{job.copies}</td>
                        <td className="py-2 pr-3 uppercase">{job.color_mode}</td>
                        <td className="py-2 pr-3">{job.duplex ? 'Yes' : 'No'}</td>
                        <td className="py-2 pr-3">{formatCurrency(job.estimated_cost)}</td>
                        <td className="py-2 pr-3"><span className={`kiosk-badge text-[10px] ${getStatusBgColor(job.payment_status)}`}>{job.payment_status}</span></td>
                        <td className="py-2 pr-3"><span className={`kiosk-badge text-[10px] ${getStatusBgColor(job.print_status)}`}>{job.print_status}</span></td>
                        <td className="py-2 text-kiosk-text-muted text-xs">{formatDate(job.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scan History */}
          {type !== 'print' && scanHistory.length > 0 && (
            <div className="kiosk-card">
              <h2 className="font-semibold mb-4">Scan Jobs ({scanHistory.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-kiosk-text-muted border-b border-kiosk-border text-left">
                      <th className="py-2 pr-3">Session</th>
                      <th className="py-2 pr-3">Mode</th>
                      <th className="py-2 pr-3">Pages</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanHistory.map((job) => (
                      <tr key={job.id} className="border-b border-kiosk-border/30">
                        <td className="py-2 pr-3 font-mono text-xs">{job.session_id.slice(0, 12)}...</td>
                        <td className="py-2 pr-3 capitalize">{job.scan_mode.replace('_', ' ')}</td>
                        <td className="py-2 pr-3">{job.total_pages}</td>
                        <td className="py-2 pr-3"><span className={`kiosk-badge text-[10px] ${getStatusBgColor(job.status)}`}>{job.status}</span></td>
                        <td className="py-2 text-kiosk-text-muted text-xs">{formatDate(job.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {printHistory.length === 0 && scanHistory.length === 0 && (
            <div className="kiosk-card text-center py-12">
              <p className="text-kiosk-text-muted text-lg">No records found for this period</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
