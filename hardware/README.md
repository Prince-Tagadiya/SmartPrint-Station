# SmartPrint Station Kiosk Hardware

This directory contains the firmware and documentation for the ESP32-based hardware interface of the SmartPrint Station Kiosk.

## Features
* **TFT Touchscreen (ILI9341 2.4" SPI)**: Provides the kiosk's user interface, displaying dynamic QR codes, progress bars, animations, and status information.
* **MPU-6050 Accelerometer/Gyro**: 
  * **Tamper Detection**: Monitors the kiosk for impacts or tilt. If triggered, locks the screen, sends an alert to the server, and sounds an SOS alarm.
  * **Scanner Lid Angle**: Determines the exact angle of the scanner lid and sends real-time states (open/closed) to the server to guide the user.
* **Push Button**: Serves as a physical Home/Cancel button to reset the session.
* **Piezo Buzzer**: Sounds a high-pitched 2.5kHz SOS morse-code pattern when tampering is detected.
* **USB Serial Protocol**: Communicates securely with the Next.js backend using a JSON protocol running at 115200 baud.

## Component List
| # | Component | Model / Spec | Qty |
|---|-----------|-------------|-----|
| 1 | Microcontroller | ESP32 DevKit V1 (38-pin) | 1 |
| 2 | TFT Display | 2.4" ILI9341 SPI 240×320 w/ XPT2046 Touch | 1 |
| 3 | IMU Sensor | MPU-6050 (GY-521 breakout) | 1 |
| 4 | Push Button | Tactile 12×12×17mm 4-pin | 1 |
| 5 | Buzzer | Active Piezo Buzzer 5V | 1 |
| 6 | Resistor | 10KΩ (pull-down for button - optional if using internal pullup) | 1 |

## Wiring Diagram

### ESP32 to TFT (SPI)
* **MOSI** → GPIO 23
* **MISO** → GPIO 19
* **SCK**  → GPIO 18
* **CS**   → GPIO 15
* **DC**   → GPIO 2
* **RST**  → GPIO 4
* **Touch CS** → GPIO 5
* **VCC/LED** → 3.3V
* **GND** → GND

### ESP32 to MPU-6050 (I2C)
* **SDA** → GPIO 21
* **SCL** → GPIO 22
* **VCC** → 3.3V
* **GND** → GND

### ESP32 to Buttons/Buzzer
* **Home Button** → GPIO 33 & GND (Uses `INPUT_PULLUP`)
* **Buzzer +** → GPIO 25
* **Buzzer -** → GND

## Installation

### 1. Arduino IDE Setup
Ensure you have the ESP32 board manager installed in the Arduino IDE. Select the **ESP32 Dev Module**.

### 2. Required Libraries
Install the following via the Arduino Library Manager:
* **TFT_eSPI** by Bodmer
* **Adafruit MPU6050** by Adafruit
* **Adafruit Unified Sensor** by Adafruit
* **ArduinoJson** by Benoît Blanchon (Make sure to use v7+)

### 3. TFT_eSPI Configuration (Crucial)
You **must** configure the TFT_eSPI library to know which pins your display uses. 
1. Navigate to your Arduino libraries folder: `Documents/Arduino/libraries/TFT_eSPI/`
2. Overwrite the `User_Setup.h` file with the `TFT_User_Setup.h` file provided in this folder.
3. This sets the driver to ILI9341 and assigns the correct SPI pins for this project.

### 4. Upload Firmware
1. Open `esp32_kiosk/esp32_kiosk.ino` in Arduino IDE.
2. Connect your ESP32 via USB.
3. Set Upload Speed to `921600` and Flash Frequency to `80MHz`.
4. Click Upload.

## MPU-6050 Calibration
To calibrate the MPU-6050 for lid detection:
1. Tap the 4 corners of the TFT screen sequentially: **Top-Right → Top-Left → Bottom-Left → Bottom-Right**.
2. The screen will enter Calibration Mode.
3. Follow the on-screen instructions to register the "Closed" and "Open" lid positions. The values are saved permanently in the ESP32's non-volatile memory (NVS).

## Server Communication
The Node.js server uses the `serialport` library to automatically detect and connect to the ESP32 over USB. If your Next.js application is running, the `SerialBridge` service will instantly establish the connection and begin coordinating UI updates on the TFT.
