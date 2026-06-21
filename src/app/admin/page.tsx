'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { DashboardStats, PrinterStatus, ScannerStatus, PaperInventory, Session } from '@/types';

interface DashboardData {
  stats: DashboardStats;
  printerStatus: PrinterStatus;
  scannerStatus: ScannerStatus;
  paperInventory: PaperInventory[];
  activeSessions: Session[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 5000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-kiosk-text-secondary">Failed to load dashboard</p>;

  const { stats, printerStatus, scannerStatus, paperInventory } = data;

  const overviewCards = [
    {
      label: 'Printer',
      value: stats.printer_online ? 'Online' : 'Offline',
      color: stats.printer_online ? 'text-kiosk-success' : 'text-kiosk-danger',
      dot: stats.printer_online ? 'online' : 'offline',
    },
    {
      label: 'Scanner',
      value: stats.scanner_online ? 'Online' : 'Offline',
      color: stats.scanner_online ? 'text-kiosk-success' : 'text-kiosk-danger',
      dot: stats.scanner_online ? 'online' : 'offline',
    },
    { label: 'Active Sessions', value: stats.active_sessions, color: 'text-kiosk-accent' },
    { label: 'Pages Today', value: stats.pages_printed_today, color: 'text-kiosk-text' },
    { label: 'Pages This Month', value: stats.pages_printed_month, color: 'text-kiosk-text' },
    { label: 'Total Scans', value: stats.total_scans, color: 'text-kiosk-text' },
    { label: 'Revenue Today', value: formatCurrency(stats.revenue_today), color: 'text-kiosk-success' },
    { label: 'Revenue This Month', value: formatCurrency(stats.revenue_month), color: 'text-kiosk-success' },
    { label: 'Paper Remaining', value: stats.paper_remaining, color: stats.paper_remaining < 50 ? 'text-kiosk-danger' : 'text-kiosk-text' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-kiosk-text-secondary text-sm">Real-time kiosk overview</p>
        </div>
        <button onClick={loadDashboard} className="kiosk-btn kiosk-btn-ghost text-sm">
          ↻ Refresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {overviewCards.map((card) => (
          <div key={card.label} className="kiosk-card">
            <p className="text-kiosk-text-muted text-xs font-medium mb-1 uppercase tracking-wider">{card.label}</p>
            <div className="flex items-center gap-2">
              {'dot' in card && <span className={`kiosk-status-dot ${card.dot}`} />}
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Device Status Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Printer Status */}
        <div className="kiosk-card">
          <div className="flex items-center gap-2 mb-4">
            <span className={`kiosk-status-dot ${printerStatus.is_online ? 'online' : 'offline'}`} />
            <h2 className="font-semibold">Printer Status</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-kiosk-text-secondary">Name</span><span>{printerStatus.name}</span></div>
            <div className="flex justify-between"><span className="text-kiosk-text-secondary">Queue</span><span>{printerStatus.queue_length} jobs</span></div>
            <div className="flex justify-between"><span className="text-kiosk-text-secondary">Paper</span><span>{printerStatus.paper_remaining} sheets</span></div>
            <div className="flex justify-between">
              <span className="text-kiosk-text-secondary">Toner</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 bg-kiosk-surface-raised rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${printerStatus.toner_level > 20 ? 'bg-kiosk-success' : 'bg-kiosk-danger'}`}
                    style={{ width: `${printerStatus.toner_level}%` }}
                  />
                </div>
                <span>{printerStatus.toner_level}%</span>
              </div>
            </div>
            <div className="flex justify-between"><span className="text-kiosk-text-secondary">Duplex</span><span>{printerStatus.duplex_available ? '✓ Available' : '✗ N/A'}</span></div>
            <div className="flex justify-between"><span className="text-kiosk-text-secondary">ADF</span><span>{printerStatus.adf_available ? '✓ Available' : '✗ N/A'}</span></div>
          </div>
        </div>

        {/* Scanner Status */}
        <div className="kiosk-card">
          <div className="flex items-center gap-2 mb-4">
            <span className={`kiosk-status-dot ${scannerStatus.is_online ? 'online' : 'offline'}`} />
            <h2 className="font-semibold">Scanner Status</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-kiosk-text-secondary">Name</span><span>{scannerStatus.name}</span></div>
            <div className="flex justify-between"><span className="text-kiosk-text-secondary">Status</span><span className={scannerStatus.is_online ? 'text-kiosk-success' : 'text-kiosk-danger'}>{scannerStatus.is_online ? 'Ready' : 'Offline'}</span></div>
            <div className="flex justify-between"><span className="text-kiosk-text-secondary">Current Job</span><span>{scannerStatus.current_job_id || 'None'}</span></div>
          </div>
        </div>
      </div>

      {/* Paper Inventory */}
      <div className="kiosk-card">
        <h2 className="font-semibold mb-4">Paper Inventory</h2>
        <div className="space-y-3">
          {paperInventory.map((inv) => {
            const pct = inv.capacity > 0 ? (inv.current_count / inv.capacity) * 100 : 0;
            return (
              <div key={inv.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{inv.paper_size.toUpperCase()}</span>
                  <span className="text-kiosk-text-secondary">{inv.current_count} / {inv.capacity}</span>
                </div>
                <div className="kiosk-progress">
                  <div
                    className={`kiosk-progress-bar ${pct > 20 ? '' : 'bg-kiosk-danger'} ${pct > 20 && pct < 50 ? 'bg-kiosk-warning' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Sessions */}
      {data.activeSessions.length > 0 && (
        <div className="kiosk-card">
          <h2 className="font-semibold mb-4">Active Sessions ({data.activeSessions.length})</h2>
          <div className="space-y-2">
            {data.activeSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-2 rounded-lg bg-kiosk-surface-raised">
                <div className="flex items-center gap-3">
                  <span className="kiosk-badge bg-kiosk-accent/10 text-kiosk-accent border-kiosk-accent/20 text-xs font-mono">
                    {session.session_code}
                  </span>
                  <span className="text-sm text-kiosk-text-secondary capitalize">{session.type}</span>
                </div>
                <span className="text-xs text-kiosk-text-muted capitalize">{session.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
