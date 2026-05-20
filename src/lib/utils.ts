// ============================================================
// Shared Utilities
// ============================================================

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Session
    waiting: 'text-amber-400',
    active: 'text-blue-400',
    completed: 'text-emerald-400',
    expired: 'text-zinc-500',
    cancelled: 'text-red-400',
    // Payment
    pending: 'text-amber-400',
    processing: 'text-violet-400',
    failed: 'text-red-400',
    success: 'text-emerald-400',
    // Print
    queued: 'text-amber-400',
    printing: 'text-blue-400',
    // Scan
    scanning: 'text-blue-400',
    // General
    online: 'text-emerald-400',
    offline: 'text-red-400',
  };
  return colors[status] || 'text-zinc-400';
}

export function getStatusBgColor(status: string): string {
  const colors: Record<string, string> = {
    waiting: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    active: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    completed: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    expired: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
    cancelled: 'bg-red-400/10 text-red-400 border-red-400/20',
    pending: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    processing: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
    failed: 'bg-red-400/10 text-red-400 border-red-400/20',
    success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    queued: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    printing: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    scanning: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    online: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    offline: 'bg-red-400/10 text-red-400 border-red-400/20',
  };
  return colors[status] || 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20';
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function weekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
