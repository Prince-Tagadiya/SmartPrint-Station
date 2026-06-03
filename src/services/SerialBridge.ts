import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { EventService } from './EventService';
import { SessionService } from './SessionService';
import { PrinterService } from './PrinterService';
import { PaymentService } from './PaymentService';
import { ScannerService } from './ScannerService';
import { calculatePrintCost } from '@/lib/pricing';
import os from 'os';

import { ScanMode } from '@/types';

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
const LOCAL_IP = getLocalIp();

class SerialBridgeService {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private isConnected: boolean = false;
  private activePortPath: string | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private wssBroadcaster: ((message: string) => void) | null = null;
  private manualOverride: boolean = false;
  private connectionTimeout: NodeJS.Timeout | null = null;

  // State tracking — only set these via setActiveSession / clearActiveSession
  private activeSessionId: string | null = null;
  private activeSessionType: 'print' | 'scan' | null = null;
  private currentScreenId: string | null = null;
  private currentScreenData: any = {};
  private currentFlow: 'none' | 'scan_waiting_open' | 'scan_waiting_close' | 'scan_waiting_open_id_front' | 'scan_waiting_close_id_front' | 'scan_waiting_open_id_back' | 'scan_waiting_close_id_back' | 'scan_multi_prompt' | 'scan_completed' | 'scanning_in_progress' = 'none';
  private isSyncing: boolean = false; // Guard against re-entrant syncState calls
  private paymentOkTimeoutStarted: boolean = false;
  private printCompletedTimeoutStarted: boolean = false;

  constructor() {
    this.init();
  }

  public setBroadcaster(broadcaster: (message: string) => void) {
    this.wssBroadcaster = broadcaster;
  }

  private async init() {
    await this.connect();
    this.reconnectInterval = setInterval(() => {
      if (!this.isConnected && !this.manualOverride) {
        this.connect();
      }
    }, 5000);
  }

  public async getAvailablePorts() {
    try {
      const ports = await SerialPort.list();
      
      const uniquePaths = new Set<string>();
      const resultPorts: any[] = [];
      
      ports.forEach(p => {
        let path = p.path;
        
        // Always rewrite tty to cu on macOS
        if (path.startsWith('/dev/tty.')) {
          path = path.replace('/dev/tty.', '/dev/cu.');
        }
        
        // Prevent duplicates
        if (uniquePaths.has(path)) {
          return;
        }
        
        uniquePaths.add(path);
        
        resultPorts.push({
          path: path,
          manufacturer: p.manufacturer || 'Unknown',
          pnpId: p.pnpId,
          vendorId: p.vendorId,
          productId: p.productId,
          serialNumber: p.serialNumber,
        });
      });
      
      return resultPorts;
    } catch (err) {
      console.error('[SerialBridge] Error fetching ports: ', err);
      return [];
    }
  }

  public async disconnect(isManual: boolean = true): Promise<boolean> {
    if (isManual) this.manualOverride = true;

    if (this.port && this.isConnected) {
      return new Promise<boolean>((resolve) => {
        this.isConnected = false;
        this.activePortPath = null;
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
        
        // Remove listeners to prevent memory leaks on reconnect
        this.port!.removeAllListeners();
        if (this.parser) this.parser.removeAllListeners();

        this.port!.close((err) => {
          this.port = null;
          this.parser = null;
          if (err) {
            console.error('[SerialBridge] Error closing port:', err.message);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    }
    return true;
  }

  public async connect(targetPath?: string) {
    try {
      if (this.isConnected && this.port) {
        if (targetPath && targetPath === this.activePortPath) return true;
        await this.disconnect();
      }

      this.manualOverride = !!targetPath;
      let pathToConnect = targetPath;

      if (!pathToConnect) {
        const ports = await SerialPort.list();
        
        // Enhanced auto-detection for common USB-to-Serial chips
        const isEsp32 = (p: any) => {
          const vId = p.vendorId?.toLowerCase();
          const pId = p.productId?.toLowerCase();
          const mfg = p.manufacturer?.toLowerCase() || '';
          
          // CP210x, CH340, FTDI, generic CDC
          if (vId === '10c4' && pId === 'ea60') return true; // CP2102
          if (vId === '1a86' && pId === '7523') return true; // CH340
          if (vId === '0403' && pId === '6001') return true; // FT232
          if (mfg.includes('silicon labs') || mfg.includes('qinheng') || mfg.includes('wch')) return true;
          
          return (
            p.path.includes('cu.usbserial') ||
            p.path.includes('ttyUSB') ||
            p.path.includes('ttyACM')
          );
        };
        
        // Find best match.
        const espPorts = ports.filter(isEsp32);
        
        if (espPorts.length > 0) {
          let bestPort = espPorts.find(p => p.path.startsWith('/dev/cu.'));
          if (!bestPort) bestPort = espPorts[0];
          
          pathToConnect = bestPort.path;
          
          // Force rewrite to cu if auto-detected a tty port
          if (pathToConnect.startsWith('/dev/tty.')) {
            pathToConnect = pathToConnect.replace('/dev/tty.', '/dev/cu.');
          }
        }
      }

      if (!pathToConnect) return false;

      // Keep the selected path as is. If the user selects /dev/cu.*, we use it natively.

      console.log(`[SerialBridge] Connecting to ESP32 on port ${pathToConnect}...`);

      this.port = new SerialPort({
        path: pathToConnect,
        baudRate: 115200,
        autoOpen: false,
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      this.port!.on('close', () => {
        console.log('[SerialBridge] Port closed. Will try to reconnect...');
        this.disconnect(false);
      });

      this.port!.on('error', (err) => {
        console.error('[SerialBridge] Port error: ', err.message);
        this.disconnect(false);
      });

      this.parser!.on('data', (data: string) => {
        this.handleIncomingData(data);
      });

      return new Promise<boolean>((resolve) => {
        this.port!.open((err) => {
          if (err) {
            console.error('[SerialBridge] Error opening port: ', err.message);
            resolve(false);
            return;
          }
          
          this.port!.set({ dtr: false, rts: false }, (err) => {
            if (err) console.warn('[SerialBridge] Failed to clear DTR/RTS:', err.message);
            
            this.isConnected = true;
            this.activePortPath = pathToConnect;
            console.log('[SerialBridge] Connected to ESP32 successfully. Waiting 4s before syncing...');

            // Wait 4s for ESP32 to boot up before sending first heartbeats
            if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
            this.connectionTimeout = setTimeout(() => {
              if (!this.isConnected) return; // Prevent execution if disconnected during timeout
              
              // Heartbeat to server to keep ESP32 aware server is alive
              if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
              this.heartbeatInterval = setInterval(() => {
                if (this.isConnected) this.sendCommand('heartbeat');
              }, 2000);

              // Status + State sync every 500ms for real-time updates
              if (this.syncInterval) clearInterval(this.syncInterval);
              this.syncInterval = setInterval(() => {
                this.sendStatusToESP32();
                this.syncState();
              }, 500);
            }, 4000);

            resolve(true);
          });
        });
      });
    } catch (err) {
      console.error('[SerialBridge] Error in connect sequence: ', err);
    }
  }

  // Send printer/scanner online status to ESP32
  private sendStatusToESP32() {
    try {
      const printerStatus = PrinterService.getStatus();
      const scannerStatus = ScannerService.getStatus();
      this.sendCommand('status', {
        printer: printerStatus.is_online === 1,
        scanner: scannerStatus.is_online === 1,
      });
    } catch (_) {}
  }

  // ─── Core State Machine ───────────────────────────────
  // Only ever reads from DB — never writes. All writes are in touch handlers.
  private syncState() {
    if (!this.isConnected || !this.port) return;
    if (this.isSyncing) return; // prevent re-entrant calls
    this.isSyncing = true;

    try {
      // If we are currently performing a one-touch scan, do NOT sync print session state yet
      // to avoid interrupting the scanning / preparing_pdf / collect reminder screens!
      if (this.currentFlow === 'scanning_in_progress') {
        return;
      }

      // Check if printer has an error (like media needed error / out of paper) globally
      const printerStatus = PrinterService.getStatus();
      if (printerStatus.current_error) {
        this.changeScreen('out_of_paper', { error: printerStatus.current_error });
        return;
      }

      // If we have an active session tracked locally, verify it's still alive
      if (this.activeSessionId) {
        const session = SessionService.getById(this.activeSessionId);

        // Session gone / expired / cancelled → go home
        if (!session || !['waiting', 'active'].includes(session.status)) {
          console.log('[SerialBridge] Session ended, returning to home');
          this.clearActiveSession();
          return;
        }

        // Sync screen based on real DB state, but respect if we switched it
        const effectiveType = this.activeSessionType || session.type;
        if (effectiveType === 'print') {
          this.syncPrintSession(session.id, session.session_code);
        }
      }
      // If no active session tracked, stay on home (don't auto-pick random sessions)
    } catch (err) {
      console.error('[SerialBridge] Error syncing state:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  private syncPrintSession(sessionId: string, sessionCode: string) {
    const job = PrinterService.getJobBySession(sessionId);

    if (!job) {
      // Still waiting for file upload — show QR session screen
      const url = `http://${LOCAL_IP}:3000/session/${sessionCode}`;
      this.changeScreen('print_session', { code: sessionCode, url });
      return;
    }

    const printerStatus = PrinterService.getStatus();
    if (job.print_status === 'failed' || printerStatus.current_error) {
      this.changeScreen('out_of_paper', { error: printerStatus.current_error || 'Out of paper' });
      return;
    }

    const payment = PaymentService.getPaymentByJob(job.id);

    if (!payment) {
      // If this print job came from a scan, the user never scanned a QR code yet.
      // We must show the QR code screen so they can open the session on their phone to configure/pay.
      if (this.currentFlow === 'scan_completed') {
        const url = `http://${LOCAL_IP}:3000/session/${sessionCode}`;
        this.changeScreen('print_session', { code: sessionCode, url });
        return;
      }

      // File received, show live configuration
      this.changeScreen('file_received', {
        filename: job.file_name,
        pages: job.total_pages,
        color: job.color_mode === 'bw' ? 'B&W' : 'Color',
        duplex: job.duplex ? 'Yes' : 'No',
        orientation: job.orientation === 'landscape' ? 'Landscape' : 'Portrait',
        sizing: job.sizing === 'fill' ? 'fill' : 'fit',
        copies: job.copies,
        cost: job.estimated_cost,
      });
      return;
    }

    if (payment.status === 'pending') {
      this.changeScreen('payment_wait', { amount: job.estimated_cost });
      return;
    }

    if (payment.status === 'failed') {
      this.changeScreen('file_received', {
        filename: job.file_name,
        pages: job.total_pages,
        color: job.color_mode === 'bw' ? 'B&W' : 'Color',
        duplex: job.duplex ? 'Yes' : 'No',
        orientation: job.orientation === 'landscape' ? 'Landscape' : 'Portrait',
        sizing: job.sizing === 'fill' ? 'fill' : 'fit',
        copies: job.copies,
        cost: job.estimated_cost,
      });
      return;
    }

    if (payment.status === 'success') {
      if (job.print_status === 'queued') {
        // Show success screen briefly and auto-start printing
        this.changeScreen('payment_ok', { amount: payment.amount });
        if (!this.paymentOkTimeoutStarted) {
          this.paymentOkTimeoutStarted = true;
          console.log('[SerialBridge] Payment success, waiting 3 seconds before auto-starting print job...');
          setTimeout(() => {
            PrinterService.startPrint(job.id).catch((e) => {
              console.error('[SerialBridge] Print start error:', e);
              // If startPrint throws an error (e.g. tray open, out of paper), mark job failed or update error
              PrinterService.updateStatus({ current_error: e.message || 'media needed error' });
            });
          }, 3000);
        }
      } else if (job.print_status === 'printing') {
        const total = job.estimated_sheets || 1;
        const progress = Math.round((job.current_page / total) * 100);
        // Always send progress update while printing (even if same screen)
        this.currentScreenId = 'printing'; // ensure we hold this screen
        this.setScreen('printing', { pages: job.current_page, total, progress });
      } else if (job.print_status === 'completed') {
        this.changeScreen('complete');
        if (!this.printCompletedTimeoutStarted) {
          this.printCompletedTimeoutStarted = true;
          // Mark session complete
          SessionService.updateStatus(sessionId, 'completed');
          // Go home after 5 seconds
          setTimeout(() => {
            this.clearActiveSession();
          }, 5000);
        }
      } else if (job.print_status === 'cancelled') {
        this.clearActiveSession();
      }
    }
  }

  // Set a new active session — clears old state
  private setActiveSession(id: string, type: 'print' | 'scan') {
    this.activeSessionId = id;
    this.activeSessionType = type;
    this.currentScreenId = null; // force re-render of correct screen
    this.currentFlow = 'none';
    console.log(`[SerialBridge] Active session set: ${id} (${type})`);
  }

  // Clear session, go to home
  private clearActiveSession() {
    this.activeSessionId = null;
    this.activeSessionType = null;
    this.currentFlow = 'none';
    this.paymentOkTimeoutStarted = false;
    this.printCompletedTimeoutStarted = false;
    this.changeScreen('home');
  }

  private changeScreen(screenId: string, screenData: any = {}) {
    const dataChanged = JSON.stringify(this.currentScreenData) !== JSON.stringify(screenData);
    if (this.currentScreenId !== screenId || dataChanged) {
      if (this.currentScreenId !== screenId) {
        console.log(`[SerialBridge] Screen: ${this.currentScreenId} → ${screenId}`);
      }
      this.currentScreenId = screenId;
      this.currentScreenData = screenData;
      this.setScreen(screenId, screenData);
    }
  }

  private handleIncomingData(data: string) {
    try {
      const json = JSON.parse(data);
      const ev = json.ev;
      if (!ev) return;

      // Broadcast to WebSocket clients (Admin Dashboard)
      if (this.wssBroadcaster) {
        this.wssBroadcaster(JSON.stringify({
          channel: 'hardware',
          event: ev,
          data: json,
          timestamp: new Date().toISOString(),
        }));
      }

      switch (ev) {
        case 'tamper':
          EventService.logHardwareEvent('mpu6050', 'tamper_detected', json);
          break;

        case 'lid':
          if (!this.activeSessionId || this.activeSessionType !== 'scan') break;
          const scanJob = ScannerService.getJobBySession(this.activeSessionId);
          if (!scanJob || scanJob.status !== 'pending') break;

          if (this.currentFlow === 'scan_waiting_open' && json.state === 'open') {
            this.currentFlow = 'scan_waiting_close';
            this.syncState();
          } else if (this.currentFlow === 'scan_waiting_close' && json.state === 'closed') {
            this.currentFlow = 'none';
            // Trigger actual scan
            ScannerService.scanPage(scanJob.id, () => {
              if (scanJob.scan_mode === 'multi') {
                this.currentFlow = 'scan_multi_prompt';
                ScannerService.updateJob(scanJob.id, { status: 'pending' }); // Stay pending
                this.syncState();
              } else {
                ScannerService.finishScan(scanJob.id);
              }
            });
          } else if (this.currentFlow === 'scan_waiting_open_id_front' && json.state === 'open') {
            this.currentFlow = 'scan_waiting_close_id_front';
            this.syncState();
          } else if (this.currentFlow === 'scan_waiting_close_id_front' && json.state === 'closed') {
            this.currentFlow = 'none';
            // Trigger scan front
            ScannerService.scanPage(scanJob.id, () => {
              // Ask for back
              this.currentFlow = 'scan_waiting_open_id_back';
              ScannerService.updateJob(scanJob.id, { status: 'pending' }); // Stay pending
              this.syncState();
            });
          } else if (this.currentFlow === 'scan_waiting_open_id_back' && json.state === 'open') {
            this.currentFlow = 'scan_waiting_close_id_back';
            this.syncState();
          } else if (this.currentFlow === 'scan_waiting_close_id_back' && json.state === 'closed') {
            this.currentFlow = 'none';
            // Trigger scan back and finish
            ScannerService.scanPage(scanJob.id, () => {
              ScannerService.finishScan(scanJob.id);
            });
          }
          break;

        case 'touch':
          console.log(`[SerialBridge] Touch: screen='${json.screen}' btn='${json.btn}'`);
          this.handleTouch(json.screen, json.btn);
          break;

        case 'raw_touch':
          // Debug only — do nothing
          break;

        case 'boot':
          // ESP32 rebooted — reset our screen tracking so it re-syncs fully
          this.currentScreenId = null;
          break;

        case 'cal_loaded':
        case 'cal_saved':
        case 'cal_closed':
        case 'cal_open':
        case 'cal_done':
          break;

        case 'button':
          if (json.btn === 'home') {
            console.log('[SerialBridge] Physical Home button pressed. Clearing active session and errors.');
            PrinterService.updateStatus({ current_error: null });
            if (this.activeSessionId) {
              SessionService.updateStatus(this.activeSessionId, 'cancelled');
            }
            this.clearActiveSession();
          }
          break;

        case 'heartbeat':
        case 'debug':
          break;

        default:
          break;
      }
    } catch (err) {
      // Not JSON — ignore silently
    }
  }

  private handleTouch(screen: string, btn: string) {
    switch (screen) {
      case 'home': {
        if (btn === 'print') {
          // Create session — this also expires any old active sessions
          const session = SessionService.create('print');
          this.setActiveSession(session.id, 'print');
          // Immediately sync to show correct screen
          this.syncState();
        } else if (btn === 'scan_start') {
          // The ESP32 has physically closed the lid — trigger the actual scan on the laptop.
          // The TFT already shows SCR_SCANNING. We just drive the backend.
          
          (async () => {
            try {
              // 1. Create a session
              const session = SessionService.create('print');

              // 2. Immediately set active session and set currentFlow to 'scanning_in_progress'
              // so syncState() does NOT override the screen while the physical scan is taking place!
              this.setActiveSession(session.id, 'print');
              this.currentFlow = 'scanning_in_progress';
              this.changeScreen('scanning');

              // 3. Perform physical scan (eSCL) + notify TFT when PDF prep starts
              const scanResult = await ScannerService.performOneTouchScan(session.id, () => {
                // The eSCL scan is done — now generating PDF
                this.changeScreen('preparing_pdf');
              });

              // 4. Create print job with scanned file
              let existingJob = PrinterService.getJobBySession(session.id);
              if (!existingJob) {
                PrinterService.createJob({
                  sessionId: session.id,
                  fileName: `Scanned_Doc_${Date.now()}.pdf`,
                  filePath: scanResult.path,
                  fileSize: scanResult.size,
                  totalPages: scanResult.pages,
                  colorMode: 'color',
                  duplex: 0,
                  copies: 1,
                  pageRange: 'all',
                  paperSize: 'A4',
                  printQuality: 'normal',
                  estimatedSheets: scanResult.pages,
                  estimatedCost: scanResult.pages * 10,
                  orientation: 'portrait'
                });
              }

              // 5. Send collect-doc reminder FIRST (before QR screen)
              // The ESP32 will display the collect document reminder until the user opens the lid >10 deg and closes it back.
              this.sendCommand('scan_reminder', true);

            } catch (err) {
              console.error('[SerialBridge] One-touch scan failed:', err);
              this.changeScreen('home');
              this.clearActiveSession();
            }
          })();
        } else if (btn === 'scan_collect_done') {
          console.log('[SerialBridge] Scan collect done! Showing QR screen.');
          this.currentFlow = 'scan_completed';
          this.syncState();
        }
        break;
      }
      case 'file_received': {
        if (!this.activeSessionId) break;
        const job = PrinterService.getJobBySession(this.activeSessionId);
        if (!job) break;

        let changed = false;
        if (btn === 'color_bw' && job.color_mode !== 'bw') {
          job.color_mode = 'bw'; changed = true;
        } else if (btn === 'color_color' && job.color_mode !== 'color') {
          job.color_mode = 'color'; changed = true;
        } else if (btn === 'duplex_no' && job.duplex !== 0) {
          job.duplex = 0; changed = true;
        } else if (btn === 'duplex_yes' && job.duplex !== 1) {
          job.duplex = 1; changed = true;
        } else if (btn === 'copies_down' && job.copies > 1) {
          job.copies--; changed = true;
        } else if (btn === 'copies_up') {
          job.copies++; changed = true;
        } else if (btn === 'orientation_portrait' && job.orientation !== 'portrait') {
          job.orientation = 'portrait'; changed = true;
        } else if (btn === 'orientation_landscape' && job.orientation !== 'landscape') {
          job.orientation = 'landscape'; changed = true;
        } else if (btn === 'sizing_fit' && job.sizing !== 'fit') {
          job.sizing = 'fit'; changed = true;
        } else if (btn === 'sizing_fill' && job.sizing !== 'fill') {
          job.sizing = 'fill'; changed = true;
        }

        if (changed) {
          const costInfo = calculatePrintCost({
            totalPages: job.total_pages,
            colorMode: job.color_mode as 'bw' | 'color',
            duplex: job.duplex === 1,
            copies: job.copies,
          });
          PrinterService.updateJobSettings(job.id, {
            color_mode: job.color_mode,
            duplex: job.duplex,
            copies: job.copies,
            orientation: job.orientation,
            estimated_sheets: costInfo.estimatedSheets,
            estimated_cost: costInfo.estimatedCost,
          });
          
          // Instantly sync the new state to the hardware display
          this.syncState();
        }
        break;
      }

      case 'payment_ok': {
        if (btn === 'print' && this.activeSessionId) {
          const job = PrinterService.getJobBySession(this.activeSessionId);
          if (job && job.print_status === 'queued') {
            console.log('[SerialBridge] Physical PRINT pressed, starting print job...');
            PrinterService.startPrint(job.id).catch((e) => {
              console.error('[SerialBridge] Print start error:', e);
            });
            this.currentScreenId = null; // force sync
          }
        } else if (btn === 'cancel' && this.activeSessionId) {
          SessionService.updateStatus(this.activeSessionId, 'cancelled');
          this.clearActiveSession();
        }
        break;
      }

      default:
        break;
    }
  }

  public sendCommand(cmd: string, data: any = {}) {
    if (!this.isConnected || !this.port) return false;
    const payload = JSON.stringify({ cmd, data }) + '\n';
    this.port.write(payload, (err) => {
      if (err) {
        console.error('[SerialBridge] Write error:', err.message);
        this.disconnect(false);
      }
    });
    return true;
  }

  public setScreen(screenId: string, screenData: any = {}) {
    return this.sendCommand('screen', { id: screenId, ...screenData });
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      activePort: this.activePortPath,
      manualOverride: this.manualOverride,
    };
  }
}

const globalForSerial = globalThis as unknown as {
  serialBridge: SerialBridgeService | undefined;
};

export const serialBridge = globalForSerial.serialBridge ?? new SerialBridgeService();

if (process.env.NODE_ENV !== 'production') {
  globalForSerial.serialBridge = serialBridge;
}
