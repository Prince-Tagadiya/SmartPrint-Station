// =====================================================
//  SmartPrint Station — UI Drawing Utilities
//  © Made with ❤ by Prince Tagadiya
// =====================================================

#include "ui.h"

// ─────────────────────────────────────────────────────
//  COLOR UTILITIES
// ─────────────────────────────────────────────────────

uint16_t ui_rgb(uint8_t r, uint8_t g, uint8_t b) {
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

uint16_t ui_lerpColor(uint16_t c1, uint16_t c2, float t) {
  if (t <= 0.0f) return c1;
  if (t >= 1.0f) return c2;
  
  uint8_t r1 = (c1 >> 11) & 0x1F, g1 = (c1 >> 5) & 0x3F, b1 = c1 & 0x1F;
  uint8_t r2 = (c2 >> 11) & 0x1F, g2 = (c2 >> 5) & 0x3F, b2 = c2 & 0x1F;
  
  uint8_t r = r1 + (int)(t * (r2 - r1));
  uint8_t g = g1 + (int)(t * (g2 - g1));
  uint8_t b = b1 + (int)(t * (b2 - b1));
  
  return (r << 11) | (g << 5) | b;
}

uint16_t ui_dimColor(uint16_t color, float factor) {
  uint8_t r = ((color >> 11) & 0x1F) * factor;
  uint8_t g = ((color >> 5) & 0x3F) * factor;
  uint8_t b = (color & 0x1F) * factor;
  return (r << 11) | (g << 5) | b;
}

float ui_pulseValue(unsigned long speedMs) {
  float phase = (float)(millis() % speedMs) / (float)speedMs;
  // Smooth sine wave pulse between 0.3 and 1.0
  return 0.65f + 0.35f * sin(phase * 2.0f * PI);
}

// ─────────────────────────────────────────────────────
//  TEXT DRAWING
// ─────────────────────────────────────────────────────

void ui_drawCenteredText(const char* text, int y, uint16_t color, const GFXfont* font) {
  tft.setFreeFont(font);
  tft.setTextColor(color, COL_BG);
  tft.setTextDatum(TC_DATUM);
  tft.drawString(text, SCREEN_W / 2, y);
}

void ui_drawCenteredText(const char* text, int y, uint16_t color, uint8_t fontSize) {
  tft.setFreeFont(NULL);
  tft.setTextSize(fontSize);
  tft.setTextColor(color, COL_BG);
  tft.setTextDatum(TC_DATUM);
  tft.drawString(text, SCREEN_W / 2, y);
}

void ui_drawRightText(const char* text, int y, uint16_t color, uint8_t fontSize) {
  tft.setFreeFont(NULL);
  tft.setTextSize(fontSize);
  tft.setTextColor(color, COL_BG);
  tft.setTextDatum(TR_DATUM);
  tft.drawString(text, SCREEN_W - 8, y);
}

// ─────────────────────────────────────────────────────
//  BUTTON DRAWING
// ─────────────────────────────────────────────────────

void ui_drawButton(int x, int y, int w, int h, const char* label,
                   uint16_t bgColor, uint16_t textColor, const GFXfont* font) {
  // Shadow
  tft.fillRoundRect(x + 2, y + 2, w, h, BTN_RADIUS, COL_BG_CARD);
  // Button body
  tft.fillRoundRect(x, y, w, h, BTN_RADIUS, bgColor);
  // Subtle highlight on top edge
  tft.drawFastHLine(x + BTN_RADIUS, y + 1, w - BTN_RADIUS * 2,
                    ui_lerpColor(bgColor, COL_TEXT, 0.15f));
  // Label
  tft.setFreeFont(font);
  tft.setTextColor(textColor);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(label, x + w / 2, y + h / 2 + 2);
}

void ui_drawOutlineButton(int x, int y, int w, int h, const char* label,
                          uint16_t borderColor, uint16_t textColor, const GFXfont* font) {
  tft.fillRoundRect(x, y, w, h, BTN_RADIUS, COL_BG);
  tft.drawRoundRect(x, y, w, h, BTN_RADIUS, borderColor);
  tft.drawRoundRect(x + 1, y + 1, w - 2, h - 2, BTN_RADIUS - 1, borderColor);
  // Label
  tft.setFreeFont(font);
  tft.setTextColor(textColor);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(label, x + w / 2, y + h / 2 + 2);
}

// ─────────────────────────────────────────────────────
//  PROGRESS BAR
// ─────────────────────────────────────────────────────

void ui_drawProgressBar(int x, int y, int w, int h, int percent,
                        uint16_t fillColor, uint16_t bgColor) {
  percent = constrain(percent, 0, 100);
  int fillW = (w * percent) / 100;
  
  // Background track
  tft.fillRoundRect(x, y, w, h, h / 2, bgColor);
  
  // Fill
  if (fillW > h) {
    tft.fillRoundRect(x, y, fillW, h, h / 2, fillColor);
    // Shine highlight
    tft.drawFastHLine(x + h / 2, y + 1, fillW - h,
                      ui_lerpColor(fillColor, COL_TEXT, 0.25f));
  } else if (fillW > 0) {
    tft.fillCircle(x + h / 2, y + h / 2, h / 2, fillColor);
  }
}

// ─────────────────────────────────────────────────────
//  GRADIENT RECT
// ─────────────────────────────────────────────────────

void ui_drawGradientRect(int x, int y, int w, int h,
                         uint16_t colorStart, uint16_t colorEnd) {
  for (int i = 0; i < w; i++) {
    float t = (float)i / (float)(w - 1);
    uint16_t c = ui_lerpColor(colorStart, colorEnd, t);
    tft.drawFastVLine(x + i, y, h, c);
  }
}

// ─────────────────────────────────────────────────────
//  STATUS BAR & WATERMARK
// ─────────────────────────────────────────────────────

void ui_drawStatusDot(int x, int y, bool online, const char* label) {
  uint16_t dotColor = online ? COL_SUCCESS : COL_ERROR;
  // Outer glow
  tft.fillCircle(x, y, 5, ui_dimColor(dotColor, 0.3f));
  // Inner dot
  tft.fillCircle(x, y, 3, dotColor);
  // Label
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(COL_TEXT_SEC, COL_BG);
  tft.setTextDatum(ML_DATUM);
  tft.drawString(label, x + 10, y);
}

void ui_drawStatusBar(bool printerOnline) {
  // Status bar removed to save space
}

void ui_drawWatermark() {
  int y = SCREEN_H - WATERMARK_H + 4;
  tft.fillRect(0, y - 4, SCREEN_W, WATERMARK_H, COL_BG);
  
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(TFT_WHITE, COL_BG); // White text
  tft.setTextDatum(MC_DATUM);
  tft.drawString("Made with love by Prince", SCREEN_W / 2, y + 4);
}

void ui_clearContent() {
  tft.fillRect(0, STATUS_BAR_H + 2, SCREEN_W,
               SCREEN_H - STATUS_BAR_H - WATERMARK_H - 2, COL_BG);
}

// ─────────────────────────────────────────────────────
//  ICONS — Geometric shapes for kiosk display
// ─────────────────────────────────────────────────────

void ui_drawPrinterIcon(int cx, int cy, int size, uint16_t color) {
  int s = size / 2;
  
  // Paper sheet coming from top
  tft.fillRect(cx - s / 2, cy - s + 2, s, s / 2, color);
  tft.drawRect(cx - s / 2, cy - s + 2, s, s / 2, ui_dimColor(color, 0.7f));
  
  // Printer body
  tft.fillRoundRect(cx - s, cy - s / 3, s * 2, s, 4, color);
  
  // Paper output slot
  tft.fillRect(cx - s / 2 - 2, cy + s / 3, s + 4, 3, ui_dimColor(color, 0.5f));
  
  // Paper sheet coming out bottom
  tft.fillRect(cx - s / 2, cy + s / 3 + 2, s, s / 3, COL_TEXT);
  // Lines on paper
  for (int i = 0; i < 3; i++) {
    tft.drawFastHLine(cx - s / 3, cy + s / 3 + 5 + i * 3, s / 2, COL_TEXT_DIM);
  }
  
  // Status LED
  tft.fillCircle(cx + s - 5, cy - s / 6, 2, COL_SUCCESS);
}

void ui_drawScannerIcon(int cx, int cy, int size, uint16_t color) {
  int s = size / 2;
  
  // Scanner bed/base
  tft.fillRoundRect(cx - s, cy + s / 4, s * 2, s / 2, 4, color);
  
  // Scanner glass (cyan glow)
  tft.fillRect(cx - s + 4, cy + s / 4 + 2, s * 2 - 8, s / 2 - 4, COL_ACCENT_DIM);
  
  // Open lid (angled line)
  // Base of lid is at left side, angling up
  tft.fillTriangle(
    cx - s + 2, cy + s / 4,              // pivot
    cx - s + 4, cy + s / 4,
    cx + s - 10, cy - s + 5,             // top right
    color
  );
  tft.fillTriangle(
    cx - s + 2, cy + s / 4,              // pivot
    cx + s - 10, cy - s + 5,
    cx + s - 12, cy - s + 2,             // top edge thickness
    color
  );

  // Scanning laser line
  tft.drawFastVLine(cx, cy + s / 4 + 2, s / 2 - 4, COL_ACCENT);
  tft.drawFastVLine(cx + 1, cy + s / 4 + 2, s / 2 - 4, COL_ACCENT2);
}


void ui_drawCheckmark(int cx, int cy, int size, uint16_t color) {
  int s = size / 2;
  // Thick checkmark using multiple line passes
  for (int t = -2; t <= 2; t++) {
    tft.drawLine(cx - s, cy + t, cx - s / 4, cy + s / 2 + t, color);
    tft.drawLine(cx - s / 4, cy + s / 2 + t, cx + s, cy - s / 2 + t, color);
  }
}

void ui_drawWarningTriangle(int cx, int cy, int size, uint16_t color) {
  int s = size / 2;
  // Triangle outline
  tft.fillTriangle(cx, cy - s, cx - s, cy + s / 2, cx + s, cy + s / 2, color);
  // Inner dark triangle
  tft.fillTriangle(cx, cy - s + 6, cx - s + 6, cy + s / 2 - 3, cx + s - 6, cy + s / 2 - 3, COL_BG);
  // Exclamation mark
  tft.fillRect(cx - 1, cy - s / 4, 3, s / 2, color);
  tft.fillCircle(cx, cy + s / 4 + 2, 2, color);
}

void ui_drawPhoneIcon(int cx, int cy, int size, uint16_t color) {
  int s = size / 2;
  // Phone body
  tft.fillRoundRect(cx - s / 3, cy - s, s * 2 / 3, s * 2, 4, color);
  // Screen
  tft.fillRect(cx - s / 3 + 3, cy - s + 6, s * 2 / 3 - 6, s * 2 - 14, COL_BG_CARD);
  // Home button dot
  tft.fillCircle(cx, cy + s - 4, 2, ui_dimColor(color, 0.5f));
}

void ui_drawFileIcon(int cx, int cy, int size, uint16_t color) {
  int s = size / 2;
  int w = s * 2 / 3;
  int h = s;
  // Page body
  tft.fillRect(cx - w, cy - h, w * 2 - 4, h * 2, color);
  // Folded corner
  tft.fillTriangle(cx + w - 4, cy - h, cx + w - 4, cy - h + 6,
                   cx + w + 2, cy - h + 6, ui_dimColor(color, 0.6f));
  tft.fillRect(cx + w - 4, cy - h + 6, 6, 1, ui_dimColor(color, 0.6f));
  // Text lines
  for (int i = 0; i < 4; i++) {
    int lw = (i == 3) ? w : w + 4;
    tft.drawFastHLine(cx - w + 4, cy - h / 2 + 4 + i * 5, lw, ui_dimColor(color, 0.4f));
  }
}

void ui_drawHomeIcon(int cx, int cy, int size, uint16_t color) {
  int s = size / 2;
  // Roof triangle
  tft.fillTriangle(cx, cy - s, cx - s, cy, cx + s, cy, color);
  // House body
  tft.fillRect(cx - s + 4, cy, s * 2 - 8, s - 2, color);
  // Door
  tft.fillRect(cx - 3, cy + 2, 6, s - 4, COL_BG);
}

void ui_drawRupeeSymbol(int x, int y, uint16_t color, uint8_t fontSize) {
  tft.setFreeFont(NULL);
  tft.setTextSize(fontSize);
  tft.setTextColor(color);
  tft.setTextDatum(TL_DATUM);
  // Simple Rs. prefix since TFT can't render ₹ easily
  tft.drawString("Rs.", x, y);
}

void ui_drawLockIcon(int cx, int cy, int size, uint16_t color) {
  int s = size / 2;
  // Lock body
  tft.fillRoundRect(cx - s / 2, cy, s, s, 2, color);
  // Shackle
  tft.drawArc(cx, cy, s / 2 + 2, s / 2 - 1, 180, 360, color, COL_BG);
  // Keyhole
  tft.fillCircle(cx, cy + s / 3, 2, COL_BG);
  tft.fillRect(cx - 1, cy + s / 3, 2, s / 4, COL_BG);
}
