#ifndef SERIAL_COMM_H
#define SERIAL_COMM_H

// =====================================================
//  SmartPrint Station — Serial JSON Protocol
//  Handles USB serial communication with Next.js server
//  © Made with ❤ by Prince Tagadiya
// =====================================================

#include "config.h"

// ─── External State ─────────────────────────────────
extern ScreenId   currentScreen;
extern ScreenData sData;
extern bool       screenDirty;
extern unsigned long screenTimer;
extern unsigned long lastSerialPingTime;

// ─── Initialization ─────────────────────────────────

// Setup serial communication
void serial_init();

// ─── Receive (call in loop) ─────────────────────────

// Read and process any incoming serial commands
// Returns true if a command was processed
bool serial_read();

// ─── Send Events ────────────────────────────────────

// Send a raw JSON string over serial (adds newline)
void serial_sendRaw(const char* json);

// Send a touch event
void serial_sendTouch(const char* screen, const char* button);

// Send a button press event
void serial_sendButton(const char* button);

// Send heartbeat with uptime
void serial_sendHeartbeat();

// Send boot event
void serial_sendBoot();

// Send tamper event
void serial_sendTamper(float ax, float ay, float az, float deviation);

// Send tamper cleared
void serial_sendTamperClear();



// Send calibration events
void serial_sendCalStart();
void serial_sendCalClosed(float ax, float ay, float az);
void serial_sendCalOpen(float ax, float ay, float az);
void serial_sendCalDone();

#endif // SERIAL_COMM_H
