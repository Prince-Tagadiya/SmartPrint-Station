'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatCurrency } from '@/lib/utils';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success) setSettings(data.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Pricing */}
      <div className="kiosk-card">
        <h2 className="font-semibold mb-4">Pricing Configuration</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-kiosk-text-secondary block mb-1">B&W Single Side (₹/page)</label>
              <input
                type="number"
                value={settings.pricing_bw_single || ''}
                onChange={(e) => updateSetting('pricing_bw_single', e.target.value)}
                className="kiosk-input"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-sm text-kiosk-text-secondary block mb-1">B&W Duplex (₹/sheet)</label>
              <input
                type="number"
                value={settings.pricing_bw_duplex || ''}
                onChange={(e) => updateSetting('pricing_bw_duplex', e.target.value)}
                className="kiosk-input"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-sm text-kiosk-text-secondary block mb-1">Color Single Side (₹/page)</label>
              <input
                type="number"
                value={settings.pricing_color_single || ''}
                onChange={(e) => updateSetting('pricing_color_single', e.target.value)}
                className="kiosk-input"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-sm text-kiosk-text-secondary block mb-1">Color Duplex (₹/sheet)</label>
              <input
                type="number"
                value={settings.pricing_color_duplex || ''}
                onChange={(e) => updateSetting('pricing_color_duplex', e.target.value)}
                className="kiosk-input"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-sm text-kiosk-text-secondary block mb-1">Scan Per Page (₹/page)</label>
              <input
                type="number"
                value={settings.pricing_scan_per_page || ''}
                onChange={(e) => updateSetting('pricing_scan_per_page', e.target.value)}
                className="kiosk-input"
                step="0.5"
              />
            </div>
          </div>

          <div className="bg-kiosk-surface-raised rounded-lg p-3">
            <p className="text-xs text-kiosk-text-muted mb-1">Current rates</p>
            <p className="text-sm">
              B&W: {formatCurrency(Number(settings.pricing_bw_single || 0))}/page •
              Color: {formatCurrency(Number(settings.pricing_color_single || 0))}/page •
              Scan: {formatCurrency(Number(settings.pricing_scan_per_page || 0))}/page
            </p>
          </div>
        </div>
      </div>

      {/* System Settings */}
      <div className="kiosk-card">
        <h2 className="font-semibold mb-4">System Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-kiosk-text-secondary block mb-1">Kiosk Name</label>
            <input
              type="text"
              value={settings.kiosk_name || ''}
              onChange={(e) => updateSetting('kiosk_name', e.target.value)}
              className="kiosk-input"
            />
          </div>
          <div>
            <label className="text-sm text-kiosk-text-secondary block mb-1">Session Timeout (minutes)</label>
            <input
              type="number"
              value={settings.session_timeout_minutes || ''}
              onChange={(e) => updateSetting('session_timeout_minutes', e.target.value)}
              className="kiosk-input"
              min={5}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => updateSetting('auto_payment_approve', settings.auto_payment_approve === 'true' ? 'false' : 'true')}
              className={`w-12 h-7 rounded-full transition-colors relative ${settings.auto_payment_approve === 'true' ? 'bg-kiosk-accent' : 'bg-kiosk-border'}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${settings.auto_payment_approve === 'true' ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
            <div>
              <p className="text-sm font-medium">Auto-Approve Payments (Testing)</p>
              <p className="text-xs text-kiosk-text-muted">Automatically approve all payments for development testing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="kiosk-btn kiosk-btn-primary"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-kiosk-success text-sm">✓ Settings saved</span>}
      </div>
    </div>
  );
}
