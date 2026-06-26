#include <SPI.h>
#include <TFT_eSPI.h>

TFT_eSPI tft = TFT_eSPI();

void setup() {
  Serial.begin(115200);
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.drawCentreString("Touch Drawing Test", tft.width()/2, 20, 2);
  tft.drawCentreString("Draw anywhere!", tft.width()/2, 60, 2);
}

void loop() {
  uint16_t x = 0, y = 0;
  
  // We use getTouchRaw to get uncalibrated data directly from the touch chip
  // This bypasses calibration entirely so we can see if the hardware is working
  if (tft.getTouchRaw(&x, &y)) {
    // Very roughly map the raw X/Y to the screen dimensions (320x240)
    // Typical XPT2046 raw values range from ~300 to ~3800
    int screenX = map(x, 300, 3800, 0, 320);
    int screenY = map(y, 300, 3800, 0, 240);
    
    // Draw a green dot where touched
    tft.fillCircle(screenX, screenY, 4, TFT_GREEN);
    
    // Print to serial monitor
    Serial.print("Touch registered! Raw X: ");
    Serial.print(x);
    Serial.print(" | Raw Y: ");
    Serial.println(y);
    
    // Small delay to prevent drawing a million dots per second
    delay(10);
  }
}
