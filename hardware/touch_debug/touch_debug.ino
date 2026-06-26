#include <SPI.h>
#include <TFT_eSPI.h>

TFT_eSPI tft = TFT_eSPI();

void setup() {
  Serial.begin(115200);
  tft.init();
  
  // Set rotation to 0 (Portrait) so text fits exactly how you are holding it!
  tft.setRotation(0); 
  tft.fillScreen(TFT_BLACK);
  
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.drawString("Touch SPI Debugger", 10, 20, 2);
  tft.drawString("Open Serial Monitor", 10, 60, 2);
  tft.drawString("(115200 baud)", 10, 90, 2);
  tft.drawString("Press screen now...", 10, 140, 2);
  
  Serial.println("\n\n--- Touch SPI Debugger Started ---");
  Serial.println("If all values stay at 0 or 4095 when you press, your touch wires are incorrect!");
}

void loop() {
  uint16_t x = 0, y = 0;
  
  // Z is raw pressure from the SPI touch chip
  uint16_t z = tft.getTouchRawZ();
  
  // X and Y are raw coordinates
  tft.getTouchRaw(&x, &y);
  
  // Print to serial monitor every 0.5 seconds
  Serial.print("Pressure (Z): ");
  Serial.print(z);
  Serial.print("\tRaw X: ");
  Serial.print(x);
  Serial.print("\tRaw Y: ");
  Serial.println(y);
  
  delay(500);
}
