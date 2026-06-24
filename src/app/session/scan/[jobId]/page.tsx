'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';

function ScanPreviewContent() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const [loading, setLoading] = useState(false);

  // If there's no jobId, show error
  if (!jobId) {
    return <div className="p-4 text-center">Invalid scan job</div>;
  }

  const handlePrint = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scan/to-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (data.success && data.sessionCode) {
        // Redirect to the print configuration portal for this new session
        router.push(`/session/${data.sessionCode}/configure`);
      } else {
        alert(data.error || 'Failed to start print session');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to kiosk');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kiosk-bg flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden animate-fade-in">
      <header className="bg-kiosk-surface border-b border-kiosk-border p-4 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-kiosk-accent/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-kiosk-accent">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight">Scan Preview</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 bg-kiosk-bg">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-kiosk-border overflow-hidden min-h-[400px]">
          <iframe 
            src={`/api/scan/download/${jobId}`} 
            className="w-full h-full border-0"
            title="PDF Preview"
          />
        </div>

        <div className="flex flex-col gap-3 mt-auto">
          <a
            href={`/api/scan/download/${jobId}?download=true`}
            className="kiosk-btn kiosk-btn-primary w-full text-center py-4 text-base"
          >
            Download PDF
          </a>
          <button
            onClick={handlePrint}
            disabled={loading}
            className="kiosk-btn kiosk-btn-success w-full py-4 text-base"
          >
            {loading ? 'Preparing Print...' : 'Print this Document'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function MobileScanPreview() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" /></div>}>
      <ScanPreviewContent />
    </Suspense>
  );
}
