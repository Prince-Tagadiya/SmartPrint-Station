// =====================================================
//  ███████╗███╗   ███╗ █████╗ ██████╗ ████████╗
//  ██╔════╝████╗ ████║██╔══██╗██╔══██╗╚══██╔══╝
//  ███████╗██╔████╔██║███████║██████╔╝   ██║
//  ╚════██║██║╚██╔╝██║██╔══██║██╔══██╗   ██║
//  ███████║██║ ╚═╝ ██║██║  ██║██║  ██║   ██║
//  ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝
//
//  SmartPrint Station — ESP32 Kiosk Firmware
//  Hardware: ESP32 + ILI9341 TFT + XPT2046 Touch
//            + MPU-6050 + Push Button + Buzzer
//
//  © Made with ❤ by Prince Tagadiya
//  Version: 1.0.0
// =====================================================
//
//  REQUIRED LIBRARIES (install via Arduino Library Manager):
//  1. TFT_eSPI        by Bodmer
//  2. Adafruit MPU6050 by Adafruit
//  3. Adafruit Unified Sensor by Adafruit
//  4. ArduinoJson     by Benoît Blanchon (v7+)
//
//  IMPORTANT: Copy TFT_User_Setup.h to your TFT_eSPI
//  library folder as "User_Setup.h" before compiling!
//
//  BOARD: Select "ESP32 Dev Module" in Arduino IDE
//  Upload Speed: 921600
//  Flash Freq: 80MHz
// =====================================================

#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <SPI.h>
#include <TFT_eSPI.h>
#include "qrcode.h"
#include <Wire.h>

#include "config.h"
#include "mpu_handler.h"
#include "screens.h"
#include "serial_comm.h"
#include "ui.h"

// ═════════════════════════════════════════════════════
//  GLOBAL OBJECTS
// ═════════════════════════════════════════════════════

TFT_eSPI tft = TFT_eSPI();
Adafruit_MPU6050 mpu;

// ─── State ──────────────────────────────────────────

ScreenId currentScreen = SCR_SPLASH;
ScreenData sData;
CalibrationData calData;
bool screenDirty = true;
bool tamperDetected = false;
bool scanReminderActive = false;
unsigned long scanReminderStart = 0;
unsigned long screenTimer = 0;
unsigned long splashStart = 0;

// ─── Scan Flow State ────────────────────────────────
unsigned long scanLidHoldStart = 0; // when lid crossed the threshold angle
bool scanLidThresholdMet = false;   // whether lid is currently at threshold

// ─── Timing ─────────────────────────────────────────

static unsigned long lastMpuCheck = 0;
static unsigned long lastHeartbeat = 0;
static unsigned long lastTouchTime = 0;
static unsigned long lastButtonTime = 0;
static unsigned long lastAnimFrame = 0;
static unsigned long lastLidSend = 0;

// ─── Calibration Corner Tracking ────────────────────

static int calCornerIndex = 0;
static unsigned long calCornerTime = 0;
static bool inCalCornerSequence = false;

// ─── Button State ───────────────────────────────────

static bool lastButtonState = HIGH; // INPUT_PULLUP, so HIGH = not pressed

// ─── Lid State Tracking ─────────────────────────────

static bool lastLidOpen = false;

// ─── SOS Buzzer State ───────────────────────────────

static int sosStep = 0;
static unsigned long sosTimer = 0;
// SOS pattern: ··· ─── ···  (3 short, 3 long, 3 short)
// Pattern durations: dot=150ms, dash=400ms, gap=150ms, letter_gap=300ms,
// word_gap=700ms

// ─── Touch Calibration Data ─────────────────────────
// Calibration for ST7789 + XPT2046 in landscape (rotation 1)
static uint16_t touchCalData[5] = { 208, 3660, 229, 3507, 1 };

// ═════════════════════════════════════════════════════
//  SETUP
// ═════════════════════════════════════════════════════

void setup() {
  // ── Serial ──
  serial_init();

  // ── TFT Display ──
  tft.init();
  tft.setRotation(TFT_ROTATION);
  tft.fillScreen(COL_BG);
  
  // ── Touch Calibration Prompt ──
  pinMode(PIN_BUTTON, INPUT_PULLUP); // Setup early for prompt
  tft.setFreeFont(NULL);
  tft.setTextSize(1);
  tft.setTextColor(TFT_WHITE, COL_BG);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("Hold Home Button now", SCREEN_W/2, SCREEN_H/2 - 20);
  tft.drawString("to calibrate touch!", SCREEN_W/2, SCREEN_H/2 + 20);

  uint32_t calTimer = millis();
  bool doCal = false;
  while(millis() - calTimer < 3000) {
    if (digitalRead(PIN_BUTTON) == LOW) {
      doCal = true;
      break;
    }
    delay(50);
  }

  Preferences prefs;
  prefs.begin("touch", false);

  if (doCal) {
    tft.fillScreen(TFT_BLACK);
    uint16_t tCalData[5];
    tft.calibrateTouch(tCalData, TFT_WHITE, TFT_BLACK, 15);
    tft.setTouch(tCalData);
    prefs.putBytes("calData", tCalData, sizeof(tCalData));
  } else {
    uint16_t tCalData[5];
    if (prefs.getBytes("calData", tCalData, sizeof(tCalData)) == sizeof(tCalData)) {
      tft.setTouch(tCalData);
    } else {
      tft.setTouch(touchCalData);
    }
  }
  prefs.end();

  // ── MPU-6050 ──
  mpu_init();
  delay(100);
  mpu_readBaseline();

  // ── Button ──
  pinMode(PIN_BUTTON, INPUT_PULLUP);

  // ── Buzzer ──
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // ── Initialize screen data ──
  memset(&sData, 0, sizeof(sData));
  // Default online so buttons are always touchable even before server connects
  sData.printerOnline = true;
  sData.scannerOnline = true;
  sData.serverOnline  = false; // server must heartbeat to become online
  strcpy(sData.colorMode, "B&W");
  strcpy(sData.sizing, "fit");
  strcpy(sData.sessionCode, "------");

  // ── Send boot event ──
  serial_sendBoot();

  // ── Start on system check screen ──
  currentScreen = SCR_SYS_CHECK;
  sData.sysCheckStep = 1;
  screenDirty = true;
  screenTimer = millis();
  
  // ── Flush RX buffer to prevent corrupted JSON on boot ──
  while(Serial.available()) {
    Serial.read();
  }
}

// ═════════════════════════════════════════════════════
//  MAIN LOOP
// ═════════════════════════════════════════════════════

void loop() {
  unsigned long now = millis();

  // ─── 0. System Check Logic ────────────────────────
  if (currentScreen == SCR_SYS_CHECK) {
    if (sData.sysCheckStep == 1 && now - screenTimer > 1000) {
      if (mpuAvailable) {
        sData.sysCheckStep = 2;
        screenDirty = true;
      }
    }
  }

  // ─── 0.1 Printer Offline Override ─────────────────
  if (!sData.printerOnline && currentScreen != SCR_SYS_CHECK && currentScreen != SCR_TAMPER && currentScreen != SCR_ENGINEERING && currentScreen != SCR_CALIBRATION) {
    if (currentScreen != SCR_PRINTER_OFFLINE) {
      currentScreen = SCR_PRINTER_OFFLINE;
      screenDirty = true;
    }
  } else if (sData.printerOnline && currentScreen == SCR_PRINTER_OFFLINE) {
    currentScreen = SCR_HOME; // Recovery state
    screenDirty = true;
  }

  // ─── 1. Read Serial Commands ──────────────────────
  serial_read();

  if (sData.serverOnline && millis() - lastSerialPingTime > 5000) {
    sData.serverOnline = false;
    screenDirty = true;
    Serial.println("{\"ev\":\"debug\",\"msg\":\"Server timeout -> OFFLINE\"}");
  }

  // ─── 2. Check MPU-6050 ────────────────────────────
  if (now - lastMpuCheck >= MPU_READ_INTERVAL) {
    lastMpuCheck = now;

    if (mpuAvailable) {
      // Read Lid angle every cycle while calibrated
      if (calData.isCalibrated) {
        sData.lidAngle = mpu_getLidAngle();

        // If on HOME screen and lid opens > 10 degrees, automatically start scan flow!
        if (currentScreen == SCR_HOME && sData.lidAngle > 10.0f && sData.scannerOnline) {
          Serial.println("{\"ev\":\"debug\",\"msg\":\"Lid opened on home screen -> Auto starting scan mode\"}");
          scanLidHoldStart = 0;
          scanLidThresholdMet = false;
          currentScreen = SCR_SCAN_LID_OPEN;
          screenDirty = true;
        }

        // Check if user opens lid in between the scan or preparing pdf
        if (currentScreen == SCR_SCANNING || currentScreen == SCR_PREPARING_PDF) {
          if (sData.lidAngle > 15.0f) {
            if (!sData.scanLidError) {
              sData.scanLidError = true;
              screenDirty = true;
            }
            tone(PIN_BUZZER, 1000, 100);
          } else {
            if (sData.scanLidError) {
              sData.scanLidError = false;
              screenDirty = true;
            }
          }
        }

        // Scan collect reminder stays active until user opens lid >10 deg and closes it back.
        // Handled in scr_updateScanCollect() via screens.cpp
      }

      // Tamper detection (skip during calibration, printing, out of paper, and all scan-flow screens)
      bool inScanFlow = (currentScreen == SCR_SCAN_LID_OPEN ||
                         currentScreen == SCR_SCAN_PLACE_DOC ||
                         currentScreen == SCR_SCAN_LID_CLOSE ||
                         currentScreen == SCR_SCANNING ||
                         currentScreen == SCR_PREPARING_PDF ||
                         currentScreen == SCR_SCAN_COLLECT ||
                         currentScreen == SCR_OUT_OF_PAPER);
      if (currentScreen != SCR_CALIBRATION &&
          currentScreen != SCR_ENGINEERING &&
          currentScreen != SCR_PRINT_SESSION &&
          currentScreen != SCR_PRINTING &&
          !inScanFlow) {
        if (mpu_checkTamper()) {
          // Tamper detected — switch to tamper screen
          if (currentScreen != SCR_TAMPER) {
            currentScreen = SCR_TAMPER;
            screenDirty = true;
            sosStep = 0;
            sosTimer = now;
          }
        }
      }
    }
  }

  // ─── 3. Check Home Button ─────────────────────────
  static unsigned long buttonPressStart = 0;
  bool buttonState = digitalRead(PIN_BUTTON);
  
  if (buttonState == LOW) {
    if (lastButtonState == HIGH) {
      // Just pressed
      buttonPressStart = now;
    } else if (buttonPressStart != 0 && now - buttonPressStart >= 3000) {
      // Long press triggers Engineering Mode
      sData.calStep = 0; // Reset calibration step
      currentScreen = SCR_ENGINEERING;
      screenDirty = true;
      tone(PIN_BUZZER, 3000, 200);
      buttonPressStart = 0; // Prevent re-triggering
    }
  } else {
    if (lastButtonState == LOW && buttonPressStart != 0) {
      // Released before long press -> Normal Home Action
      if (now - buttonPressStart >= BUTTON_DEBOUNCE) {
        serial_sendButton("home");
        
        if (currentScreen == SCR_ENGINEERING) {
          // Push button saves and exits from Engineering Mode
          mpu_saveCalibration();
          tone(PIN_BUZZER, 3000, 200);
          currentScreen = SCR_HOME;
          screenDirty = true;
        } else if (currentScreen == SCR_SCAN_LID_OPEN ||
                   currentScreen == SCR_SCAN_PLACE_DOC ||
                   currentScreen == SCR_SCAN_LID_CLOSE ||
                   currentScreen == SCR_SCAN_COLLECT) {
          // Cancel scan flow and return home
          scanLidHoldStart = 0;
          scanLidThresholdMet = false;
          scanReminderActive = false;
          currentScreen = SCR_HOME;
          screenDirty = true;
        } else if (currentScreen == SCR_OUT_OF_PAPER) {
          // Exit out of paper screen upon button press
          currentScreen = SCR_HOME;
          screenDirty = true;
        } else {
          // Navigate to home (unless tampered or in sys check)
          if (currentScreen == SCR_SYS_CHECK && sData.sysCheckStep == 2) {
            tone(PIN_BUZZER, 2000, 500);
            currentScreen = SCR_SPLASH;
            splashStart = millis();
            screenDirty = true;
          } else if (!tamperDetected && currentScreen != SCR_SYS_CHECK) {
            currentScreen = SCR_HOME;
            screenDirty = true;
          }

          if (currentScreen == SCR_TAMPER) {
            mpu_clearTamper();
            currentScreen = SCR_HOME;
            screenDirty = true;
          }
        }
      }
    }
    buttonPressStart = 0;
  }
  lastButtonState = buttonState;

  // ─── 4. Check Touch ───────────────────────────────
  uint16_t raw_tx, raw_ty;
  bool touched = tft.getTouch(&raw_tx, &raw_ty);
  
  // Directly use touch coordinates matching rotation 1
  uint16_t tx = raw_tx;
  uint16_t ty = raw_ty;
  static bool wasTouched = false;

  if (touched) {
    if (!wasTouched && now - lastTouchTime >= TOUCH_DEBOUNCE) {
      lastTouchTime = now;
      if (currentScreen != SCR_PRINTER_OFFLINE) {
        tone(PIN_BUZZER, 4000, 50); // Feedback beep
        handleTouch(tx, ty);
      }
    }
    wasTouched = true;
  } else {
    wasTouched = false;
  }

  // ─── 5. Screen Timeouts ───────────────────────────

  // Splash → Home after SPLASH_DURATION
  if (currentScreen == SCR_SPLASH && now - splashStart >= SPLASH_DURATION) {
    currentScreen = SCR_HOME;
    screenDirty = true;
  }

  // Complete → Home after COMPLETE_TIMEOUT
  if (currentScreen == SCR_COMPLETE && now - screenTimer >= COMPLETE_TIMEOUT) {
    currentScreen = SCR_HOME;
    screenDirty = true;
  }

  // Calibration step 3 (done) → Home after 3s
  if (currentScreen == SCR_CALIBRATION && sData.calStep == 3 &&
      now - screenTimer >= 3000) {
    currentScreen = SCR_HOME;
    screenDirty = true;
  }

  // ─── 6. Render Screen ─────────────────────────────
  if (screenDirty) {
    scr_render(currentScreen);
    screenDirty = false;
  }

  // ─── 7. Animation Updates ─────────────────────────
  if (now - lastAnimFrame >= ANIM_FRAME_INTERVAL) {
    lastAnimFrame = now;
    scr_update(currentScreen);
  }

  // ─── 8. SOS Buzzer (during tamper) ────────────────
  if (tamperDetected) {
    runSOSBuzzer();
  }

  // ─── 9. Heartbeat ─────────────────────────────────
  if (now - lastHeartbeat >= 1000) {
    lastHeartbeat = now;
    serial_sendHeartbeat();
  }
}

// ═════════════════════════════════════════════════════
//  TOUCH HANDLER
// ═════════════════════════════════════════════════════

void handleTouch(uint16_t tx, uint16_t ty) {
  // ── Calibration corner detection (any screen) ─────
  checkCalibrationCorners(tx, ty);

  // ── Screen-specific touch handling ────────────────
  switch (currentScreen) {

  case SCR_HOME: {
    int topY = 20;
    int btnH = 120;
    int printY = topY;
    int scanY = topY + btnH + 20;
    
    if (ty >= printY && ty <= printY + btnH) {
      if (sData.printerOnline) {
        serial_sendTouch("home", "print");
        tft.drawRoundRect(20, printY, SCREEN_W - 40, btnH, 12, COL_TEXT);
      }
    } else if (ty >= scanY && ty <= scanY + btnH) {
      if (sData.scannerOnline) {
        tft.drawRoundRect(20, scanY, SCREEN_W - 40, btnH, 12, COL_TEXT);
        // Start premium MPU-driven scan flow
        scanLidHoldStart = 0;
        scanLidThresholdMet = false;
        currentScreen = SCR_SCAN_LID_OPEN;
        screenDirty = true;
      }
    }
    break;
  }

  case SCR_FILE_RECEIVED: {
    // Static display, no touch interaction needed.
    break;
  }

  case SCR_PAYMENT_OK: {
    // Static display, auto-advances to printing
    break;
  }


  case SCR_CALIBRATION: {
    // Touch the CALIBRATE button
    int calBtnX = SCREEN_W / 2 - 70;
    int calBtnY = CONTENT_Y + 95;
    int calBtnW = 140, calBtnH = 40;

    if (tx >= calBtnX && tx <= calBtnX + calBtnW && ty >= calBtnY &&
        ty <= calBtnY + calBtnH) {

      if (sData.calStep == 1) {
        // Calibrate closed position
        mpu_calibrateClosed();
        sData.calStep = 2;
        screenDirty = true;
        screenTimer = millis();
      } else if (sData.calStep == 2) {
        // Calibrate open position
        mpu_calibrateOpen();
        mpu_saveCalibration();
        sData.calStep = 3;
        screenDirty = true;
        screenTimer = millis();
        serial_sendCalDone();
      }
    }
    break;
  }

  case SCR_ENGINEERING: {
    // Anywhere on the screen triggers the calibration steps!
    if (sData.calStep == 0) {
      mpu_calibrateClosed();
      tone(PIN_BUZZER, 2000, 50);
      sData.calStep = 1;
      screenDirty = true;
    } else if (sData.calStep == 1) {
      mpu_calibrateOpen();
      tone(PIN_BUZZER, 2000, 50);
      sData.calStep = 2;
      screenDirty = true;
    }
    break;
  }

  case SCR_SYS_CHECK: {
    // Step 3 (buzzer check) was removed. No touch actions on this screen.
    break;
  }

  default:
    break;
  }
}

// ═════════════════════════════════════════════════════
//  CALIBRATION CORNER SEQUENCE
// ═════════════════════════════════════════════════════
//
//  Touch order: Top-Right → Top-Left → Bottom-Left → Bottom-Right
//  Each corner must be touched within CAL_CORNER_TIMEOUT of the previous
//

void checkCalibrationCorners(uint16_t tx, uint16_t ty) {
  unsigned long now = millis();

  // Reset if too much time between touches
  if (inCalCornerSequence && now - calCornerTime > CAL_CORNER_TIMEOUT) {
    calCornerIndex = 0;
    inCalCornerSequence = false;
  }

  bool isCorner = false;
  int expectedCorner = calCornerIndex;

  switch (expectedCorner) {
  case 0: // Top-Right
    isCorner = (tx > SCREEN_W - CORNER_MARGIN && ty < CORNER_MARGIN);
    break;
  case 1: // Top-Left
    isCorner = (tx < CORNER_MARGIN && ty < CORNER_MARGIN);
    break;
  case 2: // Bottom-Left
    isCorner = (tx < CORNER_MARGIN && ty > SCREEN_H - CORNER_MARGIN);
    break;
  case 3: // Bottom-Right
    isCorner = (tx > SCREEN_W - CORNER_MARGIN && ty > SCREEN_H - CORNER_MARGIN);
    break;
  }

  if (isCorner) {
    calCornerIndex++;
    calCornerTime = now;
    inCalCornerSequence = true;

    // All 4 corners touched! Enter calibration mode
    if (calCornerIndex >= CAL_CORNER_COUNT) {
      calCornerIndex = 0;
      inCalCornerSequence = false;

      // Enter calibration screen
      sData.calStep = 1;
      currentScreen = SCR_CALIBRATION;
      screenDirty = true;
      screenTimer = millis();

      serial_sendCalStart();

      // Beep to confirm
      tone(PIN_BUZZER, 2000, 200);
    } else {
      // Short beep for corner confirmation
      tone(PIN_BUZZER, 1000 + calCornerIndex * 500, 100);
    }
  }
}

// ═════════════════════════════════════════════════════
//  SOS BUZZER PATTERN
// ═════════════════════════════════════════════════════
//
//  Morse SOS: ··· ─── ···
//  3 dots, 3 dashes, 3 dots, then pause, repeat
//

void runSOSBuzzer() {
  unsigned long now = millis();

  // SOS sequence: 18 steps (9 on + 9 off) + word gap
  // Pattern: dot on, gap, dot on, gap, dot on, letter_gap,
  //          dash on, gap, dash on, gap, dash on, letter_gap,
  //          dot on, gap, dot on, gap, dot on, word_gap

  // Total steps in one SOS cycle
  static const int SOS_STEPS = 18;

  // Step durations and states
  struct SOSElement {
    unsigned long duration;
    bool buzzerOn;
  };

  static const SOSElement pattern[] = {
      // ··· (S)
      {SOS_DOT_MS, true},
      {SOS_GAP_MS, false},
      {SOS_DOT_MS, true},
      {SOS_GAP_MS, false},
      {SOS_DOT_MS, true},
      {SOS_LETTER_GAP_MS, false},
      // ─── (O)
      {SOS_DASH_MS, true},
      {SOS_GAP_MS, false},
      {SOS_DASH_MS, true},
      {SOS_GAP_MS, false},
      {SOS_DASH_MS, true},
      {SOS_LETTER_GAP_MS, false},
      // ··· (S)
      {SOS_DOT_MS, true},
      {SOS_GAP_MS, false},
      {SOS_DOT_MS, true},
      {SOS_GAP_MS, false},
      {SOS_DOT_MS, true},
      {SOS_WORD_GAP_MS, false},
  };

  if (now - sosTimer >= pattern[sosStep].duration) {
    sosTimer = now;
    sosStep = (sosStep + 1) % SOS_STEPS;

    if (pattern[sosStep].buzzerOn) {
      tone(PIN_BUZZER, 2500); // 2.5kHz alarm tone
    } else {
      noTone(PIN_BUZZER);
    }
  }
}
