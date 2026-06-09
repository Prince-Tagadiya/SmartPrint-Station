'use client';

import { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function AdminTamperModal() {
  const [isTampered, setIsTampered] = useState(false);
  const [tamperData, setTamperData] = useState<any>(null);
  const { on, isConnected } = useWebSocket('hardware');
  const [resolving, setResolving] = useState(false);
  
  // Audio context refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startSiren = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(2500, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();

    // Toggle gain to simulate a loud BEEP BEEP alarm
    let beeping = true;
    intervalRef.current = setInterval(() => {
      beeping = !beeping;
      if (gainRef.current) {
        gainRef.current.gain.setValueAtTime(beeping ? 0.3 : 0, ctx.currentTime);
      }
    }, 200);

    oscRef.current = osc;
    gainRef.current = gain;
  };

  const stopSiren = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch (e) {}
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
    }
  };

  useEffect(() => {
    // Listen for tamper events from the hardware
    const removeTamperListener = on('tamper', (msg) => {
      setIsTampered(true);
      setTamperData(msg.data);
      startSiren();
    });

    const removeClearListener = on('tamper_clear', () => {
      setIsTampered(false);
      setTamperData(null);
      stopSiren();
    });

    return () => {
      removeTamperListener();
      removeClearListener();
      stopSiren();
    };
  }, [on]);

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await fetch('/api/hardware/tamper', { method: 'POST' });
      if (res.ok) {
        setIsTampered(false);
        stopSiren();
      }
    } catch (err) {
      console.error('Failed to resolve tamper', err);
    }
    setResolving(false);
  };

  if (!isTampered) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-red-950/80 backdrop-blur-md p-4 animate-fade-in pointer-events-auto">
      {/* Flashing background effect */}
      <div className="absolute inset-0 animate-pulse bg-red-600/20 pointer-events-none" style={{ animationDuration: '0.8s' }}></div>
      
      <div className="bg-kiosk-surface text-kiosk-text max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden animate-slide-up border-4 border-red-600 relative z-10">
        <div className="bg-red-600 p-8 flex flex-col items-center justify-center text-white">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-4 animate-bounce">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <h2 className="text-4xl font-bold uppercase tracking-widest text-center">TAMPER ALERT</h2>
          <p className="mt-2 text-red-100 font-medium text-lg">Hardware manipulation detected!</p>
        </div>
        
        <div className="p-8 text-center bg-gray-900 text-white">
          <p className="text-xl font-medium mb-4">The Print Kiosk has detected a physical disturbance and is currently locked down.</p>
          
          {tamperData && (
            <div className="bg-black/50 p-4 rounded-lg mb-8 font-mono text-sm text-red-400 border border-red-900 inline-block text-left">
              <p>Deviation: {tamperData.dev?.toFixed(2)}G</p>
              <p>X: {tamperData.ax?.toFixed(2)} | Y: {tamperData.ay?.toFixed(2)} | Z: {tamperData.az?.toFixed(2)}</p>
            </div>
          )}

          <p className="text-gray-400 mb-8 text-sm">Please physically inspect the kiosk before resolving this alert. The kiosk will remain unusable until resolved.</p>
          
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="w-full bg-red-600 hover:bg-red-500 text-white text-2xl font-bold py-6 px-8 rounded-xl shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {resolving ? (
              'RESOLVING...'
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 22v-4M12 6V2M4 12H2M22 12h-2M5.636 5.636l2.828 2.828M15.536 15.536l2.828 2.828M5.636 18.364l2.828-2.828M15.536 8.464l2.828-2.828" />
                </svg>
                RESOLVE TAMPER ALERT
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
