// =====================================================
//  SmartPrint Station — Serial JSON Protocol
//  Handles USB serial communication with Next.js server
//  © Made with ❤ by Prince Tagadiya
// =====================================================

#include "serial_comm.h"
#include <ArduinoJson.h>
#include "mpu_handler.h"
#include "screens.h"

// ─── Internal Buffer ────────────────────────────────
static char serialBuf[JSON_BUF_SIZE];
static int  serialBufPos = 0;
unsigned long lastSerialPingTime = 0;

// ─── Screen name lookup ────────────────────────────────
static const char* screenNames[] = {
  "splash", "home", "print_session", "uploading",
  "file_received", "payment_wait", "payment_ok",
  "printing", "complete", "tamper",
  "calibration", "engineering", "sys_check", "printer_offline",
  "out_of_paper",
  // Premium scan flow
  "scan_lid_open", "scan_place_doc", "scan_lid_close",
  "scanning", "preparing_pdf", "scan_collect"
};

// Map a screen name string to ScreenId enum
static ScreenId nameToScreen(const char* name) {
  for (int i = 0; i < SCR_COUNT; i++) {
    if (strcmp(name, screenNames[i]) == 0) return (ScreenId)i;
  }
  return SCR_HOME;  // default fallback
}

// ─────────────────────────────────────────────────────
//  INITIALIZATION
// ─────────────────────────────────────────────────────

void serial_init() {
  Serial.begin(SERIAL_BAUD);
  // Wait briefly for serial connection
  unsigned long start = millis();
  while (!Serial && millis() - start < 2000) {
    delay(10);
  }
  serialBufPos = 0;
}

// ─────────────────────────────────────────────────────
//  PROCESS INCOMING COMMAND
// ─────────────────────────────────────────────────────

static void processCommand(const char* line) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, line);

  if (err) {
    char buf[128];
    snprintf(buf, sizeof(buf), "{\"ev\":\"debug\",\"msg\":\"JSON parse failed: %s\"}", err.c_str());
    Serial.println(buf);
    return;
  }

  const char* cmd = doc["cmd"];
  if (!cmd) {
    char buf[128];
    snprintf(buf, sizeof(buf), "{\"ev\":\"debug\",\"msg\":\"No cmd found or parse error\"}");
    Serial.println(buf);
    return;
  }

  // Debug echo back
  char dbgBuf[128];
  snprintf(dbgBuf, sizeof(dbgBuf), "{\"ev\":\"debug\",\"msg\":\"Received cmd: %s\"}", cmd);
  Serial.println(dbgBuf);

  // We received a valid command, meaning the server is online
  lastSerialPingTime = millis();
  if (!sData.serverOnline) {
    sData.serverOnline = true;
    screenDirty = true;
    Serial.println("{\"ev\":\"debug\",\"msg\":\"Server heartbeat received -> ONLINE\"}");
  }

  // ── Screen Change Command ──
  if (strcmp(cmd, "screen") == 0) {
    JsonObject data = doc["data"];
    if (data.isNull()) return;

    const char* screenName = data["id"];
    if (!screenName) return;

    ScreenId newScreen = nameToScreen(screenName);

    // Extract screen-specific data
    if (!data.isNull()) {
      // Session code
      if (data.containsKey("code")) {
        strlcpy(sData.sessionCode, data["code"] | "", sizeof(sData.sessionCode));
      }
      // URL
      if (data.containsKey("url")) {
        strlcpy(sData.url, data["url"] | "", sizeof(sData.url));
      }
      // Filename
      if (data.containsKey("filename")) {
        strlcpy(sData.filename, data["filename"] | "", sizeof(sData.filename));
      }
      // Pages
      if (data.containsKey("pages")) {
        sData.pages = data["pages"] | 0;
      }
      // Total pages
      if (data.containsKey("total")) {
        sData.totalPages = data["total"] | 0;
      }
      // Cost
      if (data.containsKey("cost")) {
        sData.cost = data["cost"] | 0.0f;
      }
      // Progress
      if (data.containsKey("progress")) {
        sData.progress = data["progress"] | 0;
      }
      // Amount
      if (data.containsKey("amount")) {
        sData.amount = data["amount"] | 0.0f;
      }
      // Color mode
      if (data.containsKey("color")) {
        strlcpy(sData.colorMode, data["color"] | "B&W", sizeof(sData.colorMode));
      }
      // Duplex
      if (data.containsKey("duplex")) {
        strlcpy(sData.duplex, data["duplex"] | "", sizeof(sData.duplex));
      }
      // Orientation
      if (data.containsKey("orientation")) {
        strlcpy(sData.orientation, data["orientation"] | "", sizeof(sData.orientation));
      }
      // Sizing
      if (data.containsKey("sizing")) {
        strlcpy(sData.sizing, data["sizing"] | "fit", sizeof(sData.sizing));
      }
      // Copies
      if (data.containsKey("copies")) {
        sData.copies = data["copies"].as<int>();
      }
    }

    // Change screen
    currentScreen = newScreen;
    screenDirty = true;
    screenTimer = millis();

  } else if (strcmp(cmd, "status") == 0) {
    JsonObject data = doc["data"];
    if (!data.isNull()) {
      bool changed = false;
      if (data.containsKey("printer")) {
        bool pOnline = data["printer"].as<bool>();
        if (sData.printerOnline != pOnline) {
          sData.printerOnline = pOnline;
          changed = true;
        }
      }
      if (data.containsKey("scanner")) {
        bool sOnline = data["scanner"].as<bool>();
        if (sData.scannerOnline != sOnline) {
          sData.scannerOnline = sOnline;
          changed = true;
        }
      }
      if (changed) {
        screenDirty = true;
      }
    }
  }

  // ── Ink Levels Command ──
  else if (strcmp(cmd, "ink") == 0) {
    JsonObject data = doc["data"];
    if (!data.isNull()) {
      sData.inkC = data["c"] | 0;
      sData.inkM = data["m"] | 0;
      sData.inkY = data["y"] | 0;
      sData.inkK = data["k"] | 0;
    }
  }

  // ── Status Update Command ──
  else if (strcmp(cmd, "status") == 0) {
    JsonObject data = doc["data"];
    if (!data.isNull()) {
      bool newPrinter = data["printer"] | false;
      if (sData.printerOnline != newPrinter) {
        sData.printerOnline = newPrinter;

        // Redraw if on home screen to update status dots
        if (currentScreen == SCR_HOME || currentScreen == SCR_FILE_RECEIVED) {
          screenDirty = true;
        }
      }
    }
  }

  // ── Progress Update (partial, no full redraw) ──
  else if (strcmp(cmd, "progress") == 0) {
    JsonObject data = doc["data"];
    if (!data.isNull()) {
      sData.progress = data["progress"] | sData.progress;
      sData.pages = data["page"] | sData.pages;
      sData.totalPages = data["total"] | sData.totalPages;
      // Don't set screenDirty — use update loop for smooth animation
    }
  }

  // ── Ping/Pong ──
  else if (strcmp(cmd, "ping") == 0) {
    Serial.println("{\"ev\":\"pong\"}");
  }

  // ── Resolve Tamper ──
  else if (strcmp(cmd, "resolve_tamper") == 0) {
    mpu_clearTamper();
    currentScreen = SCR_HOME;
    screenDirty = true;
    digitalWrite(PIN_BUZZER, LOW);
  }

  // ── Scan Reminder ──
  else if (strcmp(cmd, "scan_reminder") == 0) {
    // Show the "collect your document" reminder screen
    currentScreen = SCR_SCAN_COLLECT;
    scanReminderActive = true;
    scanReminderStart = millis();
    sData.collectLidOpened = false;
    screenDirty = true;
  }
}

// ─────────────────────────────────────────────────────
//  READ SERIAL (call in loop)
// ─────────────────────────────────────────────────────

bool serial_read() {
  bool processed = false;

  while (Serial.available()) {
    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      if (serialBufPos > 0) {
        serialBuf[serialBufPos] = '\0';
        processCommand(serialBuf);
        serialBufPos = 0;
        processed = true;
      }
    } else {
      if (serialBufPos < JSON_BUF_SIZE - 1) {
        serialBuf[serialBufPos++] = c;
      } else {
        // Buffer overflow, reset
        serialBufPos = 0;
      }
    }
  }

  return processed;
}

// ─────────────────────────────────────────────────────
//  SEND EVENTS
// ─────────────────────────────────────────────────────

void serial_sendRaw(const char* json) {
  Serial.println(json);
}

void serial_sendTouch(const char* screen, const char* button) {
  char buf[96];
  snprintf(buf, sizeof(buf),
    "{\"ev\":\"touch\",\"screen\":\"%s\",\"btn\":\"%s\"}",
    screen, button);
  Serial.println(buf);
}

void serial_sendButton(const char* button) {
  char buf[48];
  snprintf(buf, sizeof(buf), "{\"ev\":\"button\",\"btn\":\"%s\"}", button);
  Serial.println(buf);
}

void serial_sendHeartbeat() {
  char buf[48];
  snprintf(buf, sizeof(buf), "{\"ev\":\"heartbeat\",\"uptime\":%lu}", millis() / 1000);
  Serial.println(buf);
}

void serial_sendBoot() {
  char buf[48];
  snprintf(buf, sizeof(buf), "{\"ev\":\"boot\",\"fw\":\"%s\"}", FW_VERSION);
  Serial.println(buf);
}

void serial_sendTamper(float ax, float ay, float az, float deviation) {
  char buf[96];
  snprintf(buf, sizeof(buf),
    "{\"ev\":\"tamper\",\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f,\"dev\":%.2f}",
    ax, ay, az, deviation);
  Serial.println(buf);
}

void serial_sendTamperClear() {
  Serial.println("{\"ev\":\"tamper_clear\"}");
}



void serial_sendCalStart() {
  Serial.println("{\"ev\":\"cal_start\"}");
}

void serial_sendCalClosed(float ax, float ay, float az) {
  char buf[80];
  snprintf(buf, sizeof(buf),
    "{\"ev\":\"cal_closed\",\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f}", ax, ay, az);
  Serial.println(buf);
}

void serial_sendCalOpen(float ax, float ay, float az) {
  char buf[80];
  snprintf(buf, sizeof(buf),
    "{\"ev\":\"cal_open\",\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f}", ax, ay, az);
  Serial.println(buf);
}

void serial_sendCalDone() {
  Serial.println("{\"ev\":\"cal_done\"}");
}
