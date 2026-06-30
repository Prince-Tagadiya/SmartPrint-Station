// =====================================================
//  SmartPrint Station — Screen Rendering
//  All TFT display screens for the kiosk
//  © Made with ❤ by Prince Tagadiya
// =====================================================

#include "screens.h"
#include "ui.h"
#include <TFT_eSPI.h>
#include "qrcode.h"
#include "mpu_handler.h"
#include "serial_comm.h"

// ═════════════════════════════════════════════════════
//  SPLASH SCREEN
// ═════════════════════════════════════════════════════

void scr_drawSplash() {
  tft.fillScreen(COL_BG);

  // Decorative top accent line (gradient)
  ui_drawGradientRect(0, 0, SCREEN_W, 3, COL_ACCENT, COL_ACCENT2);

  // Main title "SmartPrint" with accent color
  tft.setFreeFont(&FreeSansBold24pt7b);
  tft.setTextColor(COL_ACCENT);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("SmartPrint", SCREEN_W / 2, 75);

  // Subtitle "STATION" with letter spacing effect
  tft.setFreeFont(&FreeSansBold12pt7b);
  tft.setTextColor(COL_TEXT_SEC);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("S T A T I O N", SCREEN_W / 2, 110);

  // Decorative line under title
  int lineY = 125;
  tft.drawFastHLine(SCREEN_W / 2 - 60, lineY, 120, COL_TEXT_MUTED);
  tft.fillCircle(SCREEN_W / 2 - 60, lineY, 2, COL_ACCENT);
  tft.fillCircle(SCREEN_W / 2 + 60, lineY, 2, COL_ACCENT2);

  // Loading label
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("Initializing...", SCREEN_W / 2, 168);

  // Progress bar track
  int barX = (SCREEN_W - 200) / 2;
  tft.fillRoundRect(barX, 180, 200, 8, 4, COL_PROGRESS_BG);

  // Bottom accent line (gradient, reverse)
  ui_drawGradientRect(0, SCREEN_H - 3, SCREEN_W, 3, COL_ACCENT2, COL_ACCENT);

  // Watermark
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_MUTED, COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("Made with <3 by Prince Tagadiya", SCREEN_W / 2, SCREEN_H - 14);

  // Draw copyright symbol
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(COL_ACCENT_DIM, COL_BG);
  tft.drawString("(c)", SCREEN_W / 2 - 96, SCREEN_H - 14);
}

void scr_updateSplash() {
  unsigned long elapsed = millis() - splashStart;
  int barWidth = map(constrain(elapsed, 0, SPLASH_DURATION), 0, SPLASH_DURATION, 0, 200);
  int barX = (SCREEN_W - 200) / 2;

  // Animated gradient fill
  for (int i = 0; i < barWidth; i++) {
    float t = (float)i / 200.0f;
    uint16_t c = ui_lerpColor(COL_ACCENT, COL_ACCENT2, t);
    tft.drawFastVLine(barX + i, 180, 8, c);
  }
}

// ═════════════════════════════════════════════════════
//  HOME SCREEN
// ═════════════════════════════════════════════════════

void scr_drawHome() {
  tft.fillScreen(COL_BG);

  // Status bar
  ui_drawStatusBar(sData.printerOnline);

  if (!sData.serverOnline) {
    // Server offline - show large disconnected state
    ui_drawCenteredText("KIOSK OFFLINE", CONTENT_Y + 30, COL_ERROR, &FreeSansBold12pt7b);
    ui_drawWarningTriangle(SCREEN_W / 2, CONTENT_Y + 80, 40, COL_ERROR);
    ui_drawCenteredText("Server Disconnected.", CONTENT_Y + 120, COL_TEXT_SEC, &FreeSans9pt7b);
    ui_drawCenteredText("Please check USB connection.", CONTENT_Y + 140, COL_TEXT_DIM, &FreeSans9pt7b);
  } else if (!sData.printerOnline && !sData.scannerOnline) {
    // Both offline - show large disconnected state
    ui_drawCenteredText("Hardware Offline", CONTENT_Y + 30, COL_ERROR, &FreeSansBold12pt7b);
    ui_drawWarningTriangle(SCREEN_W / 2, CONTENT_Y + 80, 40, COL_ERROR);
    ui_drawCenteredText("Printer & Scanner disconnected.", CONTENT_Y + 120, COL_TEXT_SEC, &FreeSans9pt7b);
    ui_drawCenteredText("Please check USB connections.", CONTENT_Y + 140, COL_TEXT_DIM, &FreeSans9pt7b);
  } else {
    int topY = 20;
    int btnW = SCREEN_W - 40;
    int btnH = 120;
    int printY = topY;
    int scanY = topY + btnH + 20;
    int btnX = 20;

    if (sData.printerOnline) {
      // ── PRINT BUTTON ──
      tft.fillRoundRect(btnX, printY, btnW, btnH, BTN_RADIUS, COL_BTN_PRINT);
      tft.drawRoundRect(btnX + 1, printY + 1, btnW - 2, btnH - 2, BTN_RADIUS - 1,
                        ui_lerpColor(COL_BTN_PRINT, COL_TEXT, 0.12f));

      ui_drawPrinterIcon(btnX + btnW / 2, printY + 40, 40, COL_TEXT);

      tft.setFreeFont(&FreeSansBold18pt7b);
      tft.setTextColor(COL_TEXT);
      tft.setTextDatum(MC_DATUM);
      tft.drawString("PRINT", btnX + btnW / 2, printY + 90);
    } else {
      // Draw offline placeholder for printer
      tft.fillRoundRect(btnX, printY, btnW, btnH, BTN_RADIUS, COL_BG_CARD);
      tft.drawRoundRect(btnX, printY, btnW, btnH, BTN_RADIUS, COL_DIVIDER);
      ui_drawWarningTriangle(btnX + btnW / 2, printY + 40, 30, COL_ERROR);
      
      tft.setFreeFont(&FreeSansBold12pt7b);
      tft.setTextColor(COL_ERROR);
      tft.setTextDatum(MC_DATUM);
      tft.drawString("PRINTER OFFLINE", btnX + btnW / 2, printY + 90);
    }

    if (sData.scannerOnline) {
      // ── SCAN BUTTON ──
      tft.fillRoundRect(btnX, scanY, btnW, btnH, BTN_RADIUS, COL_BTN_SCAN);
      tft.drawRoundRect(btnX + 1, scanY + 1, btnW - 2, btnH - 2, BTN_RADIUS - 1,
                        ui_lerpColor(COL_BTN_SCAN, COL_TEXT, 0.12f));

      ui_drawScannerIcon(btnX + btnW / 2, scanY + 40, 40, COL_TEXT);

      tft.setFreeFont(&FreeSansBold18pt7b);
      tft.setTextColor(COL_TEXT);
      tft.setTextDatum(MC_DATUM);
      tft.drawString("SCAN", btnX + btnW / 2, scanY + 90);
    } else {
      // Draw offline placeholder for scanner
      tft.fillRoundRect(btnX, scanY, btnW, btnH, BTN_RADIUS, COL_BG_CARD);
      tft.drawRoundRect(btnX, scanY, btnW, btnH, BTN_RADIUS, COL_DIVIDER);
      ui_drawWarningTriangle(btnX + btnW / 2, scanY + 40, 30, COL_ERROR);
      
      tft.setFreeFont(&FreeSansBold12pt7b);
      tft.setTextColor(COL_ERROR);
      tft.setTextDatum(MC_DATUM);
      tft.drawString("SCANNER OFFLINE", btnX + btnW / 2, scanY + 90);
    }

  }

  // Watermark
  ui_drawWatermark();
}

// ═════════════════════════════════════════════════════
//  SESSION CONNECT — Waiting for user to scan QR
// ═════════════════════════════════════════════════════

void scr_drawSessionConnect() {
  tft.fillScreen(COL_BG);
  ui_drawStatusBar(sData.printerOnline);

  // Title — always "Scan to Print" for print_session QR screen
  if (scanReminderActive) {
    tft.fillRoundRect(10, CONTENT_Y - 5, SCREEN_W - 20, 36, 6, COL_WARNING);
    ui_drawCenteredText("Take Original Doc!", CONTENT_Y + 20, COL_BG, &FreeSansBold9pt7b);
  } else {
    ui_drawCenteredText("Scan to Print", CONTENT_Y + 10, COL_ACCENT, &FreeSansBold12pt7b);
  }

  // Generate QR Code
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(6)];
  qrcode_initText(&qrcode, qrcodeData, 6, 0, sData.url); // ECC_LOW = 0

  int scale = 4; // 33x33 modules -> 132x132 pixels
  int qrSize = qrcode.size * scale;
  int padding = 8;
  int startX = (SCREEN_W - qrSize) / 2;
  int startY = CONTENT_Y + 50; // push down a bit more

  // White background for QR code
  tft.fillRoundRect(startX - padding, startY - padding, qrSize + padding * 2, qrSize + padding * 2, 4, TFT_WHITE);

  // Draw QR code modules
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        tft.fillRect(startX + x * scale, startY + y * scale, scale, scale, TFT_BLACK);
      }
    }
  }

  // URL string below QR
  tft.setFreeFont(NULL); // System font (small)
  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_SEC);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(sData.url, SCREEN_W / 2, startY + qrSize + padding + 10);

  // Small session code text box at the bottom
  int codeY = startY + qrSize + padding + 30;
  int bw = 120;
  int bx = (SCREEN_W - bw) / 2;
  tft.fillRoundRect(bx, codeY, bw, 30, 6, COL_BG_CARD);
  tft.drawRoundRect(bx, codeY, bw, 30, 6, COL_ACCENT_DIM);

  tft.setFreeFont(&FreeSansBold9pt7b);
  tft.setTextColor(COL_ACCENT);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(sData.sessionCode, SCREEN_W / 2, codeY + 15);
}

// ═════════════════════════════════════════════════════
//  UPLOADING — File upload in progress
// ═════════════════════════════════════════════════════

void scr_drawUploading() {
  tft.fillScreen(COL_BG);
  ui_drawStatusBar(sData.printerOnline);

  // Title
  ui_drawCenteredText("Receiving File", CONTENT_Y + 15, COL_ACCENT, &FreeSansBold12pt7b);

  // File icon
  ui_drawFileIcon(SCREEN_W / 2, CONTENT_Y + 60, 36, COL_ACCENT);

  // Filename
  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(COL_TEXT_SEC);
  tft.setTextDatum(MC_DATUM);
  // Truncate long filenames
  char displayName[24];
  strncpy(displayName, sData.filename, 23);
  displayName[23] = '\0';
  tft.drawString(displayName, SCREEN_W / 2, CONTENT_Y + 95);

  // Progress bar
  int barX = (SCREEN_W - PROGRESS_BAR_W) / 2;
  ui_drawProgressBar(barX, CONTENT_Y + 120, PROGRESS_BAR_W, PROGRESS_BAR_H,
                     sData.progress, COL_ACCENT, COL_PROGRESS_BG);

  // Percentage text
  char pctBuf[8];
  snprintf(pctBuf, sizeof(pctBuf), "%d%%", sData.progress);
  tft.setFreeFont(&FreeSansBold9pt7b);
  tft.setTextColor(COL_TEXT);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(pctBuf, SCREEN_W / 2, CONTENT_Y + 150);

  ui_drawWatermark();
}

// ═════════════════════════════════════════════════════
//  FILE RECEIVED — Show live config (no buttons)
// ═════════════════════════════════════════════════════

void scr_drawFileReceived() {
  tft.fillScreen(COL_BG);
  ui_drawStatusBar(sData.printerOnline);

  // Top header area
  ui_drawCenteredText("Configuring Job", CONTENT_Y + 10, COL_TEXT, &FreeSansBold12pt7b);

  int vY = 40;
  
  // Title card
  int cardX = 10, cardW = SCREEN_W - 20;
  tft.setFreeFont(&FreeSans9pt7b);
  int infoX = cardX + 10;
  
  // ── File & Cost ──
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_SEC);
  tft.drawString("File:", infoX, vY + 15);
  
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT);
  char displayName[20];
  strncpy(displayName, sData.filename, 19);
  displayName[19] = '\0';
  tft.drawString(displayName, cardX + cardW - 10, vY + 15);

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_SEC);
  tft.drawString("Cost:", infoX, vY + 45);
  
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_ACCENT);
  char costBuf[20];
  snprintf(costBuf, sizeof(costBuf), "Rs. %.2f", sData.cost);
  tft.drawString(costBuf, cardX + cardW - 10, vY + 45);

  // Divider
  tft.drawLine(cardX, vY + 75, cardX + cardW, vY + 75, COL_DIVIDER);

  // ── Configuration Summary (Static) ──
  tft.setFreeFont(&FreeSans9pt7b);
  int y = vY + 95;
  int gap = 30;

  // Copies
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_SEC);
  tft.drawString("Copies:", infoX, y);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT);
  char copiesBuf[8];
  snprintf(copiesBuf, sizeof(copiesBuf), "%d", sData.copies);
  tft.drawString(copiesBuf, cardX + cardW - 10, y);
  y += gap;

  // Color
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_SEC);
  tft.drawString("Color:", infoX, y);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT);
  tft.drawString(sData.colorMode, cardX + cardW - 10, y);
  y += gap;

  // Sides
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_SEC);
  tft.drawString("Sides:", infoX, y);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT);
  tft.drawString((strcmp(sData.duplex, "Yes") == 0) ? "2-Sided" : "1-Sided", cardX + cardW - 10, y);
  y += gap;

  // Orientation
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_SEC);
  tft.drawString("Orient:", infoX, y);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT);
  tft.drawString((strcmp(sData.orientation, "landscape") == 0) ? "Landscape" : "Portrait", cardX + cardW - 10, y);
  y += gap;

  // Sizing
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_SEC);
  tft.drawString("Sizing:", infoX, y);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT);
  tft.drawString((strcmp(sData.sizing, "fill") == 0) ? "Fill Page" : "Fit to Page", cardX + cardW - 10, y);
  y += gap;

  ui_drawCenteredText("Waiting for payment on phone...", CONTENT_Y + 250, COL_TEXT_SEC, &FreeSans9pt7b);

  ui_drawWatermark();
}

// ═════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════
//  PAYMENT WAITING
// ═════════════════════════════════════════════════════

void scr_drawPaymentWait() {
  tft.fillScreen(COL_BG);
  ui_drawStatusBar(sData.printerOnline);

  // Title
  ui_drawCenteredText("Payment Required", CONTENT_Y + 10, COL_WARNING, &FreeSansBold12pt7b);

  // Amount card (Bigger and more prominent)
  int cardY = CONTENT_Y + 45;
  int cardH = 70;
  tft.fillRoundRect(30, cardY, SCREEN_W - 60, cardH, 12, COL_BG_CARD);
  tft.drawRoundRect(30, cardY, SCREEN_W - 60, cardH, 12, COL_WARNING);

  char amtBuf[24];
  snprintf(amtBuf, sizeof(amtBuf), "Rs. %.2f", sData.amount);
  tft.setFreeFont(&FreeSansBold24pt7b);
  tft.setTextColor(COL_TEXT);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(amtBuf, SCREEN_W / 2, cardY + cardH / 2 + 5);

  ui_drawCenteredText("Complete payment on your phone", CONTENT_Y + 145, COL_TEXT_SEC, &FreeSans9pt7b);
  ui_drawCenteredText("to begin printing.", CONTENT_Y + 165, COL_TEXT_SEC, &FreeSans9pt7b);

  // Pulsing indicator drawn in update
  ui_drawWatermark();
}

void scr_updatePaymentWait() {
  // Pulsing dot animation
  float pulse = ui_pulseValue(PAYMENT_PULSE_SPEED);
  uint16_t dotColor = ui_lerpColor(COL_BG, COL_WARNING, pulse);

  int dotY = CONTENT_Y + 210;
  for (int i = 0; i < 3; i++) {
    int dx = SCREEN_W / 2 + (i - 1) * 20;
    // Stagger the phase per dot
    float p = ui_pulseValue(PAYMENT_PULSE_SPEED + i * 300);
    uint16_t c = ui_lerpColor(COL_TEXT_MUTED, COL_WARNING, p);
    tft.fillCircle(dx, dotY, 5, c);
  }
}

// ═════════════════════════════════════════════════════
//  PAYMENT OK
// ═════════════════════════════════════════════════════

void scr_drawPaymentOk() {
  tft.fillScreen(COL_BG);
  ui_drawStatusBar(sData.printerOnline);

  // Big success circle (shrink slightly)
  tft.fillCircle(SCREEN_W / 2, CONTENT_Y + 50, 45, COL_SUCCESS_DIM);
  tft.fillCircle(SCREEN_W / 2, CONTENT_Y + 50, 36, COL_BG);

  // Checkmark inside circle
  ui_drawCheckmark(SCREEN_W / 2, CONTENT_Y + 50, 38, COL_SUCCESS);

  // Text
  ui_drawCenteredText("Payment Successful!", CONTENT_Y + 130, COL_SUCCESS, &FreeSansBold12pt7b);

  char amtBuf[24];
  snprintf(amtBuf, sizeof(amtBuf), "Paid: Rs. %.2f", sData.amount);
  ui_drawCenteredText(amtBuf, CONTENT_Y + 160, COL_TEXT_SEC, &FreeSans9pt7b);

  ui_drawCenteredText("Starting print...", CONTENT_Y + 210, COL_TEXT, &FreeSansBold9pt7b);

  ui_drawWatermark();
}

// ═════════════════════════════════════════════════════
//  PRINTING — Progress
// ═════════════════════════════════════════════════════

void scr_drawPrinting() {
  tft.fillScreen(COL_BG);
  ui_drawStatusBar(sData.printerOnline);

  // Title
  ui_drawCenteredText("Printing...", CONTENT_Y + 10, COL_ACCENT, &FreeSansBold12pt7b);

  // Printer icon
  ui_drawPrinterIcon(SCREEN_W / 2, CONTENT_Y + 55, 44, COL_ACCENT);

  // Page counter
  char pageBuf[24];
  snprintf(pageBuf, sizeof(pageBuf), "Page %d of %d", sData.pages, sData.totalPages);
  ui_drawCenteredText(pageBuf, CONTENT_Y + 95, COL_TEXT_SEC, &FreeSans9pt7b);

  // Progress bar
  int barX = (SCREEN_W - PROGRESS_BAR_W) / 2;
  int barY = CONTENT_Y + 120;
  ui_drawProgressBar(barX, barY, PROGRESS_BAR_W, PROGRESS_BAR_H,
                     sData.progress, COL_ACCENT, COL_PROGRESS_BG);

  // Percentage
  char pctBuf[8];
  snprintf(pctBuf, sizeof(pctBuf), "%d%%", sData.progress);
  tft.setFreeFont(&FreeSansBold9pt7b);
  tft.setTextColor(COL_TEXT);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(pctBuf, SCREEN_W / 2, CONTENT_Y + 150);

  // "Do not remove paper" warning
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(COL_WARNING, COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("Please wait, do not remove paper", SCREEN_W / 2, CONTENT_Y + 172);

  ui_drawWatermark();
}

void scr_updatePrinting() {
  // Update progress bar without full redraw
  int barX = (SCREEN_W - PROGRESS_BAR_W) / 2;
  int barY = CONTENT_Y + 120;
  ui_drawProgressBar(barX, barY, PROGRESS_BAR_W, PROGRESS_BAR_H,
                     sData.progress, COL_ACCENT, COL_PROGRESS_BG);

  // Update percentage text
  char pctBuf[8];
  snprintf(pctBuf, sizeof(pctBuf), "%d%%", sData.progress);
  tft.fillRect(SCREEN_W / 2 - 25, CONTENT_Y + 140, 50, 20, COL_BG);
  tft.setFreeFont(&FreeSansBold9pt7b);
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(pctBuf, SCREEN_W / 2, CONTENT_Y + 150);

  // Update page counter
  char pageBuf[24];
  snprintf(pageBuf, sizeof(pageBuf), "Page %d of %d", sData.pages, sData.totalPages);
  tft.fillRect(SCREEN_W / 2 - 70, CONTENT_Y + 85, 140, 18, COL_BG);
  ui_drawCenteredText(pageBuf, CONTENT_Y + 95, COL_TEXT_SEC, &FreeSans9pt7b);
}

// ═════════════════════════════════════════════════════
//  SCAN HELPER — Draw Big Premium Scanner Body & Lid
// ═════════════════════════════════════════════════════

// Draw a BIG, premium flat scanner body at position (cy is the center of the base)
static void drawBigScannerBody(int cx, int cy, uint16_t bodyColor, uint16_t glassColor) {
  int bw = 126, bh = 26, br = 6;
  int gx = cx - 55, gy = cy - 8, gw = 110, gh = 16;
  // Main body base
  tft.fillRoundRect(cx - bw/2, cy - bh/2, bw, bh, br, bodyColor);
  // Scanner glass bed
  tft.fillRect(gx, gy, gw, gh, glassColor);
}

// Draw a BIG, premium lid as a thick line rotating up from the left hinge at exact angle
static void drawBigLidLine(int cx, int cy, float angle, uint16_t lidColor) {
  float rad = angle * PI / 180.0f;
  int len = 105;    // Perfect 105px long lid! Fits flawlessly below heading!
  int hx = cx - 58; // hinge x (left edge of glass)
  int hy = cy - 13; // hinge y (top-left of scanner bed)
  int tx = hx + (int)(len * cos(-rad));
  int ty = hy + (int)(len * sin(-rad));
  
  // Draw ultra-thick lid (7 parallel lines for premium visual weight)
  for (int d = -3; d <= 3; d++) {
    tft.drawLine(hx, hy + d, tx, ty + d, lidColor);
  }
  // Hinge glowing pivot dot
  tft.fillCircle(hx, hy, 6, COL_ACCENT);
  tft.fillCircle(hx, hy, 3, COL_TEXT);
}

// Draw a beautiful dashed threshold line at target angle
static void drawThresholdLine(int cx, int cy, float targetAngle, uint16_t color) {
  float rad = targetAngle * PI / 180.0f;
  int hx = cx - 58;
  int hy = cy - 13;
  // Dashed line from r=20 to r=95
  for (int r = 20; r <= 95; r += 10) {
    int x1 = hx + (int)(r * cos(-rad));
    int y1 = hy + (int)(r * sin(-rad));
    int x2 = hx + (int)((r + 5) * cos(-rad));
    int y2 = hy + (int)((r + 5) * sin(-rad));
    tft.drawLine(x1, y1, x2, y2, color);
    tft.drawLine(x1, y1+1, x2, y2+1, color); // 2px thick for visibility
  }
}

// ═════════════════════════════════════════════════════
//  STEP 1: Open Scanner Lid
// ═════════════════════════════════════════════════════

void scr_drawScanLidOpen() {
  tft.fillScreen(COL_BG);

  // Top accent bar
  ui_drawGradientRect(0, 0, SCREEN_W, 4, COL_ACCENT, COL_ACCENT2);

  // Step indicator dots  
  for (int i = 0; i < 3; i++) {
    uint16_t c = (i == 0) ? COL_ACCENT : COL_TEXT_MUTED;
    tft.fillCircle(SCREEN_W/2 - 20 + i * 20, 14, 4, c);
  }

  // Title (y=26 so it stays completely clear of y=60 fillRect)
  ui_drawCenteredText("Open Scanner Lid", 26, COL_TEXT, &FreeSansBold12pt7b);

  // Big scanner illustration at cy = 182
  int cx = SCREEN_W / 2, cy = 182;
  drawBigScannerBody(cx, cy, COL_BG_CARD, COL_ACCENT_DIM);
  drawThresholdLine(cx, cy, LID_OPEN_ANGLE, COL_WARNING);

  // Angle readout box placeholder
  tft.fillRect(cx - 70, 198, 140, 28, COL_BG);
  tft.setFreeFont(&FreeSansBold9pt7b);
  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("Angle: 0 deg", cx, 212);

  // Gorgeous instruction card below angle readout
  tft.fillRoundRect(12, 230, 216, 68, 8, COL_BG_CARD);
  tft.drawRoundRect(12, 230, 216, 68, 8, COL_ACCENT_DIM);
  ui_drawCenteredText("Lift lid past 65 deg", 250, COL_TEXT_SEC, &FreeSans9pt7b);
  ui_drawCenteredText("to unlock glass.", 274, COL_TEXT_DIM, &FreeSans9pt7b);

  // Bottom tip
  ui_drawCenteredText("Press Home to cancel", SCREEN_H - 15, COL_TEXT_MUTED, 1);
}

void scr_updateScanLidOpen() {
  int cx = SCREEN_W / 2, cy = 182;
  float angle = sData.lidAngle;
  if (angle < 0) angle = 0;
  if (angle > 180) angle = 180;

  // ── Delta detection: only redraw if angle changed by ≥1° ──
  static float lastDrawnAngle = -999.0f;

  bool angleChanged = (fabsf(angle - lastDrawnAngle) >= 1.0f);

  if (angleChanged) {
    uint16_t lidColor = (angle >= LID_OPEN_ANGLE) ? COL_SUCCESS : COL_ACCENT;

    // Erase the full illustration region cleanly (starts at y=60 so heading is untouched)
    tft.fillRect(35, 60, 170, 136, COL_BG);
    drawBigScannerBody(cx, cy, COL_BG_CARD, COL_ACCENT_DIM);
    drawThresholdLine(cx, cy, LID_OPEN_ANGLE, (angle >= LID_OPEN_ANGLE) ? COL_SUCCESS : COL_WARNING);
    
    float drawAngle = (angle > 90.0f) ? 90.0f : angle;
    if (drawAngle < 3.0f) drawAngle = 3.0f;
    drawBigLidLine(cx, cy, drawAngle, lidColor);

    // Update angle text in its own clean box
    char buf[32];
    snprintf(buf, sizeof(buf), "Angle: %3.0f deg", angle);
    tft.fillRect(cx - 70, 198, 140, 28, COL_BG);
    tft.setFreeFont(&FreeSansBold9pt7b);
    tft.setTextColor(angle >= LID_OPEN_ANGLE ? COL_SUCCESS : COL_TEXT, COL_BG);
    tft.setTextDatum(MC_DATUM);
    tft.drawString(buf, cx, 212);

    lastDrawnAngle = angle;
  }

  // Threshold logic with hysteresis hold
  if (angle >= LID_OPEN_ANGLE) {
    if (!scanLidThresholdMet) {
      scanLidThresholdMet = true;
      scanLidHoldStart = millis();
    } else if (millis() - scanLidHoldStart >= LID_OPEN_HOLD_MS) {
      // Advance to place doc
      lastDrawnAngle = -999.0f;
      scanLidThresholdMet = false;
      currentScreen = SCR_SCAN_PLACE_DOC;
      screenDirty = true;
      screenTimer = millis();
      tone(PIN_BUZZER, 3500, 80);
    }
  } else {
    scanLidThresholdMet = false;
  }
}

// ═════════════════════════════════════════════════════
//  STEP 2: Place Document (3D-like Paper Lying Down Animation)
// ═════════════════════════════════════════════════════

static float initialPlaceAngle = -1.0f;

void scr_drawScanPlaceDoc() {
  tft.fillScreen(COL_BG);
  initialPlaceAngle = sData.lidAngle;

  ui_drawGradientRect(0, 0, SCREEN_W, 4, COL_ACCENT, COL_ACCENT2);

  // Step indicator — step 2 active
  for (int i = 0; i < 3; i++) {
    uint16_t c = (i == 1) ? COL_SUCCESS : COL_TEXT_MUTED;
    tft.fillCircle(SCREEN_W/2 - 20 + i * 20, 14, 4, c);
  }

  ui_drawCenteredText("Place Document", 26, COL_TEXT, &FreeSansBold12pt7b);

  // Big scanner glass bed at cy = 182
  int cx = SCREEN_W / 2, cy = 182;
  drawBigScannerBody(cx, cy, COL_BG_CARD, COL_ACCENT_DIM);
  
  // Angle readout box placeholder for live lid status
  tft.fillRect(cx - 70, 198, 140, 28, COL_BG);
  tft.setFreeFont(&FreeSansBold9pt7b);
  tft.setTextColor(COL_SUCCESS, COL_BG);
  tft.setTextDatum(MC_DATUM);
  char buf[32];
  snprintf(buf, sizeof(buf), "Angle: %3.0f deg", sData.lidAngle);
  tft.drawString(buf, cx, 212);

  // Gorgeous instruction card below scanner bed
  tft.fillRoundRect(12, 230, 216, 68, 8, COL_BG_ELEVATED);
  tft.drawRoundRect(12, 230, 216, 68, 8, COL_ACCENT);
  ui_drawCenteredText("Place doc face down", 250, COL_TEXT_SEC, &FreeSans9pt7b);
  ui_drawCenteredText("then close lid fully.", 274, COL_TEXT_SEC, &FreeSans9pt7b);

  ui_drawCenteredText("Press Home to cancel", SCREEN_H - 15, COL_TEXT_MUTED, 1);
}

void scr_updateScanPlaceDoc() {
  unsigned long elapsed = millis() - screenTimer;
  int cx = SCREEN_W / 2, cy = 182;
  float angle = sData.lidAngle;
  if (angle < 0) angle = 0;
  if (angle > 180) angle = 180;

  // 3D-like paper floating down and lying flat on glass animation
  static int paperY = 70;
  
  // Erase old paper and arrow position cleanly (starts at y=60 so heading is untouched)
  tft.fillRect(35, 60, 170, 136, COL_BG);

  // Update paperY
  paperY += 4;
  if (paperY > 178) {
    paperY = 70; // Reset animation loop
  }

  // Draw scanner glass base to ensure it remains clean
  drawBigScannerBody(cx, cy, COL_BG_CARD, COL_ACCENT_DIM);

  if (paperY < 145) {
    // Phase 1: Paper floating down vertically above glass
    tft.fillTriangle(cx, paperY - 5, cx - 8, paperY - 15, cx + 8, paperY - 15, COL_WARNING);
    tft.fillRect(cx - 3, paperY - 25, 6, 10, COL_WARNING);

    // Draw 3D-like white paper sheet floating down
    tft.fillRoundRect(cx - 45, paperY, 90, 35, 4, COL_TEXT);
    tft.drawRoundRect(cx - 45, paperY, 90, 35, 4, COL_WARNING);
    tft.fillRect(cx - 35, paperY + 8, 70, 3, COL_ACCENT_DIM);
    tft.fillRect(cx - 35, paperY + 16, 50, 3, COL_ACCENT_DIM);
    tft.fillRect(cx - 35, paperY + 24, 60, 3, COL_ACCENT_DIM);
  } else {
    // Phase 2: Paper lying completely flat on the scanner glass
    int flatY = cy - 6; // Center of glass bed
    tft.fillRoundRect(cx - 50, flatY, 100, 12, 2, COL_TEXT);
    tft.drawRoundRect(cx - 50, flatY, 100, 12, 2, COL_WARNING);
    tft.fillRect(cx - 40, flatY + 3, 80, 2, COL_ACCENT_DIM);
    tft.fillRect(cx - 40, flatY + 7, 60, 2, COL_ACCENT_DIM);
  }

  // Update live lid angle text
  static float lastDrawnAngle = -999.0f;
  bool angleChanged = (fabsf(angle - lastDrawnAngle) >= 1.0f);
  if (angleChanged) {
    char buf[32];
    snprintf(buf, sizeof(buf), "Angle: %3.0f deg", angle);
    tft.fillRect(cx - 70, 198, 140, 28, COL_BG);
    tft.setFreeFont(&FreeSansBold9pt7b);
    tft.setTextColor(COL_SUCCESS, COL_BG);
    tft.setTextDatum(MC_DATUM);
    tft.drawString(buf, cx, 212);
    lastDrawnAngle = angle;
  }

  // 3 pulsing dots at y = 304
  for (int i = 0; i < 3; i++) {
    float phase = (float)((elapsed + i * 600) % 1800) / 1800.0f;
    float brightness = 0.3f + 0.7f * sin(phase * 2.0f * PI);
    if (brightness < 0) brightness = 0;
    uint16_t c = ui_dimColor(COL_ACCENT, brightness);
    tft.fillCircle(cx - 15 + i * 15, 304, 4, c);
  }

  // User requested: after placing document, if the user moves the lid UP or DOWN
  // by more than 2 degrees in either direction, immediately advance to the Close Lid screen!
  if (fabsf(angle - initialPlaceAngle) > 2.0f || angle < 58.0f) {
    lastDrawnAngle = -999.0f;
    initialPlaceAngle = -1.0f;
    scanLidThresholdMet = false;
    scanLidHoldStart = 0;
    currentScreen = SCR_SCAN_LID_CLOSE;
    screenDirty = true;
    tone(PIN_BUZZER, 3500, 80);
  }
}

// ═════════════════════════════════════════════════════
//  STEP 3: Close Scanner Lid
// ═════════════════════════════════════════════════════

void scr_drawScanLidClose() {
  tft.fillScreen(COL_BG);

  ui_drawGradientRect(0, 0, SCREEN_W, 4, COL_WARNING, COL_ACCENT);

  // Step indicator — step 3 active
  for (int i = 0; i < 3; i++) {
    uint16_t c = (i == 2) ? COL_WARNING : (i < 2 ? COL_SUCCESS : COL_TEXT_MUTED);
    tft.fillCircle(SCREEN_W/2 - 20 + i * 20, 14, 4, c);
  }

  ui_drawCenteredText("Close Scanner Lid", 26, COL_TEXT, &FreeSansBold12pt7b);

  int cx = SCREEN_W / 2, cy = 182;
  drawBigScannerBody(cx, cy, COL_BG_CARD, COL_ACCENT_DIM);

  // Angle readout box placeholder
  tft.fillRect(cx - 70, 198, 140, 28, COL_BG);
  tft.setFreeFont(&FreeSansBold9pt7b);
  tft.setTextColor(COL_WARNING, COL_BG);
  tft.setTextDatum(MC_DATUM);
  char buf[32];
  snprintf(buf, sizeof(buf), "Angle: %3.0f deg", sData.lidAngle);
  tft.drawString(buf, cx, 212);

  // Gorgeous instruction card below angle readout
  tft.fillRoundRect(12, 230, 216, 68, 8, COL_BG_CARD);
  tft.drawRoundRect(12, 230, 216, 68, 8, COL_WARNING);
  ui_drawCenteredText("Close lid (0-10 deg)", 250, COL_TEXT_SEC, &FreeSans9pt7b);
  ui_drawCenteredText("to auto start scan.", 274, COL_TEXT_DIM, &FreeSans9pt7b);

  ui_drawCenteredText("Press Home to cancel", SCREEN_H - 15, COL_TEXT_MUTED, 1);
}

void scr_updateScanLidClose() {
  int cx = SCREEN_W / 2, cy = 182;
  float angle = sData.lidAngle;
  if (angle < 0) angle = 0;
  if (angle > 180) angle = 180;

  // ── Delta detection: only redraw if changed by ≥1° ──
  static float lastDrawnAngle = -999.0f;

  bool angleChanged = (fabsf(angle - lastDrawnAngle) >= 1.0f);

  if (angleChanged) {
    uint16_t lidColor = (angle <= LID_CLOSE_ANGLE) ? COL_SUCCESS : COL_WARNING;

    // Erase lid sweep region cleanly (starts at y=60 so heading is untouched)
    tft.fillRect(35, 60, 170, 136, COL_BG);
    drawBigScannerBody(cx, cy, COL_BG_CARD, COL_ACCENT_DIM);
    
    float drawAngle = (angle > 90.0f) ? 90.0f : angle;
    if (drawAngle > 2.0f) {
      drawBigLidLine(cx, cy, drawAngle, lidColor);
    }

    // Update angle text in its own clean box
    char buf[32];
    snprintf(buf, sizeof(buf), "Angle: %3.0f deg", angle);
    tft.fillRect(cx - 70, 198, 140, 28, COL_BG);
    tft.setFreeFont(&FreeSansBold9pt7b);
    tft.setTextColor(angle <= LID_CLOSE_ANGLE ? COL_SUCCESS : COL_WARNING, COL_BG);
    tft.setTextDatum(MC_DATUM);
    tft.drawString(buf, cx, 212);

    lastDrawnAngle = angle;
  }

  // Threshold hold logic
  if (angle <= LID_CLOSE_ANGLE) {
    if (!scanLidThresholdMet) {
      scanLidThresholdMet = true;
      scanLidHoldStart = millis();
    } else if (millis() - scanLidHoldStart >= LID_CLOSE_HOLD_MS) {
      // Trigger scan!
      lastDrawnAngle = -999.0f;
      scanLidThresholdMet = false;
      serial_sendTouch("home", "scan_start");
      currentScreen = SCR_SCANNING;
      screenDirty = true;
      tone(PIN_BUZZER, 4000, 120);
    }
  } else {
    scanLidThresholdMet = false;
  }
}

// ═════════════════════════════════════════════════════
//  STEP 4: Scanning (laptop is scanning)
// ═════════════════════════════════════════════════════

void scr_drawScanning() {
  tft.fillScreen(COL_BG);
  ui_drawGradientRect(0, 0, SCREEN_W, 4, COL_ACCENT, COL_ACCENT2);

  if (sData.scanLidError) {
    // Lid opened during scan! Show massive beautiful error card
    tft.fillRoundRect(15, 60, 210, 180, 12, COL_ERROR_DIM);
    tft.drawRoundRect(15, 60, 210, 180, 12, COL_ERROR);
    ui_drawCenteredText("LID OPEN ERROR!", 105, COL_TEXT, &FreeSansBold12pt7b);
    ui_drawCenteredText("Please close the lid", 145, COL_WARNING, &FreeSans9pt7b);
    ui_drawCenteredText("to continue scanning.", 170, COL_TEXT, &FreeSans9pt7b);
    ui_drawCenteredText("Keep lid fully closed!", 205, COL_TEXT_SEC, &FreeSans9pt7b);
    return;
  }

  ui_drawCenteredText("Scanning...", 26, COL_ACCENT, &FreeSansBold12pt7b);

  // Scanner bed illustration
  int cx = SCREEN_W / 2;
  int bx = cx - 70, by = 75, bw = 140, bh = 110;
  tft.fillRoundRect(bx, by, bw, bh, 8, COL_BG_CARD);
  tft.fillRect(bx + 5, by + 5, bw - 10, bh - 10, COL_BG_ELEVATED);

  // Glass area label
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_MUTED, COL_BG_ELEVATED);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("DOCUMENT GLASS", cx, by + bh / 2);

  // Gorgeous progress card below scanner bed
  tft.fillRoundRect(12, 230, 216, 68, 8, COL_BG_ELEVATED);
  tft.drawRoundRect(12, 230, 216, 68, 8, COL_ACCENT);
  ui_drawCenteredText("Do not move scanner", 250, COL_TEXT_SEC, &FreeSans9pt7b);
  ui_drawCenteredText("or open the lid.", 274, COL_TEXT_SEC, &FreeSans9pt7b);
}

void scr_updateScanning() {
  static bool lastErrorState = false;
  if (sData.scanLidError != lastErrorState) {
    lastErrorState = sData.scanLidError;
    scr_drawScanning();
    return;
  }

  if (sData.scanLidError) {
    // Flashing border effect during error
    unsigned long t = millis();
    bool flash = ((t / 300) % 2) == 0;
    tft.drawRoundRect(15, 60, 210, 180, 12, flash ? COL_WARNING : COL_ERROR);
    return;
  }

  // Animate a laser line sweeping inside the scanner bed
  static int laserY = 0;
  static bool goingDown = true;
  int bx = SCREEN_W / 2 - 65, by = 80, bh = 100;

  // Erase old laser
  tft.drawFastHLine(bx, by + laserY, 130, COL_BG_ELEVATED);
  tft.drawFastHLine(bx, by + laserY + 1, 130, COL_BG_ELEVATED);

  // Move laser
  if (goingDown) {
    laserY += 3;
    if (laserY >= bh - 2) goingDown = false;
  } else {
    laserY -= 3;
    if (laserY <= 0) goingDown = true;
  }

  // Draw new laser (cyan glow, 2px thick)
  tft.drawFastHLine(bx, by + laserY, 130, COL_ACCENT);
  tft.drawFastHLine(bx, by + laserY + 1, 130, ui_dimColor(COL_ACCENT, 0.5f));

  // Pulsing dots
  unsigned long t = millis();
  int cx = SCREEN_W / 2;
  for (int i = 0; i < 3; i++) {
    float phase = (float)((t + i * 400) % 1200) / 1200.0f;
    float v = 0.3f + 0.7f * sin(phase * 2.0f * PI);
    if (v < 0) v = 0;
    tft.fillCircle(cx - 15 + i * 15, 308, 4, ui_dimColor(COL_ACCENT, v));
  }
}

// ═════════════════════════════════════════════════════
//  STEP 5: Preparing PDF
// ═════════════════════════════════════════════════════

void scr_drawPreparingPdf() {
  tft.fillScreen(COL_BG);
  ui_drawGradientRect(0, 0, SCREEN_W, 4, COL_ACCENT2, COL_ACCENT);

  if (sData.scanLidError) {
    // Lid opened during scan/prepare! Show massive beautiful error card
    tft.fillRoundRect(15, 60, 210, 180, 12, COL_ERROR_DIM);
    tft.drawRoundRect(15, 60, 210, 180, 12, COL_ERROR);
    ui_drawCenteredText("LID OPEN ERROR!", 105, COL_TEXT, &FreeSansBold12pt7b);
    ui_drawCenteredText("Please close the lid", 145, COL_WARNING, &FreeSans9pt7b);
    ui_drawCenteredText("to complete document.", 170, COL_TEXT, &FreeSans9pt7b);
    ui_drawCenteredText("Keep lid fully closed!", 205, COL_TEXT_SEC, &FreeSans9pt7b);
    return;
  }

  ui_drawCenteredText("Preparing PDF...", 26, COL_ACCENT2, &FreeSansBold12pt7b);

  int cx = SCREEN_W / 2;

  // File icon in center
  ui_drawFileIcon(cx, 130, 45, COL_ACCENT2);

  // Gorgeous info card below icon
  tft.fillRoundRect(12, 230, 216, 68, 8, COL_BG_ELEVATED);
  tft.drawRoundRect(12, 230, 216, 68, 8, COL_ACCENT2);
  ui_drawCenteredText("Creating A4 PDF", 250, COL_TEXT_SEC, &FreeSans9pt7b);
  ui_drawCenteredText("Perfecting layout...", 274, COL_TEXT_DIM, &FreeSans9pt7b);
}

void scr_updatePreparingPdf() {
  static bool lastErrorState = false;
  if (sData.scanLidError != lastErrorState) {
    lastErrorState = sData.scanLidError;
    scr_drawPreparingPdf();
    return;
  }

  if (sData.scanLidError) {
    unsigned long t = millis();
    bool flash = ((t / 300) % 2) == 0;
    tft.drawRoundRect(15, 60, 210, 180, 12, flash ? COL_WARNING : COL_ERROR);
    return;
  }

  // Draw 8 spinner dots rotating horizontally/circularly
  int cx = SCREEN_W / 2, cy = 195;
  int r = 16;
  unsigned long t = millis();
  int activeStep = (t / 120) % 8;

  for (int i = 0; i < 8; i++) {
    float a = i * (2.0f * PI / 8.0f);
    int dx = (int)(r * cos(a));
    int dy = (int)(r * sin(a));
    int diff = (activeStep - i + 8) % 8;
    float bright = 1.0f - (diff / 8.0f) * 0.85f;
    tft.fillCircle(cx + dx, cy + dy, 4, ui_dimColor(COL_ACCENT2, bright));
  }
}

// ═════════════════════════════════════════════════════
//  STEP 6: Collect Your Document (Interactive MPU Flow)
// ═════════════════════════════════════════════════════

void scr_drawScanCollect() {
  tft.fillScreen(COL_BG);

  int cx = SCREEN_W / 2;

  if (!sData.collectLidOpened) {
    // Top warning banner
    tft.fillRoundRect(0, 0, SCREEN_W, 45, 0, COL_WARNING);
    tft.setFreeFont(&FreeSansBold12pt7b);
    tft.setTextColor(COL_BG, COL_WARNING);
    tft.setTextDatum(MC_DATUM);
    tft.drawString("ACTION REQUIRED", cx, 24);

    // Large animated doc icon at cy = 130
    ui_drawFileIcon(cx, 130, 55, COL_WARNING);

    // Gorgeous instruction card below icon
    tft.fillRoundRect(12, 220, 216, 78, 8, COL_BG_CARD);
    tft.drawRoundRect(12, 220, 216, 78, 8, COL_WARNING);
    ui_drawCenteredText("Please collect doc", 242, COL_TEXT, &FreeSansBold9pt7b);
    ui_drawCenteredText("from scanner glass.", 264, COL_TEXT, &FreeSansBold9pt7b);
    ui_drawCenteredText("Don't forget original!", 286, COL_TEXT_SEC, &FreeSans9pt7b);
  } else {
    // Top warning banner — Lid Open
    tft.fillRoundRect(0, 0, SCREEN_W, 45, 0, COL_SUCCESS);
    tft.setFreeFont(&FreeSansBold12pt7b);
    tft.setTextColor(COL_BG, COL_SUCCESS);
    tft.setTextDatum(MC_DATUM);
    tft.drawString("DOC COLLECTED", cx, 24);

    // Big scanner illustration showing lid open at cy = 182
    drawBigScannerBody(cx, 182, COL_BG_CARD, COL_ACCENT_DIM);

    // Gorgeous instruction card below scanner bed
    tft.fillRoundRect(12, 220, 216, 78, 8, COL_BG_CARD);
    tft.drawRoundRect(12, 220, 216, 78, 8, COL_SUCCESS);
    ui_drawCenteredText("Please close lid to", 242, COL_TEXT, &FreeSansBold9pt7b);
    ui_drawCenteredText("pay on your phone.", 264, COL_TEXT, &FreeSansBold9pt7b);
    ui_drawCenteredText("Thank you!", 286, COL_TEXT_SEC, &FreeSans9pt7b);
  }

  // Bottom tip
  ui_drawCenteredText("Press Home to cancel", SCREEN_H - 15, COL_TEXT_MUTED, 1);
}

void scr_updateScanCollect() {
  int cx = SCREEN_W / 2;
  float angle = sData.lidAngle;
  if (angle < 0) angle = 0;
  if (angle > 180) angle = 180;

  if (!sData.collectLidOpened) {
    // Flashing document icon
    unsigned long t = millis();
    bool flashOn = ((t / 500) % 2) == 0;
    uint16_t docColor = flashOn ? COL_WARNING : ui_dimColor(COL_WARNING, 0.25f);

    // Erase and redraw icon
    tft.fillRect(cx - 35, 95, 70, 80, COL_BG);
    ui_drawFileIcon(cx, 130, 55, docColor);

    // Upward arrow animation (document being lifted)
    int arrowOffset = (int)((t / 200) % 25);
    tft.fillRect(cx - 10, 65, 20, 28, COL_BG);
    uint16_t arrColor = flashOn ? COL_SUCCESS : ui_dimColor(COL_SUCCESS, 0.3f);
    tft.fillTriangle(cx, 65 - arrowOffset, cx - 10, 75 - arrowOffset, cx + 10, 75 - arrowOffset, arrColor);
    tft.fillRect(cx - 3, 75 - arrowOffset, 6, 12, arrColor);

    // Check if user has opened the lid > 10 degrees to collect the document!
    if (angle > 10.0f) {
      sData.collectLidOpened = true;
      scr_drawScanCollect();
      tone(PIN_BUZZER, 3500, 80);
    }
  } else {
    // Lid is currently open! Animate the big lid line
    static float lastDrawnAngle = -999.0f;
    bool angleChanged = (fabsf(angle - lastDrawnAngle) >= 1.0f);

    if (angleChanged) {
      uint16_t lidColor = (angle <= LID_CLOSE_ANGLE) ? COL_SUCCESS : COL_WARNING;

      // Erase lid sweep region cleanly (starts at y=60 so heading is untouched)
      tft.fillRect(35, 60, 170, 136, COL_BG);
      drawBigScannerBody(cx, 182, COL_BG_CARD, COL_ACCENT_DIM);
      
      float drawAngle = (angle > 90.0f) ? 90.0f : angle;
      if (drawAngle > 2.0f) {
        drawBigLidLine(cx, 182, drawAngle, lidColor);
      }

      lastDrawnAngle = angle;
    }

    // Check if user has closed the lid back (< 10 degrees) to complete the flow!
    if (angle <= LID_CLOSE_ANGLE) {
      // Done! Send signal to SerialBridge to show QR screen!
      lastDrawnAngle = -999.0f;
      scanReminderActive = false;
      sData.collectLidOpened = false;
      serial_sendTouch("home", "scan_collect_done");
      currentScreen = SCR_HOME;
      screenDirty = true;
      tone(PIN_BUZZER, 4000, 120);
    }
  }
}



// ═════════════════════════════════════════════════════
//  PRINT COMPLETE — Thank you
// ═════════════════════════════════════════════════════



void scr_drawComplete() {
  tft.fillScreen(COL_BG);

  // Decorative gradient lines
  ui_drawGradientRect(0, 0, SCREEN_W, 3, COL_SUCCESS, COL_ACCENT);

  // Big success circle with ring
  tft.drawCircle(SCREEN_W / 2, SCREEN_H / 2 - 30, 48, COL_SUCCESS);
  tft.drawCircle(SCREEN_W / 2, SCREEN_H / 2 - 30, 47, COL_SUCCESS);
  tft.fillCircle(SCREEN_W / 2, SCREEN_H / 2 - 30, 40, COL_SUCCESS_DIM);

  // Checkmark
  ui_drawCheckmark(SCREEN_W / 2, SCREEN_H / 2 - 30, 44, COL_TEXT);

  // "Print Complete!" text
  ui_drawCenteredText("Print Complete!", SCREEN_H / 2 + 30, COL_SUCCESS, &FreeSansBold12pt7b);

  // Thank you message
  ui_drawCenteredText("Collect your printout", SCREEN_H / 2 + 55, COL_TEXT_SEC, &FreeSans9pt7b);

  // "Returning to home..." at bottom
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_MUTED, COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("Returning to home...", SCREEN_W / 2, SCREEN_H - 30);

  // Bottom gradient
  ui_drawGradientRect(0, SCREEN_H - 3, SCREEN_W, 3, COL_ACCENT, COL_SUCCESS);
}

// ═════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════
//  TAMPER ALERT — Full red SOS screen
// ═════════════════════════════════════════════════════

void scr_drawTamperAlert() {
  tft.fillScreen(COL_ERROR);

  // Inner dark panel
  tft.fillRoundRect(20, 20, SCREEN_W - 40, SCREEN_H - 40, 12, COL_BG);
  tft.drawRoundRect(20, 20, SCREEN_W - 40, SCREEN_H - 40, 12, COL_ERROR);
  tft.drawRoundRect(22, 22, SCREEN_W - 44, SCREEN_H - 44, 10, COL_ERROR);

  // Warning triangle
  ui_drawWarningTriangle(SCREEN_W / 2, 65, 50, COL_ERROR);

  // "TAMPER DETECTED" flashing text
  tft.setFreeFont(&FreeSansBold18pt7b);
  tft.setTextColor(COL_ERROR);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("TAMPER", SCREEN_W / 2, 115);
  tft.drawString("DETECTED", SCREEN_W / 2, 145);

  // Lock icon + "DEVICE LOCKED"
  ui_drawLockIcon(SCREEN_W / 2, 175, 20, COL_ERROR);

  tft.setFreeFont(&FreeSansBold9pt7b);
  tft.setTextColor(COL_ERROR);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("DEVICE LOCKED", SCREEN_W / 2, 200);

  // SOS indicator
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_MUTED);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("SOS Alert Active - Notify Admin", SCREEN_W / 2, SCREEN_H - 30);
}

void scr_updateTamper() {
  // Flash the border between red and dark
  static bool flashState = false;
  static unsigned long lastFlash = 0;

  if (millis() - lastFlash > 500) {
    flashState = !flashState;
    lastFlash = millis();

    uint16_t borderColor = flashState ? COL_ERROR : COL_ERROR_DIM;
    tft.drawRoundRect(20, 20, SCREEN_W - 40, SCREEN_H - 40, 12, borderColor);
    tft.drawRoundRect(22, 22, SCREEN_W - 44, SCREEN_H - 44, 10, borderColor);

    // Flash "TAMPER DETECTED" visibility
    uint16_t textColor = flashState ? COL_ERROR : COL_ERROR_DIM;
    tft.setFreeFont(&FreeSansBold18pt7b);
    tft.setTextColor(textColor, COL_BG);
    tft.setTextDatum(MC_DATUM);
    tft.drawString("TAMPER", SCREEN_W / 2, 115);
    tft.drawString("DETECTED", SCREEN_W / 2, 145);
  }
}

// ═════════════════════════════════════════════════════
//  CALIBRATION — MPU-6050 calibration mode
// ═════════════════════════════════════════════════════

void scr_drawCalibration() {
  tft.fillScreen(COL_BG);

  // Title bar
  ui_drawGradientRect(0, 0, SCREEN_W, 3, COL_WARNING, COL_ACCENT);

  ui_drawCenteredText("MPU Calibration", 20, COL_WARNING, &FreeSansBold12pt7b);

  int step = sData.calStep;

  if (step == 1) {
    // Step 1: Close the lid
    ui_drawCenteredText("Step 1: Close the lid", CONTENT_Y + 25, COL_TEXT, &FreeSansBold9pt7b);
    ui_drawCenteredText("Close the scanner lid", CONTENT_Y + 50, COL_TEXT_SEC, &FreeSans9pt7b);
    ui_drawCenteredText("completely, then touch", CONTENT_Y + 68, COL_TEXT_SEC, &FreeSans9pt7b);

    // CALIBRATE button
    ui_drawButton(SCREEN_W / 2 - 70, CONTENT_Y + 95, 140, 40, "CALIBRATE",
                  COL_WARNING, COL_BG, &FreeSansBold9pt7b);

  } else if (step == 2) {
    // Step 2: Open the lid
    ui_drawCenteredText("Step 2: Open the lid", CONTENT_Y + 25, COL_TEXT, &FreeSansBold9pt7b);
    ui_drawCenteredText("Fully open the scanner", CONTENT_Y + 50, COL_TEXT_SEC, &FreeSans9pt7b);
    ui_drawCenteredText("lid, then touch", CONTENT_Y + 68, COL_TEXT_SEC, &FreeSans9pt7b);

    // CALIBRATE button
    ui_drawButton(SCREEN_W / 2 - 70, CONTENT_Y + 95, 140, 40, "CALIBRATE",
                  COL_ACCENT, COL_BG, &FreeSansBold9pt7b);

    // Show step 1 data
    char buf[40];
    snprintf(buf, sizeof(buf), "Closed: %.1f, %.1f, %.1f",
             calData.closedX, calData.closedY, calData.closedZ);
    tft.setFreeFont(NULL);
    tft.setTextSize(1);
    tft.setTextColor(COL_SUCCESS, COL_BG);
    tft.setTextDatum(MC_DATUM);
    tft.drawString(buf, SCREEN_W / 2, CONTENT_Y + 150);

  } else if (step == 3) {
    // Done!
    // Big checkmark
    tft.fillCircle(SCREEN_W / 2, CONTENT_Y + 60, 30, COL_SUCCESS_DIM);
    ui_drawCheckmark(SCREEN_W / 2, CONTENT_Y + 60, 34, COL_SUCCESS);

    ui_drawCenteredText("Calibration Complete!", CONTENT_Y + 105, COL_SUCCESS, &FreeSansBold12pt7b);

    char buf1[40], buf2[40];
    snprintf(buf1, sizeof(buf1), "Closed: %.1f, %.1f, %.1f",
             calData.closedX, calData.closedY, calData.closedZ);
    snprintf(buf2, sizeof(buf2), "Open:   %.1f, %.1f, %.1f",
             calData.openX, calData.openY, calData.openZ);

    tft.setFreeFont(NULL);
    tft.setTextSize(1);
    tft.setTextColor(COL_TEXT_SEC, COL_BG);
    tft.setTextDatum(MC_DATUM);
    tft.drawString(buf1, SCREEN_W / 2, CONTENT_Y + 135);
    tft.drawString(buf2, SCREEN_W / 2, CONTENT_Y + 150);

    ui_drawCenteredText("Returning to Home...", CONTENT_Y + 175, COL_TEXT_MUTED, 1);
  }

  // Bottom accent
  ui_drawGradientRect(0, SCREEN_H - 3, SCREEN_W, 3, COL_ACCENT, COL_WARNING);
}

void scr_updateCalibration() {
  // Nothing to animate for now
}


// ═════════════════════════════════════════════════════
//  RENDER DISPATCHER
// ═════════════════════════════════════════════════════

void scr_render(ScreenId screen) {
  switch (screen) {
    case SCR_SPLASH:         scr_drawSplash();        break;
    case SCR_HOME:           scr_drawHome();          break;
    case SCR_PRINT_SESSION:  scr_drawSessionConnect(); break;
    case SCR_UPLOADING:      scr_drawUploading();     break;
    case SCR_FILE_RECEIVED:  scr_drawFileReceived();  break;
    case SCR_PAYMENT_WAIT:   scr_drawPaymentWait();   break;
    case SCR_PAYMENT_OK:     scr_drawPaymentOk();     break;
    case SCR_PRINTING:       scr_drawPrinting();      break;
    case SCR_COMPLETE:       scr_drawComplete();      break;
    case SCR_TAMPER:         scr_drawTamperAlert();   break;
    case SCR_CALIBRATION:    scr_drawCalibration();   break;
    case SCR_ENGINEERING:    scr_drawEngineering();   break;
    case SCR_SYS_CHECK:      scr_drawSysCheck();      break;
    case SCR_PRINTER_OFFLINE: scr_drawPrinterOffline(); break;
    case SCR_OUT_OF_PAPER:   scr_drawOutOfPaper();    break;
    // ── Premium Scan Flow ──
    case SCR_SCAN_LID_OPEN:  scr_drawScanLidOpen();   break;
    case SCR_SCAN_PLACE_DOC: scr_drawScanPlaceDoc();  break;
    case SCR_SCAN_LID_CLOSE: scr_drawScanLidClose();  break;
    case SCR_SCANNING:       scr_drawScanning();      break;
    case SCR_PREPARING_PDF:  scr_drawPreparingPdf();  break;
    case SCR_SCAN_COLLECT:   scr_drawScanCollect();   break;
    default: break;
  }
}

// ═════════════════════════════════════════════════════
//  PRINTER OFFLINE SCREEN
// ═════════════════════════════════════════════════════

void scr_drawPrinterOffline() {
  tft.fillScreen(COL_BG);
  tft.fillRoundRect(20, 20, SCREEN_W - 40, SCREEN_H - 40, 10, COL_BTN_DANGER);
  tft.setTextColor(COL_BG);
  ui_drawCenteredText("PRINTER OFFLINE", SCREEN_H / 2 - 20, COL_BG, &FreeSansBold12pt7b);
  ui_drawCenteredText("Please check connection", SCREEN_H / 2 + 10, COL_BG, &FreeSansBold9pt7b);
}

// ═════════════════════════════════════════════════════
//  OUT OF PAPER / PRINTER ERROR SCREEN
// ═════════════════════════════════════════════════════

void scr_drawOutOfPaper() {
  tft.fillScreen(COL_BG);
  tft.fillRoundRect(10, 10, SCREEN_W - 20, SCREEN_H - 20, 12, COL_BG_CARD);
  tft.drawRoundRect(10, 10, SCREEN_W - 20, SCREEN_H - 20, 12, COL_ERROR);

  // Warning icon
  ui_drawWarningTriangle(SCREEN_W / 2, 50, 40, COL_ERROR);

  // Title
  tft.setFreeFont(&FreeSansBold12pt7b);
  tft.setTextColor(COL_ERROR, COL_BG_CARD);
  tft.setTextDatum(TC_DATUM);
  tft.drawString("OUT OF PAPER", SCREEN_W / 2, 82);

  // Subtitle / message
  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(COL_TEXT, COL_BG_CARD);
  tft.drawString("Printer Error!", SCREEN_W / 2, 115);

  // Money back explanation
  tft.setTextColor(COL_WARNING, COL_BG_CARD);
  tft.drawString("Your money has been", SCREEN_W / 2, 150);
  tft.drawString("refunded to your", SCREEN_W / 2, 175);
  tft.drawString("original payment", SCREEN_W / 2, 200);
  tft.drawString("method. We are sorry.", SCREEN_W / 2, 225);

  // Button instruction
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_SEC, COL_BG_CARD);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("Press physical button to exit", SCREEN_W / 2, SCREEN_H - 35);
}

void scr_update(ScreenId screen) {
  switch (screen) {
    case SCR_SPLASH:         scr_updateSplash();        break;
    case SCR_PAYMENT_WAIT:   scr_updatePaymentWait();   break;
    case SCR_PRINTING:       scr_updatePrinting();      break;
    case SCR_TAMPER:         scr_updateTamper();        break;
    case SCR_CALIBRATION:    scr_updateCalibration();   break;
    case SCR_ENGINEERING:    scr_updateEngineering();   break;
    case SCR_SYS_CHECK:      scr_updateSysCheck();      break;
    // ── Premium Scan Flow animations ──
    case SCR_SCAN_LID_OPEN:  scr_updateScanLidOpen();   break;
    case SCR_SCAN_PLACE_DOC: scr_updateScanPlaceDoc();  break;
    case SCR_SCAN_LID_CLOSE: scr_updateScanLidClose();  break;
    case SCR_SCANNING:       scr_updateScanning();      break;
    case SCR_PREPARING_PDF:  scr_updatePreparingPdf();  break;
    case SCR_SCAN_COLLECT:   scr_updateScanCollect();   break;
    default: break;
  }
}

// ═════════════════════════════════════════════════════
//  SYSTEM CHECK UI
// ═════════════════════════════════════════════════════

void scr_drawSysCheck() {
  tft.fillScreen(COL_BG);
  ui_drawCenteredText("System Diagnostics", CONTENT_CY - 80, COL_ACCENT, &FreeSansBold12pt7b);

  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(COL_TEXT);
  tft.setTextDatum(MC_DATUM);

  if (sData.sysCheckStep == 1) {
    tft.drawString("Checking Gyro (MPU)...", SCREEN_W / 2, CONTENT_CY);
  } else if (sData.sysCheckStep == 2) {
    ui_drawWarningTriangle(SCREEN_W / 2, CONTENT_CY - 30, 30, COL_WARNING);
    tft.setTextColor(COL_WARNING);
    tft.drawString("Press physical HOME button", SCREEN_W / 2, CONTENT_CY + 20);
    tft.drawString("to test button functionality", SCREEN_W / 2, CONTENT_CY + 40);
  }
}

void scr_updateSysCheck() {
  // Nothing to animate on this screen
}

// ═════════════════════════════════════════════════════
//  ENGINEERING MODE
// ═════════════════════════════════════════════════════

void scr_drawEngineering() {
  tft.fillScreen(COL_BG);
  
  ui_drawCenteredText("ENGINEERING MODE", 30, COL_WARNING, &FreeSansBold12pt7b);
  
  tft.drawLine(20, 50, SCREEN_W - 20, 50, COL_DIVIDER);
  
  // Data labels
  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(COL_TEXT_SEC);
  tft.setTextDatum(TL_DATUM);
  tft.drawString("Raw MPU Data:", 20, 70);
  tft.drawString("X: ", 20, 100);
  tft.drawString("Y: ", 20, 130);
  tft.drawString("Z: ", 20, 160);
  tft.drawString("Mag: ", 20, 190);
  
  // Single Calibration Button based on step
  int btnW = 140;
  int btnH = 40;
  int startX = (SCREEN_W - btnW) / 2;
  
  if (sData.calStep == 0) {
    ui_drawButton(startX, 210, btnW, btnH, "Set Closed", COL_BTN_PRINT, COL_TEXT, &FreeSansBold9pt7b);
  } else if (sData.calStep == 1) {
    ui_drawButton(startX, 210, btnW, btnH, "Set Open", COL_BTN_SCAN, COL_TEXT, &FreeSansBold9pt7b);
  } else {
    ui_drawButton(startX, 210, btnW, btnH, "Done!", COL_SUCCESS, COL_TEXT, &FreeSansBold9pt7b);
  }
  
  tft.setFreeFont(&FreeSans9pt7b);
  tft.setTextColor(COL_WARNING);
  tft.drawString("Press Pushbutton to Exit", SCREEN_W / 2, 280);
}

void scr_updateEngineering() {
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 200) return; // Update 5 times a second
  lastUpdate = millis();

  float ax, ay, az;
  mpu_getAccel(ax, ay, az);
  float mag = sqrt(ax*ax + ay*ay + az*az);

  // Clear previous values
  tft.fillRect(60, 85, 150, 130, COL_BG);

  tft.setFreeFont(&FreeSansBold9pt7b);
  tft.setTextColor(COL_TEXT);
  tft.setTextDatum(TL_DATUM);

  char buf[32];
  snprintf(buf, sizeof(buf), "%.2f", ax);
  tft.drawString(buf, 60, 100);
  
  snprintf(buf, sizeof(buf), "%.2f", ay);
  tft.drawString(buf, 60, 130);
  
  snprintf(buf, sizeof(buf), "%.2f", az);
  tft.drawString(buf, 60, 160);

  snprintf(buf, sizeof(buf), "%.2f g", mag);
  if (mag > 1.5) tft.setTextColor(COL_ERROR);
  tft.drawString(buf, 60, 190);

  float lidAngle = mpu_getLidAngle();
  if (sData.calStep == 2 && lidAngle != -1) {
    snprintf(buf, sizeof(buf), "Angle: %.1f deg", lidAngle);
    tft.setTextColor(COL_ACCENT);
    tft.setTextDatum(MC_DATUM);
    // Draw in the top middle
    tft.fillRect(0, 45, SCREEN_W, 30, COL_BG); 
    tft.drawString(buf, SCREEN_W / 2, 60);
  }
}
