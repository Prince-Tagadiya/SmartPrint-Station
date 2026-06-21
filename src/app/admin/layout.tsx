'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import AdminErrorModal from '@/components/AdminErrorModal';
import AdminTamperModal from '@/components/AdminTamperModal';
import HardwareConnection from '@/components/HardwareConnection';

const navItems = [
  { href: '/admin', label: 'Overview', icon: '⊞' },
  { href: '/admin/printer', label: 'Printer', icon: '⎙' },
  { href: '/admin/scanner', label: 'Scanner', icon: '⊟' },
  { href: '/admin/paper', label: 'Paper', icon: '◫' },
  { href: '/admin/history', label: 'History', icon: '☰' },
  { href: '/admin/events', label: 'Events', icon: '⚡' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-kiosk-surface border-r border-kiosk-border flex flex-col transition-transform duration-200',
          'lg:translate-x-0 lg:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="p-5 border-b border-kiosk-border">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-kiosk-accent/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-kiosk-accent">
                <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm">Print Kiosk</p>
              <p className="text-xs text-kiosk-text-muted">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-kiosk-accent/10 text-kiosk-accent'
                    : 'text-kiosk-text-secondary hover:text-kiosk-text hover:bg-kiosk-surface-hover'
                )}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Hardware Connection UI */}
        <div className="p-3 border-t border-kiosk-border mt-auto">
          <HardwareConnection />
        </div>

        {/* Quick links */}
        <div className="p-3 border-t border-kiosk-border">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-kiosk-text-muted hover:text-kiosk-text transition-colors"
          >
            ← Customer Portal
          </Link>
          <Link
            href="/tft"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-kiosk-text-muted hover:text-kiosk-text transition-colors"
          >
            ◉ TFT Display
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-kiosk-border bg-kiosk-surface">
          <button onClick={() => setSidebarOpen(true)} className="kiosk-btn kiosk-btn-ghost p-2 min-h-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-bold text-sm">Print Kiosk Admin</span>
          <div className="w-8" />
        </header>

        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
      
      <AdminTamperModal />
    </div>
    </>
  );
}
