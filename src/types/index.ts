// ============================================================
// Print Kiosk — Type Definitions
// ============================================================

// --- Session Types ---
export type SessionType = 'print' | 'scan';
export type SessionStatus = 'waiting' | 'active' | 'completed' | 'expired' | 'cancelled';

export interface Session {
  id: string;
  session_code: string;
  type: SessionType;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

// --- Print Job Types ---
export type ColorMode = 'bw' | 'color';
export type PrintQuality = 'draft' | 'normal' | 'high';
export type PaperSize = 'a4' | 'legal';
export type PaymentStatus = 'pending' | 'processing' | 'failed' | 'success';
export type PrintStatus = 'queued' | 'printing' | 'completed' | 'failed' | 'cancelled';

export type PrintOrientation = 'portrait' | 'landscape';

export interface PrintSettings {
  color_mode: ColorMode;
  duplex: boolean;
  copies: number;
  page_range: string; // 'all' | '1-5,8,10-12'
  paper_size: PaperSize;
  print_quality: PrintQuality;
  orientation?: PrintOrientation;
}

export interface PrintJob {
  id: number;
  session_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  total_pages: number;
  color_mode: ColorMode;
  duplex: number; // 0 = single, 1 = duplex
  copies: number;
  page_range: string;
  paper_size: PaperSize;
  print_quality: PrintQuality;
  sizing: 'fit' | 'fill';
  estimated_sheets: number;
  estimated_cost: number;
  orientation: PrintOrientation;
  payment_status: PaymentStatus;
  payment_id: string | null;
  print_status: PrintStatus;
  current_page: number;
  created_at: string;
  updated_at: string;
}

// --- Scan Job Types ---
export type ScanMode = 'single' | 'multi' | 'adf' | 'id_card' | 'book';
export type ScanStatus = 'pending' | 'scanning' | 'processing' | 'completed' | 'failed';

export interface ScanJob {
  id: number;
  session_id: string;
  scan_mode: ScanMode;
  total_pages: number;
  output_path: string | null;
  download_url: string | null;
  status: ScanStatus;
  created_at: string;
  updated_at: string;
}

// --- Payment Types ---
export interface Payment {
  id: number;
  print_job_id: number;
  amount: number;
  upi_id: string | null;
  transaction_id: string | null;
  status: PaymentStatus;
  qr_data: string | null;
  created_at: string;
  updated_at: string;
}

// --- Paper Management ---
export interface PaperInventory {
  id: number;
  paper_size: PaperSize;
  capacity: number;
  current_count: number;
  updated_at: string;
}

export interface PaperRefillLog {
  id: number;
  paper_size: string;
  previous_count: number;
  sheets_added: number;
  new_count: number;
  refilled_at: string;
}

// --- Printer/Scanner Status ---
export interface PrinterStatus {
  id: number;
  name: string;
  printer_model: string;
  is_online: number;
  current_job_id: number | null;
  queue_length: number;
  paper_remaining: number;
  toner_level: number;
  ink_c?: number;
  ink_m?: number;
  ink_y?: number;
  ink_k?: number;
  duplex_available: number;
  adf_available: number;
  tray_status: 'in' | 'out';
  paper_loaded: string;
  current_error?: string | null;
  last_heartbeat: string;
}

export interface ScannerStatus {
  id: number;
  name: string;
  is_online: number;
  current_job_id: number | null;
  last_heartbeat: string;
}

// --- Event Logs ---
export type EventCategory = 'printer' | 'scanner' | 'payment' | 'system' | 'hardware';

export interface EventLog {
  id: number;
  event_type: string;
  event_category: EventCategory;
  description: string | null;
  metadata: string | null;
  created_at: string;
}

// --- Hardware Events ---
export type SensorType = 'mpu6050' | 'hall' | 'door' | 'paper' | 'nfc' | 'rfid';
export type HardwareEventType =
  | 'tamper_detected'
  | 'tilt_detected'
  | 'impact_detected'
  | 'door_open'
  | 'door_closed'
  | 'paper_tray_open'
  | 'paper_tray_closed'
  | 'nfc_read'
  | 'rfid_read';

export interface HardwareEvent {
  id: number;
  sensor_type: SensorType;
  event_type: HardwareEventType;
  raw_data: string | null;
  created_at: string;
}

// --- WebSocket Messages ---
export type WSChannel = 'session' | 'tft' | 'admin' | 'printer' | 'scanner';

export interface WSMessage {
  channel: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// --- Admin Dashboard ---
export interface DashboardStats {
  printer_online: boolean;
  scanner_online: boolean;
  active_sessions: number;
  pages_printed_today: number;
  pages_printed_month: number;
  total_scans: number;
  revenue_today: number;
  revenue_month: number;
  paper_remaining: number;
}

// --- Settings ---
export interface PricingConfig {
  bw_single: number;
  bw_duplex: number;
  color_single: number;
  color_duplex: number;
  scan_per_page: number;
}

export interface AdminSettings {
  pricing: PricingConfig;
  session_timeout_minutes: number;
  auto_payment_approve: boolean; // For testing
  kiosk_name: string;
}

// --- API Response Types ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// --- File Analysis ---
export interface FileAnalysis {
  file_name: string;
  file_size: number;
  total_pages: number;
  mime_type: string;
}
