#ifndef SCREENS_H
#define SCREENS_H

// =====================================================
//  SmartPrint Station — Screen Rendering
//  © Made with ❤ by Prince Tagadiya
// =====================================================

#include "config.h"

// ─── External State ─────────────────────────────────
extern ScreenId   currentScreen;
extern ScreenData sData;
extern CalibrationData calData;
extern bool       tamperDetected;
extern unsigned long screenTimer;
extern unsigned long splashStart;
extern bool screenDirty;
extern bool scanReminderActive;
extern unsigned long scanReminderStart;

// ─── Scan Flow State (shared with screens.cpp) ──────
extern unsigned long scanLidHoldStart;
extern bool          scanLidThresholdMet;

// ─── Screen Renderers (full redraw) ─────────────────

void scr_drawSplash();
void scr_drawHome();
void scr_drawSessionConnect();   // print_session QR
void scr_drawUploading();
void scr_drawFileReceived();
void scr_drawPaymentWait();
void scr_drawPaymentOk();
void scr_drawPrinting();
void scr_drawComplete();
void scr_drawTamperAlert();
void scr_drawCalibration();
void scr_drawEngineering();
void scr_drawSysCheck();
void scr_drawPrinterOffline();
void scr_drawOutOfPaper();

// ─── Premium Scan Flow renderers ────────────────────
void scr_drawScanLidOpen();    // Step 1: Open lid
void scr_drawScanPlaceDoc();   // Step 2: Place document
void scr_drawScanLidClose();   // Step 3: Close lid
void scr_drawScanning();       // Step 4: Scanning in progress
void scr_drawPreparingPdf();   // Step 5: Laptop generating PDF
void scr_drawScanCollect();    // Step 6: Collect document reminder

// ─── Render dispatcher ──────────────────────────────
void scr_render(ScreenId screen);

// ─── Animation updaters (called every frame) ────────
void scr_updateSplash();
void scr_updatePaymentWait();
void scr_updatePrinting();
void scr_updateTamper();
void scr_updateCalibration();
void scr_updateEngineering();
void scr_updateSysCheck();

// ─── Premium Scan Flow updaters ─────────────────────
void scr_updateScanLidOpen();
void scr_updateScanPlaceDoc();
void scr_updateScanLidClose();
void scr_updateScanning();
void scr_updatePreparingPdf();
void scr_updateScanCollect();

// ─── Per-frame update dispatcher ────────────────────
void scr_update(ScreenId screen);

#endif // SCREENS_H
