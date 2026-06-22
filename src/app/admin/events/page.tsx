'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDate, cn } from '@/lib/utils';
import type { EventLog, EventCategory, HardwareEvent } from '@/types';

export default function EventsPage() {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [hardwareEvents, setHardwareEvents] = useState<HardwareEvent[]>([]);
  const [category, setCategory] = useState<EventCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      const res = await fetch(`/api/admin/events?${params}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.data.events);
        setHardwareEvents(data.data.hardwareEvents);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const getEventIcon = (cat: string) => {
    switch (cat) {
      case 'printer': return '⎙';
      case 'scanner': return '⊟';
      case 'payment': return '₹';
      case 'system': return '⚡';
      case 'hardware': return '🔧';
      default: return '•';
    }
  };

  const categories: (EventCategory | 'all')[] = ['all', 'printer', 'scanner', 'payment', 'system', 'hardware'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Machine Event Logs</h1>
        <button onClick={load} className="kiosk-btn kiosk-btn-ghost text-sm">↻ Refresh</button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'kiosk-btn text-sm min-h-[36px] py-1 px-3',
              category === cat ? 'kiosk-btn-primary' : 'kiosk-btn-ghost'
            )}
          >
            {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Event Log */}
          <div className="kiosk-card">
            <h2 className="font-semibold mb-4">Events ({events.length})</h2>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-2 border-b border-kiosk-border/30 last:border-0">
                  <span className="text-base mt-0.5 w-5 text-center">{getEventIcon(event.event_category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-kiosk-surface-raised text-kiosk-text-secondary">
                        {event.event_type}
                      </span>
                      <span className="kiosk-badge text-[10px] bg-kiosk-surface-raised text-kiosk-text-muted border-kiosk-border">
                        {event.event_category}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm text-kiosk-text-secondary mt-0.5">{event.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-kiosk-text-muted whitespace-nowrap">{formatDate(event.created_at)}</span>
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-center text-kiosk-text-muted py-8">No events found</p>
              )}
            </div>
          </div>

          {/* Hardware Events */}
          <div className="kiosk-card">
            <h2 className="font-semibold mb-4">Hardware Events (ESP32)</h2>
            {hardwareEvents.length > 0 ? (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {hardwareEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 py-2 border-b border-kiosk-border/30 last:border-0">
                    <span className="text-base">🔧</span>
                    <span className="kiosk-badge text-[10px] bg-kiosk-processing-bg text-kiosk-processing border-kiosk-processing/20">
                      {event.sensor_type}
                    </span>
                    <span className="text-sm">{event.event_type.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-kiosk-text-muted ml-auto">{formatDate(event.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-kiosk-text-muted mb-2">No hardware events yet</p>
                <p className="text-xs text-kiosk-text-muted">
                  Supported sensors: MPU6050 • Hall • Door • Paper • NFC • RFID
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
