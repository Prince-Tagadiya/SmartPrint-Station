'use client';

import { useEffect, useState, useCallback } from 'react';
import type { PrinterStatus } from '@/types';

export default function PrinterPage() {
  const [printer, setPrinter] = useState<PrinterStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const [previewJobId, setPreviewJobId] = useState<number | null>(null);
  const [errorHistory, setErrorHistory] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [statusRes, listRes, errRes] = await Promise.all([
        fetch('/api/printer/status'),
        fetch('/api/printer/list'),
        fetch('/api/admin/error-history')
      ]);
      const statusData = await statusRes.json();
      const listData = await listRes.json();
      const errData = await errRes.json();
      
      if (statusData.success) {
        setPrinter(statusData.data);
      }
      if (listData.success) {
        setAvailablePrinters(listData.data);
        if (listData.data.length > 0) {
          setSelectedModel(prev => prev ? prev : listData.data[0]);
        }
      }
      if (errData.success) {
        setErrorHistory(errData.data);
      }
    } catch { /* ignore */ }
  }, [selectedModel]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load]);

  const handleAction = async (action: string, data?: any) => {
    try {
      const res = await fetch('/api/printer/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
      const resData = await res.json();
      if (resData.success) {
        setPrinter(resData.data);
        load();
      } else {
        if (resData.data) {
          setPrinter(resData.data);
        }
        if (resData.error) {
          alert(resData.error);
        }
      }
    } catch { /* ignore */ }
  };

  const handleTestScan = async () => {
    if (!printer?.is_online) return alert('Printer must be connected first!');
    setIsTesting(true);
    try {
      const res = await fetch('/api/admin/test-scan', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.jobId) {
        setPreviewJobId(data.jobId);
      } else {
        alert(data.error || 'Failed to start test scan');
      }
    } catch (e) {
      alert('Error initiating test scan');
    }
    setIsTesting(false);
  };

  const handleConfirmPrint = async () => {
    if (!previewJobId) return;
    setIsTesting(true);
    try {
      const res = await fetch('/api/admin/test-print', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanJobId: previewJobId })
      });
      const data = await res.json();
      if (data.success) {
        alert('Test print job initiated and sent to printer!');
        setPreviewJobId(null);
      } else {
        alert(data.error || 'Failed to start test print');
      }
    } catch (e) {
      alert('Error initiating test print');
    }
    setIsTesting(false);
  };

  const [showPaperModal, setShowPaperModal] = useState(false);
  const [paperAmount, setPaperAmount] = useState(500);
  const [paperMode, setPaperMode] = useState<'add' | 'set'>('set');
  const [paperUpdateStatus, setPaperUpdateStatus] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    // If tray is pulled out, show the modal
    if (printer?.tray_status === 'out' && !showPaperModal) {
      setShowPaperModal(true);
      setPaperUpdateStatus('idle');
    }
    // If tray goes back in, hide modal instantly
    if (printer?.tray_status === 'in' && showPaperModal) {
      setShowPaperModal(false);
    }
  }, [printer?.tray_status, showPaperModal]);

  const handleUpdatePaper = async () => {
    if (!printer) return;
    try {
      const res = await fetch('/api/admin/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paperSize: printer.paper_loaded, 
          sheets: paperAmount, 
          mode: paperMode 
        })
      });
      const data = await res.json();
      if (data.success) {
        setPaperUpdateStatus('success');
        load(); // Refresh data
      } else {
        alert(data.error || 'Failed to update paper');
      }
    } catch {
      alert('Error updating paper');
    }
  };

  if (!printer) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-kiosk-text">Printer Monitoring</h1>

      {printer.current_error && printer.current_error !== 'Paper Tray 1 not detected' && (
        <div className="bg-kiosk-danger/10 border-l-4 border-kiosk-danger p-4 rounded-r-lg flex items-start">
          <svg className="w-6 h-6 text-kiosk-danger mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-kiosk-danger font-bold">Instant Hardware Error</h3>
            <p className="text-kiosk-danger text-sm mt-1">The printer reported an error: <strong>{printer.current_error}</strong></p>
          </div>
        </div>
      )}

      {/* Update Paper Modal Overlay */}
      {showPaperModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-kiosk-surface p-6 rounded-xl max-w-sm w-full shadow-2xl animate-scale-in relative">
            {paperUpdateStatus === 'success' ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-kiosk-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-kiosk-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-kiosk-success mb-2">Paper Updated!</h3>
                <p className="text-kiosk-text-muted">
                  {printer.tray_status === 'out' ? 'Please close the paper tray to continue.' : 'Tray closed. You can dismiss this now.'}
                </p>
                {printer.tray_status === 'in' && (
                  <button onClick={() => setShowPaperModal(false)} className="kiosk-btn kiosk-btn-ghost mt-6 w-full">
                    Close
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-kiosk-text">Update Paper Inventory</h3>
                  <button onClick={() => setShowPaperModal(false)} className="text-kiosk-text-muted hover:text-kiosk-text">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="bg-kiosk-accent/10 p-4 rounded-lg mb-6 border border-kiosk-accent/20">
                  <p className="text-sm font-semibold text-kiosk-accent">Current Paper ({printer.paper_loaded})</p>
                  <p className="text-3xl font-black text-kiosk-text">{printer.paper_remaining} <span className="text-base font-medium text-kiosk-text-muted">sheets</span></p>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPaperMode('set')}
                      className={`flex-1 py-2 rounded font-semibold text-sm transition-colors ${paperMode === 'set' ? 'bg-kiosk-accent text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      Set Total
                    </button>
                    <button 
                      onClick={() => setPaperMode('add')}
                      className={`flex-1 py-2 rounded font-semibold text-sm transition-colors ${paperMode === 'add' ? 'bg-kiosk-accent text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      Add Pages
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-kiosk-text-muted mb-1">
                      {paperMode === 'set' ? 'New Total Sheets' : 'Sheets to Add'}
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      max="1000"
                      value={paperAmount}
                      onChange={e => setPaperAmount(parseInt(e.target.value) || 0)}
                      className="w-full bg-kiosk-bg border border-kiosk-border rounded-lg p-3 text-lg font-bold text-kiosk-text focus:border-kiosk-accent focus:ring-1 focus:ring-kiosk-accent transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowPaperModal(false)} className="kiosk-btn kiosk-btn-ghost flex-1">
                    Cancel
                  </button>
                  <button onClick={handleUpdatePaper} className="kiosk-btn kiosk-btn-primary flex-1 shadow-lg">
                    Update Inventory
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="kiosk-card flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-kiosk-accent/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-kiosk-accent">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{printer.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${printer.is_online ? 'bg-kiosk-success/10 text-kiosk-success' : 'bg-kiosk-danger/10 text-kiosk-danger'}`}>
                {printer.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-sm text-kiosk-text-muted mt-1">
              Model: {printer.printer_model}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {printer.is_online ? (
            <div className="flex gap-2">
              <button
                onClick={handleTestScan}
                disabled={isTesting}
                className="kiosk-btn kiosk-btn-primary text-sm"
              >
                {isTesting ? 'Testing...' : 'Test Scan'}
              </button>
              <button
                onClick={() => handleAction('disconnect')}
                className="kiosk-btn kiosk-btn-danger text-sm"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-kiosk-bg border border-kiosk-border rounded px-3 py-1 text-sm text-kiosk-text"
              >
                {availablePrinters.length > 0 ? availablePrinters.map(p => (
                  <option key={p} value={p}>{p}</option>
                )) : (
                  <option value="">No printers found</option>
                )}
              </select>
              <button
                onClick={() => handleAction('connect', { model: selectedModel })}
                className="kiosk-btn kiosk-btn-success text-sm"
              >
                Connect
              </button>
            </>
          )}
        </div>
      </div>

      <div className="kiosk-card">
        <div className="flex items-center gap-3 mb-6">
          <span className={`kiosk-status-dot ${printer.is_online ? 'online' : 'offline'}`} />
          <h2 className="text-xl font-bold">{printer.name}</h2>
          <span className={`kiosk-badge text-xs ${printer.is_online ? 'bg-kiosk-success-bg text-kiosk-success border-kiosk-success/20' : 'bg-kiosk-danger-bg text-kiosk-danger border-kiosk-danger/20'}`}>
            {printer.is_online ? 'ONLINE' : 'OFFLINE'}
          </span>
          {printer.printer_model === 'Brother DCP-T525W' && (
            <span className="kiosk-badge text-xs bg-kiosk-accent/10 text-kiosk-accent border-kiosk-accent/20 ml-2">
              Brother Connected
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-kiosk-text-muted uppercase tracking-wider mb-1">Current Job</p>
              <p className="text-lg font-semibold">{printer.current_job_id ? `Job #${printer.current_job_id}` : 'No Active Job'}</p>
            </div>
            <div>
              <p className="text-xs text-kiosk-text-muted uppercase tracking-wider mb-1">Queue Length</p>
              <p className="text-lg font-semibold">{printer.queue_length} jobs</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-kiosk-text-muted uppercase tracking-wider mb-1">Paper Remaining</p>
              <p className="text-lg font-semibold">{printer.paper_remaining} sheets</p>
            </div>
            <div>
              <p className="text-xs text-kiosk-text-muted uppercase tracking-wider mb-2">Ink Levels</p>
              
              {printer.ink_c !== null && printer.ink_m !== null && printer.ink_y !== null && printer.ink_k !== null && printer.ink_c !== undefined ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-xs font-bold" style={{ color: '#00BFFF' }}>C</span>
                    <div className="flex-1 kiosk-progress h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${printer.ink_c}%`, backgroundColor: '#00BFFF' }} />
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-slate-600">{printer.ink_c}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-xs font-bold" style={{ color: '#FF00FF' }}>M</span>
                    <div className="flex-1 kiosk-progress h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${printer.ink_m}%`, backgroundColor: '#FF00FF' }} />
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-slate-600">{printer.ink_m}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-xs font-bold" style={{ color: '#FFCC00' }}>Y</span>
                    <div className="flex-1 kiosk-progress h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${printer.ink_y}%`, backgroundColor: '#FFCC00' }} />
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-slate-600">{printer.ink_y}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-xs font-bold" style={{ color: '#222222' }}>BK</span>
                    <div className="flex-1 kiosk-progress h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${printer.ink_k}%`, backgroundColor: '#222222' }} />
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-slate-600">{printer.ink_k}%</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 kiosk-progress h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${printer.toner_level > 20 ? 'bg-kiosk-success' : 'bg-kiosk-danger'}`}
                      style={{ width: `${printer.toner_level}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold">{printer.toner_level}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 bg-kiosk-surface-raised p-4 rounded-lg border border-kiosk-border">
            <div>
              <p className="text-xs text-kiosk-text-muted uppercase tracking-wider mb-1">Tray Status</p>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${printer.tray_status === 'in' ? 'bg-kiosk-success' : 'bg-kiosk-warning animate-pulse'}`} />
                <p className="text-lg font-semibold">{printer.tray_status === 'in' ? 'Closed (Ready)' : 'Open (Paper Out)'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-kiosk-text-muted uppercase tracking-wider mb-1">Paper Loaded</p>
              <p className="text-lg font-semibold">{printer.paper_loaded}</p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {printer.tray_status === 'in' ? (
                <button onClick={() => handleAction('tray_out')} className="kiosk-btn kiosk-btn-ghost text-sm w-full">
                  Pull Tray Out
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="kiosk-input text-sm p-2 flex items-center bg-kiosk-surface-raised cursor-not-allowed text-kiosk-text-muted">
                    A4 (Standard)
                  </div>
                  <button
                    onClick={() => {
                      handleAction('tray_in', { paperLoaded: 'A4' });
                    }}
                    className="kiosk-btn kiosk-btn-success text-sm w-full"
                  >
                    Push Tray In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error History */}
      <div className="kiosk-card mt-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-kiosk-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Error History (last 10 errors)
        </h2>
        {errorHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-kiosk-surface-raised text-kiosk-text-muted uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">No.</th>
                  <th className="px-4 py-3">Error Description</th>
                  <th className="px-4 py-3 rounded-r-lg">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {errorHistory.map((err, index) => (
                  <tr key={err.id} className="border-b border-kiosk-border last:border-0">
                    <td className="px-4 py-3 font-bold text-kiosk-text-muted">{index + 1} :</td>
                    <td className="px-4 py-3 font-medium text-kiosk-danger">{err.description}</td>
                    <td className="px-4 py-3 text-kiosk-text-muted">
                      {new Date(err.created_at + 'Z').toLocaleString(undefined, { 
                        year: 'numeric', month: '2-digit', day: '2-digit', 
                        hour: '2-digit', minute: '2-digit', hour12: false 
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-kiosk-text-muted text-sm p-4 bg-kiosk-surface-raised rounded-lg text-center">
            No errors recorded.
          </p>
        )}
      </div>

      {/* Preview Modal */}
      {previewJobId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-kiosk-bg w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] animate-fade-in">
            <div className="p-4 border-b border-kiosk-border flex items-center justify-between bg-kiosk-surface">
              <h3 className="text-xl font-bold">Document Preview</h3>
              <button onClick={() => setPreviewJobId(null)} className="p-2 hover:bg-kiosk-bg-hover rounded-full transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-kiosk-text-muted">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 bg-white relative">
              <iframe 
                src={`/api/scan/download/${previewJobId}`} 
                className="w-full h-full border-0 absolute inset-0"
                title="Scan Preview"
              />
            </div>
            <div className="p-6 border-t border-kiosk-border bg-kiosk-surface flex justify-end gap-4">
              <button 
                onClick={() => setPreviewJobId(null)} 
                className="kiosk-btn kiosk-btn-ghost"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmPrint} 
                disabled={isTesting}
                className="kiosk-btn kiosk-btn-primary"
              >
                {isTesting ? 'Sending to Printer...' : 'Print This Document'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
