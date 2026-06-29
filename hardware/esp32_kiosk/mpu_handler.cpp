// =====================================================
//  SmartPrint Station — MPU-6050 Handler
//  Tamper detection, lid angle, calibration
//  © Made with ❤ by Prince Tagadiya
// =====================================================

#include "mpu_handler.h"
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Preferences.h>
#include <math.h>

// ─── Global State ───────────────────────────────────

bool  mpuAvailable = false;
float baseAX = 0, baseAY = 0, baseAZ = 9.8f;
unsigned long tamperCalmSince = 0;

// Preferences namespace for NVS storage
static Preferences prefs;

// ─────────────────────────────────────────────────────
//  INITIALIZATION
// ─────────────────────────────────────────────────────

bool mpu_init() {
  Wire.begin(MPU_SDA, MPU_SCL);

  if (!mpu.begin(0x68, &Wire)) {
    Serial.println("{\"ev\":\"error\",\"msg\":\"MPU-6050 not found\"}");
    mpuAvailable = false;
    return false;
  }

  // Configure MPU ranges
  mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu.setGyroRange(MPU6050_RANGE_250_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_5_HZ);  // 5Hz kills MEMS noise without lag

  mpuAvailable = true;
  Serial.println("{\"ev\":\"info\",\"msg\":\"MPU-6050 initialized\"}");

  // Load calibration from NVS
  mpu_loadCalibration();

  return true;
}

void mpu_readBaseline() {
  if (!mpuAvailable) return;

  float sumX = 0, sumY = 0, sumZ = 0;

  // Take multiple samples and average
  for (int i = 0; i < MPU_BASELINE_SAMPLES; i++) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    sumX += a.acceleration.x;
    sumY += a.acceleration.y;
    sumZ += a.acceleration.z;
    delay(10);
  }

  baseAX = sumX / MPU_BASELINE_SAMPLES;
  baseAY = sumY / MPU_BASELINE_SAMPLES;
  baseAZ = sumZ / MPU_BASELINE_SAMPLES;

  char buf[80];
  snprintf(buf, sizeof(buf),
    "{\"ev\":\"mpu_baseline\",\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f}",
    baseAX, baseAY, baseAZ);
  Serial.println(buf);
}

// ─────────────────────────────────────────────────────
//  CURRENT ACCELERATION
// ─────────────────────────────────────────────────────

void mpu_getAccel(float &ax, float &ay, float &az) {
  if (!mpuAvailable) {
    ax = 0; ay = 0; az = 9.8f;
    return;
  }

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  ax = a.acceleration.x;
  ay = a.acceleration.y;
  az = a.acceleration.z;
}

// ─────────────────────────────────────────────────────
//  TAMPER DETECTION
// ─────────────────────────────────────────────────────

bool mpu_checkTamper() {
  if (!mpuAvailable) return false;

  float ax, ay, az;
  mpu_getAccel(ax, ay, az);

  // Calculate baseline resting magnitude to account for fixed sensor zero-g offset errors
  float baseMag = sqrtf(baseAX * baseAX + baseAY * baseAY + baseAZ * baseAZ);

  // Use magnitude deviation to detect small bumps/slides while ignoring smooth lid opening rotations
  float mag = sqrtf(ax * ax + ay * ay + az * az);
  float deviation = abs(mag - baseMag);

  if (deviation > TAMPER_THRESHOLD) {
    // Check if this acceleration spike is due to a fast scanner lid opening motion
    if (calData.isCalibrated) {
      float dot = ax * calData.closedX + ay * calData.closedY + az * calData.closedZ;
      float magCurr = sqrtf(ax * ax + ay * ay + az * az);
      float magCal = sqrtf(calData.closedX * calData.closedX +
                           calData.closedY * calData.closedY +
                           calData.closedZ * calData.closedZ);
      if (magCurr >= 0.1f && magCal >= 0.1f) {
        float cosAngle = constrain(dot / (magCurr * magCal), -1.0f, 1.0f);
        float rawDeg = acosf(cosAngle) * 180.0f / PI;
        // If raw angle is > 5.0 degrees, the user is opening the scanner lid fast! Ignore tamper spike.
        if (rawDeg > 5.0f) {
          return false;
        }
      }
    }

    if (!tamperDetected) {
      // New tamper event!
      tamperDetected = true;
      tamperCalmSince = 0;

      char buf[100];
      snprintf(buf, sizeof(buf),
        "{\"ev\":\"tamper\",\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f,\"dev\":%.2f}",
        ax, ay, az, deviation);
      Serial.println(buf);

      return true;
    }
  } else {
    // Acceleration is within normal range
    if (tamperDetected && tamperCalmSince == 0) {
      tamperCalmSince = millis();
    }
  }

  return false;
}

bool mpu_checkTamperClear() {
  if (!tamperDetected) return false;
  if (tamperCalmSince == 0) return false;

  // Just return true if it has been calm for TAMPER_CLEAR_TIME ms
  if (millis() - tamperCalmSince > TAMPER_CLEAR_TIME) {
    return true;
  }

  // Check if there was another spike (reset calm timer)
  float ax, ay, az;
  mpu_getAccel(ax, ay, az);
  float baseMag = sqrtf(baseAX * baseAX + baseAY * baseAY + baseAZ * baseAZ);
  float mag = sqrtf(ax * ax + ay * ay + az * az);
  float deviation = abs(mag - baseMag);

  if (deviation > TAMPER_THRESHOLD) {
    tamperCalmSince = 0;  // Reset — still tampered
  }

  return false;
}

void mpu_clearTamper() {
  if (!tamperDetected) return;
  
  tamperDetected = false;
  tamperCalmSince = 0;

  // Re-read baseline after tamper clears (device may have moved)
  mpu_readBaseline();

  Serial.println("{\"ev\":\"tamper_clear\"}");
}

// ─────────────────────────────────────────────────────
//  LID ANGLE DETECTION
// ─────────────────────────────────────────────────────

float mpu_getLidAngle() {
  if (!mpuAvailable || !calData.isCalibrated) return -1.0f;

  float ax, ay, az;
  mpu_getAccel(ax, ay, az);

  // Calculate angle between current vector and "closed" calibration vector
  // using dot product: cos(θ) = (A · B) / (|A| × |B|)
  float dot = ax * calData.closedX + ay * calData.closedY + az * calData.closedZ;
  float magCurr = sqrtf(ax * ax + ay * ay + az * az);
  float magCal = sqrtf(calData.closedX * calData.closedX +
                       calData.closedY * calData.closedY +
                       calData.closedZ * calData.closedZ);

  if (magCurr < 0.1f || magCal < 0.1f) return 0.0f;

  float cosAngle = dot / (magCurr * magCal);
  // Clamp to prevent acos domain errors
  cosAngle = constrain(cosAngle, -1.0f, 1.0f);

  float rawDeg = acosf(cosAngle) * 180.0f / PI;

  // ── Exponential Moving Average (EMA) low-pass filter ──
  // Alpha = 0.15 → strong smoothing (~6-7 sample memory)
  // Eliminates ±2° MEMS noise → stable ±0.2° display.
  static float smoothedAngle = -1.0f;
  static const float ALPHA = 0.15f;
  if (smoothedAngle < 0.0f) {
    // First call: seed with raw value
    smoothedAngle = rawDeg;
  } else {
    smoothedAngle = ALPHA * rawDeg + (1.0f - ALPHA) * smoothedAngle;
  }

  if (smoothedAngle <= 3.0f) {
    return 0.0f;
  }
  return smoothedAngle;
}

// ─────────────────────────────────────────────────────
//  CALIBRATION
// ─────────────────────────────────────────────────────

void mpu_calibrateClosed() {
  if (!mpuAvailable) return;

  // Take average of multiple readings
  float sumX = 0, sumY = 0, sumZ = 0;
  for (int i = 0; i < MPU_BASELINE_SAMPLES; i++) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    sumX += a.acceleration.x;
    sumY += a.acceleration.y;
    sumZ += a.acceleration.z;
    delay(10);
  }

  calData.closedX = sumX / MPU_BASELINE_SAMPLES;
  calData.closedY = sumY / MPU_BASELINE_SAMPLES;
  calData.closedZ = sumZ / MPU_BASELINE_SAMPLES;

  char buf[80];
  snprintf(buf, sizeof(buf),
    "{\"ev\":\"cal_closed\",\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f}",
    calData.closedX, calData.closedY, calData.closedZ);
  Serial.println(buf);
}

void mpu_calibrateOpen() {
  if (!mpuAvailable) return;

  float sumX = 0, sumY = 0, sumZ = 0;
  for (int i = 0; i < MPU_BASELINE_SAMPLES; i++) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    sumX += a.acceleration.x;
    sumY += a.acceleration.y;
    sumZ += a.acceleration.z;
    delay(10);
  }

  calData.openX = sumX / MPU_BASELINE_SAMPLES;
  calData.openY = sumY / MPU_BASELINE_SAMPLES;
  calData.openZ = sumZ / MPU_BASELINE_SAMPLES;
  calData.isCalibrated = true;

  char buf[80];
  snprintf(buf, sizeof(buf),
    "{\"ev\":\"cal_open\",\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f}",
    calData.openX, calData.openY, calData.openZ);
  Serial.println(buf);
}

void mpu_saveCalibration() {
  prefs.begin("kiosk_cal", false);  // read-write mode
  prefs.putFloat("cl_x", calData.closedX);
  prefs.putFloat("cl_y", calData.closedY);
  prefs.putFloat("cl_z", calData.closedZ);
  prefs.putFloat("op_x", calData.openX);
  prefs.putFloat("op_y", calData.openY);
  prefs.putFloat("op_z", calData.openZ);
  prefs.putBool("calibrated", calData.isCalibrated);
  prefs.end();

  Serial.println("{\"ev\":\"cal_saved\"}");
}

void mpu_loadCalibration() {
  prefs.begin("kiosk_cal", true);  // read-only mode
  calData.isCalibrated = prefs.getBool("calibrated", false);
  if (calData.isCalibrated) {
    calData.closedX = prefs.getFloat("cl_x", 0.0f);
    calData.closedY = prefs.getFloat("cl_y", 0.0f);
    calData.closedZ = prefs.getFloat("cl_z", 9.8f);
    calData.openX   = prefs.getFloat("op_x", 0.0f);
    calData.openY   = prefs.getFloat("op_y", 0.0f);
    calData.openZ   = prefs.getFloat("op_z", 0.0f);

    char buf[80];
    snprintf(buf, sizeof(buf),
      "{\"ev\":\"cal_loaded\",\"closed\":[%.1f,%.1f,%.1f],\"open\":[%.1f,%.1f,%.1f]}",
      calData.closedX, calData.closedY, calData.closedZ,
      calData.openX, calData.openY, calData.openZ);
    Serial.println(buf);
  } else {
    Serial.println("{\"ev\":\"cal_loaded\",\"status\":\"not_calibrated\"}");
  }
  prefs.end();
}

void mpu_clearCalibration() {
  prefs.begin("kiosk_cal", false);
  prefs.clear();
  prefs.end();

  calData.isCalibrated = false;
  calData.closedX = calData.closedY = calData.closedZ = 0;
  calData.openX = calData.openY = calData.openZ = 0;

  Serial.println("{\"ev\":\"cal_cleared\"}");
}
