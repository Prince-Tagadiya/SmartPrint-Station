// =====================================================
//  SmartPrint Station — TFT_eSPI Configuration
//  Copy this file to your TFT_eSPI library folder:
//    Arduino/libraries/TFT_eSPI/User_Setup.h
//  (Replace the existing User_Setup.h)
// =====================================================

// ─── Display Driver ─────────────────────────────────
#define ILI9341_DRIVER

// ─── Display Dimensions ─────────────────────────────
#define TFT_WIDTH  240
#define TFT_HEIGHT 320

// ─── ESP32 SPI Pin Assignments ──────────────────────
#define TFT_MOSI  23
#define TFT_MISO  19
#define TFT_SCLK  18
#define TFT_CS    15
#define TFT_DC     2
#define TFT_RST    4

// ─── Touch Screen (XPT2046) ─────────────────────────
#define TOUCH_CS   5

// ─── SPI Frequency ──────────────────────────────────
#define SPI_FREQUENCY       40000000   // 40 MHz for display
#define SPI_READ_FREQUENCY  20000000   // 20 MHz for read
#define SPI_TOUCH_FREQUENCY  2500000   // 2.5 MHz for touch

// ─── Font Loading ───────────────────────────────────
#define LOAD_GLCD    // Font 1: 8px Adafruit
#define LOAD_FONT2   // Font 2: 16px small
#define LOAD_FONT4   // Font 4: 26px medium
#define LOAD_FONT6   // Font 6: 48px numbers only
#define LOAD_FONT7   // Font 7: 48px 7-segment
#define LOAD_FONT8   // Font 8: 75px large numbers
#define LOAD_GFXFF   // FreeFonts (FreeSans, FreeSansBold, etc.)
#define SMOOTH_FONT

// ─── Other Settings ─────────────────────────────────
// #define TFT_INVERSION_ON   // Uncomment if colors look inverted
// #define TFT_INVERSION_OFF
