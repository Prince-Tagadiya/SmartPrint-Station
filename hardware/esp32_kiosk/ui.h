#ifndef UI_H
#define UI_H

// =====================================================
//  SmartPrint Station — UI Drawing Utilities
//  © Made with ❤ by Prince Tagadiya
// =====================================================



#include <TFT_eSPI.h>
#include "config.h"

// ─── External TFT Reference ────────────────────────
extern TFT_eSPI tft;

// ─────────────────────────────────────────────────────

// Draw centered text at (x, y) with given font size
void ui_drawCenteredText(const char* text, int y, uint16_t color, const GFXfont* font);
void ui_drawCenteredText(const char* text, int y, uint16_t color, uint8_t fontSize);

// Draw right-aligned text
void ui_drawRightText(const char* text, int y, uint16_t color, uint8_t fontSize);

// Draw a rounded button with label
void ui_drawButton(int x, int y, int w, int h, const char* label,
                   uint16_t bgColor, uint16_t textColor, const GFXfont* font);

// Draw an outlined button
void ui_drawOutlineButton(int x, int y, int w, int h, const char* label,
                          uint16_t borderColor, uint16_t textColor, const GFXfont* font);

// Draw progress bar
void ui_drawProgressBar(int x, int y, int w, int h, int percent,
                        uint16_t fillColor, uint16_t bgColor);

// Draw a gradient-filled rounded rect (horizontal gradient)
void ui_drawGradientRect(int x, int y, int w, int h, uint16_t colorStart, uint16_t colorEnd);

// Draw status dot with label
void ui_drawStatusDot(int x, int y, bool online, const char* label);

// Draw the "© Made with ❤ by Prince Tagadiya" watermark
void ui_drawWatermark();

// Draw the top status bar
void ui_drawStatusBar(bool printerOnline);

// Clear content area (below status bar, above watermark)
void ui_clearContent();

// ─── Icon Drawing ───────────────────────────────────

// Printer icon (geometric)
void ui_drawPrinterIcon(int cx, int cy, int size, uint16_t color);

/**
 * @brief Draws a flat, stylized scanner icon
 */
void ui_drawScannerIcon(int cx, int cy, int size, uint16_t color);



// Checkmark icon
void ui_drawCheckmark(int cx, int cy, int size, uint16_t color);

// Warning triangle icon
void ui_drawWarningTriangle(int cx, int cy, int size, uint16_t color);

// Phone icon
void ui_drawPhoneIcon(int cx, int cy, int size, uint16_t color);

// File/document icon
void ui_drawFileIcon(int cx, int cy, int size, uint16_t color);

// Home icon
void ui_drawHomeIcon(int cx, int cy, int size, uint16_t color);

// Rupee symbol
void ui_drawRupeeSymbol(int x, int y, uint16_t color, uint8_t fontSize);

// Lock icon
void ui_drawLockIcon(int cx, int cy, int size, uint16_t color);

// ─── Color Utilities ────────────────────────────────

// Interpolate between two RGB565 colors (t = 0.0 to 1.0)
uint16_t ui_lerpColor(uint16_t c1, uint16_t c2, float t);

// Create an RGB565 color from 8-bit components
uint16_t ui_rgb(uint8_t r, uint8_t g, uint8_t b);

// Dim a color by factor (0.0 = black, 1.0 = unchanged)
uint16_t ui_dimColor(uint16_t color, float factor);

// Pulsing brightness for animations (returns 0.3 to 1.0 based on millis)
float ui_pulseValue(unsigned long speedMs);

#endif // UI_H
