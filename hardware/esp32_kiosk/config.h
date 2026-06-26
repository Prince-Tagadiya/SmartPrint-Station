#ifndef CONFIG_H
#define CONFIG_H

// =====================================================
//  SmartPrint Station — ESP32 Kiosk Configuration
//  © Made with ❤ by Prince Tagadiya
// =====================================================

// ─── Pin Definitions ────────────────────────────────

// TFT Display (ILI9341 SPI) — defined in TFT_eSPI User_Setup.h
// MOSI=23, MISO=19, SCK=18, CS=15, DC=2, RST=4

// Touch Panel (XPT2046) — same SPI, CS=5
// Defined in TFT_eSPI User_Setup.h

// MPU-6050 (I2C)
#define MPU_SDA   21
#define MPU_SCL   22

// Home Button (active LOW with internal pullup)
#define PIN_BUTTON 33

// Buzzer (active HIGH)
#define PIN_BUZZER 25

// ─── Display Settings ───────────────────────────────

#define SCREEN_W       240
#define SCREEN_H       320
#define TFT_ROTATION   2  // Portrait Inverted

// ─── Color Palette (RGB565) ─────────────────────────
// Premium dark theme with vibrant accents

#define COL_BG           0x0000  // #000000 Pure black
#define COL_BG_CARD      0x10A2  // #1A1A1A Dark card
#define COL_BG_ELEVATED  0x2104  // #222222 Elevated surface
#define COL_BG_INPUT     0x0841  // #0A0A0A Input field bg

#define COL_ACCENT       0x07FF  // #00FFFF Cyan primary accent
#define COL_ACCENT_DIM   0x0410  // #006080 Dim cyan
#define COL_ACCENT2      0x781F  // #F800FF Magenta/Purple
#define COL_ACCENT2_DIM  0x3808  // #700040 Dim purple

#define COL_SUCCESS      0x07E0  // #00FF00 Green
#define COL_SUCCESS_DIM  0x03E0  // #007F00 Dark green
#define COL_WARNING      0xFD20  // #FFA500 Amber
#define COL_ERROR        0xF800  // #FF0000 Red
#define COL_ERROR_DIM    0x7800  // #7F0000 Dark red

#define COL_TEXT         0xFFFF  // #FFFFFF White
#define COL_TEXT_SEC     0xC618  // #C0C0C0 Silver
#define COL_TEXT_DIM     0x7BEF  // #7F7F7F Medium gray
#define COL_TEXT_MUTED   0x4208  // #404040 Dark gray

#define COL_DIVIDER      0x18C3  // #181C18 Subtle line
#define COL_PROGRESS_BG  0x18C3  // Progress bar track

// Button colors
#define COL_BTN_PRINT    0x04DF  // Bright blue-cyan
#define COL_BTN_SCAN     0x6813  // Warm purple
#define COL_BTN_SUCCESS  0x0640  // Forest green
#define COL_BTN_DANGER   0xC000  // Deep red
#define COL_BTN_OUTLINE  0x3186  // Button border

// Gradient helpers
#define COL_GRAD_START   0x07FF  // Cyan
#define COL_GRAD_END     0x781F  // Magenta

// ─── Timing (ms) ────────────────────────────────────

#define SPLASH_DURATION      2500
#define COMPLETE_TIMEOUT     5000
#define HEARTBEAT_INTERVAL   10000
#define MPU_READ_INTERVAL    100
#define TOUCH_DEBOUNCE       300
#define BUTTON_DEBOUNCE      50
#define CAL_CORNER_TIMEOUT   3000
#define ANIM_FRAME_INTERVAL  50
#define PAYMENT_PULSE_SPEED  1500  // ms per pulse cycle
#define SOS_DOT_MS           150
#define SOS_DASH_MS          400
#define SOS_GAP_MS           150
#define SOS_LETTER_GAP_MS    300
#define SOS_WORD_GAP_MS      700

// ─── MPU-6050 Thresholds ────────────────────────────

#define TAMPER_THRESHOLD     0.50f  // m/s² deviation triggers tamper
#define TAMPER_CLEAR_TIME    5000   // ms of calm before clearing tamper
#define LID_ANGLE_CLOSED     8.0f   // degrees to consider lid "closed"
#define MPU_BASELINE_SAMPLES 20     // samples to average for baseline

// ─── Scan Flow Thresholds ────────────────────────────

#define LID_OPEN_ANGLE       65.0f  // degrees to consider lid "open enough"
#define LID_CLOSE_ANGLE      10.0f  // degrees to consider lid "closed" for scan trigger
#define LID_OPEN_HOLD_MS     600    // ms lid must be at open angle before advancing
#define LID_CLOSE_HOLD_MS    400    // ms lid must be at closed angle before triggering scan
#define SCAN_PLACE_DWELL_MS  3000   // ms to wait on "Place Document" before advancing
#define SCAN_COLLECT_TIMEOUT_MS 30000 // ms before collect reminder auto-clears

// ─── Serial ─────────────────────────────────────────

#define SERIAL_BAUD      115200
#define JSON_BUF_SIZE    1024

// ─── Touch Calibration Corners ──────────────────────

#define CORNER_MARGIN    50
// Touch corners for entering calibration mode
// Order: Top-Right → Top-Left → Bottom-Left → Bottom-Right
#define CAL_CORNER_COUNT 4

// ─── Layout Constants ───────────────────────────────

#define STATUS_BAR_H     0
#define WATERMARK_H      18
#define CONTENT_Y        (STATUS_BAR_H + 4)
#define CONTENT_H        (SCREEN_H - STATUS_BAR_H - WATERMARK_H - 8)
#define CONTENT_CX       (SCREEN_W / 2)
#define CONTENT_CY       (CONTENT_Y + CONTENT_H / 2)

#define BTN_W            130
#define BTN_H            140
#define BTN_GAP          20
#define BTN_RADIUS       12

#define PROGRESS_BAR_W   260
#define PROGRESS_BAR_H   14
#define PROGRESS_BAR_R   7

// ─── Screen IDs ─────────────────────────────────────

enum ScreenId {
  SCR_SPLASH = 0,
  SCR_HOME,
  SCR_PRINT_SESSION,
  SCR_UPLOADING,
  SCR_FILE_RECEIVED,
  SCR_PAYMENT_WAIT,
  SCR_PAYMENT_OK,
  SCR_PRINTING,
  SCR_COMPLETE,
  SCR_TAMPER,
  SCR_CALIBRATION,
  SCR_ENGINEERING,
  SCR_SYS_CHECK,
  SCR_PRINTER_OFFLINE,
  SCR_OUT_OF_PAPER,
  // ── Premium Scan Flow (MPU-driven, TFT-only) ──
  SCR_SCAN_LID_OPEN,     // Step 1: Open scanner lid (with angle ring gauge)
  SCR_SCAN_PLACE_DOC,    // Step 2: Place document on glass (auto-dwell)
  SCR_SCAN_LID_CLOSE,    // Step 3: Close lid (with angle ring gauge)
  SCR_SCANNING,          // Step 4: Laptop is scanning (laser sweep animation)
  SCR_PREPARING_PDF,     // Step 5: Laptop creating PDF (spinner)
  SCR_SCAN_COLLECT,      // Step 6: Collect original document (flashing reminder)
  SCR_COUNT
};

// ─── Screen Data Structure ──────────────────────────

struct ScreenData {
  char sessionCode[10];
  char url[64];
  char filename[64];
  int  pages;
  int  totalPages;
  float cost;
  int  progress;
  float amount;
  char colorMode[16];
  char duplex[16];
  char orientation[16];
  char sizing[16];      // fit, fill
  int  copies;
  float lidAngle;
  bool serverOnline;
  bool printerOnline;
  bool scannerOnline;
  bool scanLidError;    // True if lid opened during active scan
  bool collectLidOpened;// True if lid was opened >10 deg during collect reminder
  int  inkC, inkM, inkY, inkK;
  int  calStep;       // 0=waiting corners, 1=close lid, 2=open lid, 3=done
  int  sysCheckStep;  // 1=gyro, 2=button, 3=buzzer
  int  configPage;    // For pagination (0, 1, or 2)
};

// ─── Calibration Data (stored in NVS) ───────────────

struct CalibrationData {
  float closedX, closedY, closedZ;
  float openX, openY, openZ;
  bool  isCalibrated;
};

// ─── Firmware Version ───────────────────────────────

#define FW_VERSION "1.0.0"

#endif // CONFIG_H
