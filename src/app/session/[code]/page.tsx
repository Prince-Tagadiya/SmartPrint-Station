'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { formatCurrency, cn } from '@/lib/utils';
import type { PrintJob, ScanJob, Session, Payment, ColorMode, PaperSize, PrintQuality, ScanMode, PrintOrientation } from '@/types';

type Step = 'loading' | 'upload' | 'settings' | 'preview' | 'payment' | 'waiting-tft' | 'printing' | 'complete' | 'scan-select' | 'scanning' | 'scan-complete' | 'error';

interface SessionData {
  session: Session;
  printJob: PrintJob | null;
  scanJob: ScanJob | null;
}

export default function SessionPage() {
  const pathname = usePathname();
  
  // Extract session code from URL path: /session/[code]
  const code = pathname?.split('/').filter(Boolean).pop() || '';

  const [step, setStep] = useState<Step>('loading');
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [scanJob, setScanJob] = useState<ScanJob | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [paymentPolling, setPaymentPolling] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [showMockPayment, setShowMockPayment] = useState(false);
  const [mockPaymentData, setMockPaymentData] = useState<any>(null);

  // Print settings
  const [colorMode, setColorMode] = useState<ColorMode>('bw');
  const [duplex, setDuplex] = useState(false);
  const [copies, setCopies] = useState(1);
  const [pageRange, setPageRange] = useState('all');
  const [customRange, setCustomRange] = useState('');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [printQuality, setPrintQuality] = useState<PrintQuality>('normal');
  const [orientation, setOrientation] = useState<PrintOrientation>('portrait');
  const [sizing, setSizing] = useState<'fit' | 'fill'>('fit');

  // Load session data - bulletproof direct fetch
  useEffect(() => {
    if (!code) return;

    let isMounted = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${baseUrl}/api/sessions/${code}`, { 
          cache: 'no-store',
          signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        const data = await res.json();
        
        if (!isMounted) return;

        if (!data.success) {
          setError(data.error || 'Session not found');
          setStep('error');
          return;
        }
        
        setSessionData(data.data);
        const session: Session = data.data.session;

        if (session.type === 'scan') {
          if (data.data.scanJob?.status === 'completed') {
            setScanJob(data.data.scanJob);
            // If the laptop already auto-uploaded the PDF and created a print job,
            // go straight to settings — no manual upload needed.
            if (data.data.printJob?.id) {
              const job = data.data.printJob;
              setPrintJob(job);
              setColorMode(job.color_mode);
              setDuplex(!!job.duplex);
              setCopies(job.copies);
              setPageRange(job.page_range);
              setPaperSize(job.paper_size);
              setPrintQuality(job.print_quality);
              setOrientation(job.orientation || 'portrait');
              setSizing(job.sizing || 'fit');
              setStep('settings');
              return;
            }
            // Otherwise fall through to regular print job check below
          } else {
            setStep('scan-select');
            return;
          }
        }

        // Print session logic
        if (data.data.printJob && data.data.printJob.id) {
          const job = data.data.printJob;
          setPrintJob(job);
          setColorMode(job.color_mode);
          setDuplex(!!job.duplex);
          setCopies(job.copies);
          setPageRange(job.page_range);
          setPaperSize(job.paper_size);
          setPrintQuality(job.print_quality);
          setOrientation(job.orientation || 'portrait');
          setSizing(job.sizing || 'fit');

          if (job.print_status === 'completed') {
            setStep('complete');
          } else if (job.print_status === 'printing') {
            setStep('printing');
          } else if (job.payment_status === 'success') {
            setStep('waiting-tft');
          } else {
            setStep('settings');
          }
        } else {
          setStep('upload');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Fetch error:', err);
        setError(`Failed to connect: ${err.name === 'AbortError' ? 'Timeout' : err.message}`);
        setStep('error');
      }
    };

    load();

    return () => { 
      isMounted = false; 
      controller.abort();
    };
  }, [code]);

  // Load Razorpay script dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayReady(true);
    document.body.appendChild(script);
    return () => {
      try {
        document.body.removeChild(script);
      } catch { /* ignore */ }
    };
  }, []);

  // Poll for print status during settings, printing, or waiting for TFT
  useEffect(() => {
    if ((step !== 'settings' && step !== 'printing' && step !== 'waiting-tft') || !printJob) return;
    const interval = setInterval(async () => {
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${baseUrl}/api/print/status?jobId=${printJob.id}`);
        const data = await res.json();
        if (data.success) {
          const fetchedJob = data.data.printJob;
          setPrintJob(fetchedJob);
          
          if (step === 'settings') {
            // Keep local state perfectly in sync with the DB (modified by TFT touch)
            if (fetchedJob.color_mode !== colorMode) setColorMode(fetchedJob.color_mode as 'bw' | 'color');
            if (fetchedJob.duplex !== (duplex ? 1 : 0)) setDuplex(fetchedJob.duplex === 1);
            if (fetchedJob.copies !== copies) setCopies(fetchedJob.copies);
            if (fetchedJob.orientation !== orientation) setOrientation(fetchedJob.orientation as PrintOrientation);
            if (fetchedJob.sizing !== sizing) setSizing(fetchedJob.sizing as 'fit' | 'fill');
          } else if (step === 'waiting-tft' && fetchedJob.print_status === 'printing') {
            setStep('printing');
          } else if (fetchedJob.print_status === 'completed') {
            setStep('complete');
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [code, step, colorMode, duplex, copies, orientation, sizing]);

  // Wrapper for updating a setting both locally and on the server immediately
  const updateSetting = async (key: string, value: any) => {
    // 1. Update local state
    if (key === 'colorMode') setColorMode(value);
    if (key === 'duplex') setDuplex(value);
    if (key === 'copies') setCopies(value);
    if (key === 'orientation') setOrientation(value);
    if (key === 'sizing') setSizing(value);
    
    // 2. Fire and forget update to DB
    if (!printJob) return;
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      await fetch(`${baseUrl}/api/print/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: printJob.id,
          colorMode: key === 'colorMode' ? value : colorMode,
          duplex: key === 'duplex' ? value : duplex,
          copies: key === 'copies' ? value : copies,
          pageRange: pageRange === 'custom' ? customRange : 'all',
          paperSize,
          printQuality,
          orientation: key === 'orientation' ? value : orientation,
          sizing: key === 'sizing' ? value : sizing,
        }),
      });
    } catch (e) {
      console.error('Failed to sync setting to server:', e);
    }
  };

  // Poll for payment status
  useEffect(() => {
    if (!paymentPolling || !payment) return;
    const interval = setInterval(async () => {
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${baseUrl}/api/payment/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: payment.id }),
        });
        const data = await res.json();
        if (data.success) {
          setPayment(data.data.payment);
          setPrintJob(data.data.printJob);
          if (data.data.isPaid) {
            setPaymentPolling(false);
            // We now wait for the user to confirm on the TFT display!
            setStep('waiting-tft');
          }
        }
      } catch { /* ignore */ }
    }, 1500);
    return () => clearInterval(interval);
  }, [paymentPolling, payment]);

  // File upload handler
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    
    if (!isPdf && !isImage) {
      setError('Only PDF or Image files are accepted');
      return;
    }

    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionCode', code);

    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${baseUrl}/api/print/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setPrintJob(data.data.printJob);
        setStep('settings');
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Configure print settings
  const handleConfigure = async () => {
    if (!printJob) return;
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${baseUrl}/api/print/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: printJob.id,
          colorMode,
          duplex,
          copies,
          pageRange: pageRange === 'custom' ? customRange : 'all',
          paperSize,
          printQuality,
          orientation,
          sizing,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPrintJob(data.data.printJob);
      }
    } catch { /* ignore */ }
  };

  // Debounced configure on settings change
  useEffect(() => {
    if (step !== 'settings' || !printJob) return;
    const timer = setTimeout(handleConfigure, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorMode, duplex, copies, pageRange, customRange, paperSize, printQuality, orientation]);

  // Initiate payment
  const handlePayment = async () => {
    if (!printJob) return;
    setIsInitiatingPayment(true);
    setError('');
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${baseUrl}/api/payment/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: printJob.id }),
      });
      const data = await res.json();
      if (data.success) {
        setPayment(data.data.payment);
        
        if (data.data.isMock) {
          setMockPaymentData(data.data);
          setShowMockPayment(true);
          setIsInitiatingPayment(false);
          return;
        }

        if (!razorpayReady && !(window as any).Razorpay) {
          setError('Payment gateway is still loading. Please try again in a moment.');
          setIsInitiatingPayment(false);
          return;
        }
        
        // Open Razorpay Checkout modal
        const options = {
          key: data.data.key,
          amount: data.data.amount,
          currency: data.data.currency,
          name: "SmartPrint Station",
          description: `Print Kiosk - Job #${printJob.id}`,
          order_id: data.data.orderId,
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch(`${baseUrl}/api/payment/razorpay/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  paymentId: data.data.payment.id,
                }),
              });
              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                setStep('waiting-tft');
              } else {
                setError(verifyData.error || 'Payment signature verification failed');
                setStep('settings');
              }
            } catch {
              setError('Failed to verify payment with server');
              setStep('settings');
            }
          },
          modal: {
            ondismiss: function () {
              setStep('settings');
            }
          },
          prefill: {
            contact: "",
            email: ""
          },
          theme: {
            color: "#3b82f6"
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        setError(data.error || 'Failed to initiate payment');
        setStep('settings');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to initiate payment. Please check your network connection.');
      setStep('settings');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  const handleConfirmMockPayment = async () => {
    if (!mockPaymentData) return;
    setIsInitiatingPayment(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const verifyRes = await fetch(`${baseUrl}/api/payment/razorpay/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_order_id: mockPaymentData.orderId,
          razorpay_signature: 'mock_signature',
          paymentId: mockPaymentData.payment.id,
        }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        setShowMockPayment(false);
        setStep('waiting-tft');
      } else {
        setError(verifyData.error || 'Mock payment verification failed');
      }
    } catch {
      setError('Failed to verify mock payment');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  // Scan handlers
  const handleStartScan = async (mode: ScanMode) => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${baseUrl}/api/scan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: code, scanMode: mode }),
      });
      const data = await res.json();
      if (data.success) {
        setScanJob(data.data.scanJob);
        setStep('scanning');
        // For single/adf, poll for completion
        if (mode === 'single' || mode === 'adf') {
          pollScanComplete(data.data.scanJob.id);
        }
      }
    } catch {
      setError('Failed to start scan');
    }
  };

  const handleAddPage = async () => {
    if (!scanJob) return;
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${baseUrl}/api/scan/add-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: scanJob.id }),
      });
      const data = await res.json();
      if (data.success) setScanJob(data.data.scanJob);
    } catch { /* ignore */ }
  };

  const handleFinishScan = async () => {
    if (!scanJob) return;
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${baseUrl}/api/scan/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: scanJob.id }),
      });
      const data = await res.json();
      if (data.success) {
        setScanJob(data.data.scanJob);
        setStep('scan-complete');
      }
    } catch { /* ignore */ }
  };

  const pollScanComplete = (jobId: number) => {
    const interval = setInterval(async () => {
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${baseUrl}/api/sessions/${code}`);
        const data = await res.json();
        if (data.success && data.data.scanJob?.status === 'completed') {
          setScanJob(data.data.scanJob);
          setStep('scan-complete');
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 1500);
    setTimeout(() => clearInterval(interval), 30000);
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-kiosk-text-secondary">Connecting to Print Kiosk...</p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="kiosk-card max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-kiosk-danger-bg flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-kiosk-danger">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">{error || 'Something went wrong'}</h2>
          <p className="text-kiosk-text-secondary mb-6">Please scan the QR code again or enter a valid session code.</p>
          <a href="/" className="kiosk-btn kiosk-btn-primary">Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <a href="/" className="text-kiosk-text-muted hover:text-kiosk-text">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 className="text-lg font-bold">Session: {code}</h1>
            <p className="text-xs text-kiosk-text-muted">
              {sessionData?.session.type === 'scan' ? 'Scan' : 'Print'} Session
            </p>
          </div>
        </div>
        <div className="kiosk-badge bg-kiosk-accent/10 text-kiosk-accent border-kiosk-accent/20">
          {code}
        </div>
      </div>

      {error && (
        <div className="bg-kiosk-danger-bg border border-kiosk-danger/20 rounded-lg p-3 mb-4 text-kiosk-danger text-sm">
          {error}
        </div>
      )}

      {/* STEP: Upload */}
      {step === 'upload' && (
        <div className="animate-slide-up">
          <div className="kiosk-card">
            <h2 className="text-xl font-bold mb-1">Upload Document</h2>
            <p className="text-kiosk-text-secondary text-sm mb-6">Select a PDF or Photo to print</p>

            <label
              htmlFor="file-upload"
              className={cn(
                'flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 cursor-pointer transition-colors',
                'border-kiosk-border hover:border-kiosk-accent hover:bg-kiosk-accent/5',
                uploading && 'opacity-50 pointer-events-none'
              )}
            >
              {uploading ? (
                <>
                  <div className="w-10 h-10 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="font-medium">Analyzing document...</p>
                </>
              ) : (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-kiosk-text-muted mb-4">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="font-medium mb-1">Tap to upload PDF or Photo</p>
                  <p className="text-kiosk-text-muted text-sm">or drag and drop</p>
                </>
              )}
              <input
                id="file-upload"
                type="file"
                accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}

      {/* STEP: Settings */}
      {step === 'settings' && printJob && (
        <div className="space-y-4 animate-slide-up">
          {/* File Info */}
          <div className="kiosk-card">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-kiosk-accent/10 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-kiosk-accent">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{printJob.file_name}</p>
                <p className="text-kiosk-text-secondary text-sm">{printJob.total_pages} pages</p>
              </div>
            </div>
          </div>

          {/* Live Print Preview */}
          <div className="kiosk-card flex flex-col items-center justify-center py-6 bg-kiosk-bg">
            <h3 className="font-semibold w-full text-left mb-4 text-sm text-kiosk-text-secondary">Live Preview</h3>
            
            <div 
              className="bg-white shadow-xl flex items-center justify-center transition-all duration-300 relative overflow-hidden"
              style={{
                width: orientation === 'landscape' ? '240px' : '170px',
                height: orientation === 'landscape' ? '170px' : '240px',
                filter: colorMode === 'bw' ? 'grayscale(100%)' : 'none',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                padding: '4px' // Simulate printer margin
              }}
            >
              {printJob.file_name.toLowerCase().endsWith('.pdf') ? (
                printJob.file_name.startsWith('Scanned_Doc_') ? (
                  <img 
                    src={`/api/print/file/${printJob.id}?preview=true`} 
                    className={cn(
                      "w-full h-full transition-all duration-300",
                      sizing === 'fill' ? 'object-cover' : 'object-contain'
                    )}
                    alt="Scan Preview"
                  />
                ) : (
                  <iframe 
                    src={`/api/print/file/${printJob.id}`} 
                    className={cn(
                      "w-full h-full pointer-events-none border-none transition-all duration-300",
                      sizing === 'fill' ? 'object-cover' : 'object-contain'
                    )}
                    title="PDF Preview"
                  />
                )
              ) : (
                <img 
                  src={`/api/print/file/${printJob.id}`} 
                  className={cn(
                    "w-full h-full transition-all duration-300",
                    sizing === 'fill' ? 'object-cover' : 'object-contain'
                  )}
                  alt="Print Preview"
                />
              )}
            </div>
            <p className="text-xs text-kiosk-text-muted mt-4">
              A4 Paper • {colorMode === 'bw' ? 'Black & White' : 'Color'} • {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
            </p>
          </div>

          {/* Print Settings */}
          <div className="kiosk-card">
            <h3 className="font-semibold mb-4">Print Settings</h3>

            {/* Color Mode */}
            <div className="mb-4">
              <label className="text-sm text-kiosk-text-secondary mb-2 block">Color</label>
              <div className="grid grid-cols-2 gap-2">
                {(['bw', 'color'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateSetting('colorMode', mode)}
                    className={cn(
                      'kiosk-btn text-sm',
                      colorMode === mode ? 'kiosk-btn-primary' : 'kiosk-btn-ghost'
                    )}
                  >
                    {mode === 'bw' ? 'Black & White' : 'Color'}
                  </button>
                ))}
              </div>
            </div>

            {/* Duplex */}
            <div className="mb-4">
              <label className="text-sm text-kiosk-text-secondary mb-2 block">Sides</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateSetting('duplex', false)}
                  className={cn('kiosk-btn text-sm', !duplex ? 'kiosk-btn-primary' : 'kiosk-btn-ghost')}
                >
                  Single Side
                </button>
                <button
                  onClick={() => updateSetting('duplex', true)}
                  className={cn('kiosk-btn text-sm', duplex ? 'kiosk-btn-primary' : 'kiosk-btn-ghost')}
                >
                  Duplex
                </button>
              </div>
            </div>


            {/* Orientation */}
            <div className="mb-4">
              <label className="text-sm text-kiosk-text-secondary mb-2 block">Orientation</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateSetting('orientation', 'portrait')}
                  className={cn('kiosk-btn text-sm', orientation === 'portrait' ? 'kiosk-btn-primary' : 'kiosk-btn-ghost')}
                >
                  Vertical (Portrait)
                </button>
                <button
                  onClick={() => updateSetting('orientation', 'landscape')}
                  className={cn('kiosk-btn text-sm', orientation === 'landscape' ? 'kiosk-btn-primary' : 'kiosk-btn-ghost')}
                >
                  Horizontal (Landscape)
                </button>
              </div>
            </div>

            {/* Sizing */}
            <div className="mb-4">
              <label className="text-sm text-kiosk-text-secondary mb-2 block">Scaling / Sizing</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateSetting('sizing', 'fit')}
                  className={cn('kiosk-btn text-sm', sizing === 'fit' ? 'kiosk-btn-primary' : 'kiosk-btn-ghost')}
                >
                  Fit to Page
                </button>
                <button
                  onClick={() => updateSetting('sizing', 'fill')}
                  className={cn('kiosk-btn text-sm', sizing === 'fill' ? 'kiosk-btn-primary' : 'kiosk-btn-ghost')}
                >
                  Fill Page
                </button>
              </div>
            </div>

            {/* Copies */}
            <div>
              <label className="text-sm text-kiosk-text-secondary mb-2 block">Copies</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSetting('copies', Math.max(1, copies - 1))}
                  className="kiosk-btn kiosk-btn-ghost w-12 h-12 p-0"
                  disabled={copies <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(99, Number(e.target.value))))}
                  className="kiosk-input w-20 text-center text-lg font-bold"
                  min={1}
                  max={99}
                />
                <button
                  onClick={() => updateSetting('copies', Math.min(99, copies + 1))}
                  className="kiosk-btn kiosk-btn-ghost w-12 h-12 p-0"
                  disabled={copies >= 99}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Cost Summary */}
          <div className="kiosk-card border-kiosk-accent/30">
            <h3 className="font-semibold mb-3">Cost Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">File</span><span>{printJob.file_name}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Pages</span><span>{printJob.total_pages}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Copies</span><span>{copies}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Orientation</span><span>{orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Sizing</span><span>{sizing === 'fit' ? 'Fit to Page' : 'Fill Page'}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Color</span><span>{colorMode === 'bw' ? 'Black & White' : 'Color'}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Sides</span><span>{duplex ? 'Duplex' : 'Single Side'}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Sheets</span><span>{printJob.estimated_sheets}</span></div>
              <div className="h-px bg-kiosk-border my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total Cost</span>
                <span className="text-kiosk-accent">{formatCurrency(printJob.estimated_cost)}</span>
              </div>
            </div>

            <button
              onClick={() => setStep('preview')}
              className="kiosk-btn kiosk-btn-primary kiosk-btn-lg w-full mt-4 glow-accent"
              id="btn-preview-pay"
            >
              PREVIEW & PAY — {formatCurrency(printJob.estimated_cost)}
            </button>
          </div>
        </div>
      )}

      {/* STEP: Preview */}
      {step === 'preview' && printJob && (
        <div className="space-y-4 animate-slide-up">
          <div className="kiosk-card">
            <h2 className="text-xl font-bold mb-1">Print Preview</h2>
            <p className="text-kiosk-text-secondary text-sm mb-4">Exactly how your document will look on paper</p>

            <div className="bg-slate-100 dark:bg-slate-900/50 rounded-xl p-6 flex items-center justify-center min-h-[350px] overflow-hidden">
              {/* Virtual Sheet */}
              {/* Virtual Sheet */}
              <div
                className={cn(
                  "bg-white text-black shadow-lg border border-slate-200 transition-all duration-300 flex items-center justify-center overflow-hidden relative",
                  // A4 aspect ratio is 1 : 1.414. We use a base width of 210px for accurate scaling.
                  orientation === 'portrait' ? 'w-[210px] h-[297px]' : 'w-[297px] h-[210px]',
                  // Apply a small 4px padding to simulate standard printer non-printable margins
                  "p-1"
                )}
                style={{ filter: colorMode === 'bw' ? 'grayscale(100%)' : 'none' }}
              >
                {printJob.file_name.toLowerCase().endsWith('.pdf') ? (
                  printJob.file_name.startsWith('Scanned_Doc_') ? (
                    <img 
                      src={`/api/print/file/${printJob.id}?preview=true`} 
                      className={cn(
                        "w-full h-full transition-all duration-300",
                        sizing === 'fill' ? 'object-cover' : 'object-contain'
                      )}
                      alt="Scan Preview"
                    />
                  ) : (
                    <iframe 
                      src={`/api/print/file/${printJob.id}`} 
                      className={cn(
                        "w-full h-full pointer-events-none border-none transition-all duration-300",
                        sizing === 'fill' ? 'object-cover' : 'object-contain'
                      )}
                      title="PDF Preview"
                    />
                  )
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/print/file/${printJob.id}`}
                    alt="Print Preview"
                    className={cn(
                      "w-full h-full transition-all duration-300",
                      sizing === 'fill' ? 'object-cover' : 'object-contain'
                    )}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="kiosk-card">
            <h3 className="font-semibold mb-3">Settings Confirmation</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Orientation</span><span className="font-bold">{orientation === 'portrait' ? 'Vertical (Portrait)' : 'Horizontal (Landscape)'}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Sizing</span><span className="font-bold">{sizing === 'fit' ? 'Fit to Page' : 'Fill Page'}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Color Mode</span><span>{colorMode === 'bw' ? 'Black & White' : 'Color'}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Sides</span><span>{duplex ? 'Duplex' : 'Single Side'}</span></div>
              <div className="flex justify-between"><span className="text-kiosk-text-secondary">Copies</span><span>{copies}</span></div>
              <div className="h-px bg-kiosk-border my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total Cost</span>
                <span className="text-kiosk-accent">{formatCurrency(printJob.estimated_cost)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-6">
              <button
                onClick={handlePayment}
                disabled={isInitiatingPayment}
                className="kiosk-btn kiosk-btn-primary kiosk-btn-lg w-full glow-accent flex items-center justify-center gap-2"
              >
                {isInitiatingPayment ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Initiating Payment...</span>
                  </>
                ) : (
                  <span>PROCEED TO PAY — {formatCurrency(printJob.estimated_cost)}</span>
                )}
              </button>
              <button
                onClick={() => setStep('settings')}
                disabled={isInitiatingPayment}
                className="kiosk-btn kiosk-btn-ghost w-full"
              >
                Back to Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mock Payment Modal Overlay */}
      {showMockPayment && mockPaymentData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-kiosk-surface p-6 rounded-xl max-w-md w-full shadow-2xl animate-scale-in relative border border-kiosk-border">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-kiosk-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-kiosk-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-kiosk-text mb-1">Simulated Test Payment</h3>
              <p className="text-sm text-kiosk-text-muted mb-6">
                Razorpay keys are in test mode. You can simulate a successful payment here to test the full print kiosk flow.
              </p>
              <div className="bg-kiosk-bg p-4 rounded-lg mb-6 text-left border border-kiosk-border">
                <div className="flex justify-between text-sm mb-1"><span className="text-kiosk-text-muted">Order ID</span><span className="font-mono text-xs font-bold">{mockPaymentData.orderId}</span></div>
                <div className="flex justify-between text-sm"><span className="text-kiosk-text-muted">Amount</span><span className="font-bold text-kiosk-accent">{formatCurrency(mockPaymentData.amount / 100)}</span></div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowMockPayment(false)} 
                  disabled={isInitiatingPayment}
                  className="kiosk-btn kiosk-btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmMockPayment} 
                  disabled={isInitiatingPayment}
                  className="kiosk-btn kiosk-btn-success flex-1 shadow-lg flex items-center justify-center gap-2"
                >
                  {isInitiatingPayment ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Simulate Success</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* STEP: Waiting for TFT */}
      {step === 'waiting-tft' && (
        <div className="animate-scale-in text-center kiosk-card">
          <div className="w-20 h-20 bg-kiosk-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-kiosk-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Payment Successful!</h2>
          <p className="text-kiosk-text-secondary mb-6 text-lg">
            Please look at the Kiosk screen to confirm and start printing.
          </p>
          <div className="flex justify-center items-center gap-2 mt-4 text-kiosk-accent">
            <div className="w-3 h-3 rounded-full bg-kiosk-accent animate-ping" />
            <span className="font-semibold text-sm tracking-widest uppercase">Waiting for Kiosk</span>
          </div>
        </div>
      )}

      {/* STEP: Printing */}
      {step === 'printing' && printJob && (
        <div className="animate-slide-up">
          <div className="kiosk-card text-center">
            <div className="w-16 h-16 rounded-full bg-kiosk-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-kiosk-accent">
                <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
              </svg>
            </div>

            <h2 className="text-xl font-bold mb-1">Printing...</h2>
            <p className="text-kiosk-text-secondary mb-2">{printJob.file_name}</p>

            <p className="text-3xl font-bold text-kiosk-accent mb-4">
              Page {printJob.current_page} / {printJob.estimated_sheets}
            </p>

            <div className="kiosk-progress mb-2">
              <div
                className="kiosk-progress-bar"
                style={{ width: `${printJob.estimated_sheets > 0 ? (printJob.current_page / printJob.estimated_sheets) * 100 : 0}%` }}
              />
            </div>
            <p className="text-sm text-kiosk-text-muted">
              {printJob.estimated_sheets > 0 ? Math.round((printJob.current_page / printJob.estimated_sheets) * 100) : 0}% complete
            </p>
          </div>
        </div>
      )}

      {/* STEP: Complete */}
      {step === 'complete' && (
        <div className="animate-slide-up">
          <div className="kiosk-card text-center py-12">
            <div className="w-20 h-20 rounded-full bg-kiosk-success/10 flex items-center justify-center mx-auto mb-6">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-kiosk-success">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-kiosk-success mb-2">Print Complete</h2>
            <p className="text-kiosk-text-secondary text-lg mb-2">Collect Your Documents</p>
            <p className="text-kiosk-text-muted">Thank you for using Print Kiosk</p>

            <a href="/" className="kiosk-btn kiosk-btn-ghost mt-8 inline-flex">New Session</a>
          </div>
        </div>
      )}

      {/* STEP: Scan Select */}
      {step === 'scan-select' && (
        <div className="animate-slide-up">
          <div className="kiosk-card">
            <h2 className="text-xl font-bold mb-1">Select Scan Type</h2>
            <p className="text-kiosk-text-secondary text-sm mb-6">Choose a scanning mode</p>

            <div className="space-y-3">
              {([
                { mode: 'single' as ScanMode, label: 'Single Page', desc: 'Scan one page', icon: '📄' },
                { mode: 'multi' as ScanMode, label: 'Multi Page', desc: 'Scan multiple pages into one PDF', icon: '📑' },
                { mode: 'adf' as ScanMode, label: 'ADF Scan', desc: 'Automatic Document Feeder', icon: '🗂️' },
                { mode: 'id_card' as ScanMode, label: 'ID Card Scan', desc: 'Front & back on one page', icon: '🪪' },
                { mode: 'book' as ScanMode, label: 'Book Scan', desc: 'Scan book pages', icon: '📖' },
              ]).map(({ mode, label, desc, icon }) => (
                <button
                  key={mode}
                  onClick={() => handleStartScan(mode)}
                  className="kiosk-btn kiosk-btn-ghost w-full justify-start text-left gap-4 p-4 h-auto"
                  id={`btn-scan-${mode}`}
                >
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-kiosk-text-muted text-xs">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP: Scanning */}
      {step === 'scanning' && scanJob && (
        <div className="animate-slide-up">
          <div className="kiosk-card text-center">
            <div className="w-16 h-16 rounded-full bg-kiosk-accent/10 flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold mb-2">Scanning...</h2>
            <p className="text-kiosk-text-secondary mb-1">Mode: {scanJob.scan_mode.replace('_', ' ')}</p>
            <p className="text-2xl font-bold text-kiosk-accent mb-6">{scanJob.total_pages} page(s) scanned</p>

            {['multi', 'id_card', 'book'].includes(scanJob.scan_mode) && (
              <div className="flex gap-3 justify-center">
                <button onClick={handleAddPage} className="kiosk-btn kiosk-btn-primary">
                  + Add Next Page
                </button>
                <button onClick={handleFinishScan} className="kiosk-btn kiosk-btn-success">
                  Finish Document
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP: Scan Complete */}
      {step === 'scan-complete' && scanJob && (
        <div className="animate-slide-up">
          <div className="kiosk-card text-center py-12">
            <div className="w-20 h-20 rounded-full bg-kiosk-success/10 flex items-center justify-center mx-auto mb-6">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-kiosk-success">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-kiosk-success mb-2">Scan Complete</h2>
            <p className="text-kiosk-text-secondary mb-6">{scanJob.total_pages} page(s) scanned</p>

            <a
              href={`/api/scan/download/${scanJob.id}`}
              className="kiosk-btn kiosk-btn-primary kiosk-btn-lg glow-accent inline-flex"
              download
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </a>

            <div className="mt-8">
              <a href="/" className="kiosk-btn kiosk-btn-ghost inline-flex">New Session</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
