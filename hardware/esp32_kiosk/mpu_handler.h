#ifndef MPU_HANDLER_H
#define MPU_HANDLER_H

// =====================================================
//  SmartPrint Station — MPU-6050 Handler
//  Tamper detection, lid angle, calibration
//  © Made with ❤ by Prince Tagadiya
// =====================================================

#include "config.h"
#include <Adafruit_MPU6050.h>

// ─── External References ────────────────────────────
extern Adafruit_MPU6050 mpu;
extern CalibrationData  calData;
extern bool             tamperDetected;
extern ScreenData       sData;

// ─── Initialization ─────────────────────────────────

// Initialize MPU-6050 sensor, returns true on success
bool mpu_init();

// Read and store baseline acceleration (call on boot)
void mpu_readBaseline();

// ─── Runtime Checks ─────────────────────────────────

// Check for tamper (call every MPU_READ_INTERVAL ms)
// Returns true if a new tamper event was just detected
bool mpu_checkTamper();

// Returns true if the device has been calm (no longer tampered)
// Note: This no longer automatically clears the tamper state. It only checks if it's calm.
bool mpu_checkTamperClear();

// Manually clear the tamper state (called via serial command from dashboard)
void mpu_clearTamper();

// Calculate current lid angle (degrees from closed position)
// Returns -1 if not calibrated
float mpu_getLidAngle();

// Get current acceleration values
void mpu_getAccel(float &ax, float &ay, float &az);

// ─── Calibration ────────────────────────────────────

// Store current readings as "lid closed" position
void mpu_calibrateClosed();

// Store current readings as "lid open" position
void mpu_calibrateOpen();

// Save calibration data to NVS (non-volatile storage)
void mpu_saveCalibration();

// Load calibration data from NVS
void mpu_loadCalibration();

// Clear calibration data
void mpu_clearCalibration();

// ─── State ──────────────────────────────────────────

// Whether MPU is available (init succeeded)
extern bool mpuAvailable;

// Baseline acceleration vector
extern float baseAX, baseAY, baseAZ;

// Time since tamper condition became calm
extern unsigned long tamperCalmSince;

#endif // MPU_HANDLER_H
