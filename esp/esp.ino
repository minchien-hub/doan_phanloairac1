#include <Arduino.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <FirebaseESP32.h>
#include <math.h>

// =====================================================
// WIFI & FIREBASE CONFIG
// =====================================================
#define WIFI_SSID "Wi-MESH - HCMUTE"
#define WIFI_PASSWORD "hcmute@2024"

#define FIREBASE_HOST "waste-ai-5606c-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH ""

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// =====================================================
// 1. UART RASPBERRY PI <-> ESP32
// =====================================================
#define RXD2 16
#define TXD2 17
#define UART_BAUD 115200

String piBuffer = "";
String usbBuffer = "";

// =====================================================
// 2. A4988 + NEMA17
// =====================================================
#define STEP_PIN 25
#define DIR_PIN 26
#define ENABLE_PIN 27

#define MOTOR_STEPS 200
#define MICROSTEPS 4
const long STEPS_PER_REV = MOTOR_STEPS * MICROSTEPS;

#define STEP_DELAY_US 3000
#define MOTOR_SETTLE_MS 200

// GOC QUAY CAC NGAN
#define ANGLE_ORGANIC       45
#define ANGLE_RECYCLE      135
#define ANGLE_NONRECYCLE  -135
#define ANGLE_HAZARDOUS    -45

// =====================================================
// 3. SERVO 1 - DONG / MO CUA
// =====================================================
#define SERVO1_PIN 18
#define SERVO1_CLOSE_ANGLE 0
#define SERVO1_OPEN_ANGLE 90

// =====================================================
// 4. SERVO 2 - CHOT KHOA
// =====================================================
#define SERVO2_PIN 4
#define SERVO2_UNLOCK_ANGLE 0
#define SERVO2_LOCK_ANGLE 90

#define SERVO1_MOVE_MS 700
#define SERVO2_MOVE_MS 500
#define DROP_WAIT_MS 1000

Servo servo1;
Servo servo2;

// =====================================================
// 5. CAM BIEN HC-SR04
// =====================================================
#define SENSOR_COUNT 4

const uint8_t trigPins[SENSOR_COUNT] = {32, 19, 15, 22};
const uint8_t echoPins[SENSOR_COUNT] = {35, 21, 2, 23};

const char* binNames[SENSOR_COUNT] = {
  "HUU CO",
  "TAI CHE",
  "KHO PHAN HUY",
  "NGUY HAI"
};

#define EMPTY_DISTANCE_CM 55.0f
#define FULL_DISTANCE_CM  10.0f

#define WARNING_LEVEL 80
#define FULL_LEVEL 95

#define SENSOR_INTERVAL 2000UL
#define ECHO_TIMEOUT_US 25000UL

unsigned long lastSensorTime = 0;
unsigned long lastControlCheckTime = 0;

float distances[SENSOR_COUNT] = {-1, -1, -1, -1};
int fillPercent[SENSOR_COUNT] = {-1, -1, -1, -1};

// =====================================================
// 6. GUI PHAN HOI UART
// =====================================================
void sendResponse(const String &message) {
  Serial2.println(message);
  Serial.println(message);
}

// =====================================================
// 7. DOI GOC SANG SO BUOC
// =====================================================
long angleToSteps(float angle) {
  return lroundf(angle * STEPS_PER_REV / 360.0f);
}

// =====================================================
// 8. DIEU KHIEN NEMA17
// =====================================================
void rotateMotor(long steps) {
  if (steps == 0) return;
  digitalWrite(ENABLE_PIN, LOW);
  digitalWrite(DIR_PIN, steps > 0 ? HIGH : LOW);
  delay(10);

  long totalSteps = labs(steps);
  for (long i = 0; i < totalSteps; i++) {
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(STEP_PIN, LOW);
    delayMicroseconds(STEP_DELAY_US);
  }
}

// =====================================================
// SERVO CONTROLS
// =====================================================
void unlockDoor() {
  servo2.write(SERVO2_UNLOCK_ANGLE);
  delay(SERVO2_MOVE_MS);
}

void lockDoor() {
  servo2.write(SERVO2_LOCK_ANGLE);
  delay(SERVO2_MOVE_MS);
}

void openDoor() {
  servo1.write(SERVO1_OPEN_ANGLE);
  delay(SERVO1_MOVE_MS);
}

void closeDoor() {
  servo1.write(SERVO1_CLOSE_ANGLE);
  delay(SERVO1_MOVE_MS);
}

void dropWaste() {
  unlockDoor();
  openDoor();
  delay(DROP_WAIT_MS);
  closeDoor();
  lockDoor();
}

// =====================================================
// HC-SR04 & FIREBASE UPDATE
// =====================================================
float readDistanceCM(int index) {
  if (index < 0 || index >= SENSOR_COUNT) return -1;

  digitalWrite(trigPins[index], LOW);
  delayMicroseconds(2);
  digitalWrite(trigPins[index], HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPins[index], LOW);

  unsigned long duration = pulseIn(echoPins[index], HIGH, ECHO_TIMEOUT_US);
  if (duration == 0) return -1;

  float distance = duration * 0.0343f / 2.0f;
  if (distance < 2 || distance > 400) return -1;

  return distance;
}

int calculateFillPercent(float distance) {
  float percent = (EMPTY_DISTANCE_CM - distance) * 100.0f / (EMPTY_DISTANCE_CM - FULL_DISTANCE_CM);
  percent = constrain(percent, 0.0f, 100.0f);
  return (int)roundf(percent);
}

void updateFirebaseData(int index, int percent, float dist, String status, bool sensorOk) {
  if (Firebase.ready()) {
    String binTypes[4] = {"organic", "recycle", "non_recycle", "hazardous"};
    String path = "/smart_bin/bins/" + binTypes[index];
    
    Firebase.setInt(fbdo, path + "/fill_percent", percent);
    Firebase.setFloat(fbdo, path + "/distance_cm", dist);
    Firebase.setString(fbdo, path + "/status", status);
    Firebase.setBool(fbdo, path + "/sensor_ok", sensorOk);
  }
}

// Hàm đẩy thông báo lỗi phần cứng lên Firebase
void reportHardwareError(String errorMsg) {
  if (Firebase.ready()) {
    String notifPath = "/smart_bin/notifications";
    FirebaseJson json;
    json.set("title", "⚠️ Lỗi Phần Cứng Hệ Thống");
    json.set("desc", errorMsg);
    json.set("date", "2026-06-06"); // Hoặc cập nhật thời gian thực
    json.set("time", "Hệ thống");
    json.set("color", "#c62828");
    json.set("icon", "alert-circle-outline");
    Firebase.push(fbdo, notifPath, json);
  }
}

void checkOneBin(int index) {
  if (index < 0 || index >= SENSOR_COUNT) return;

  float total = 0;
  int validCount = 0;

  for (int i = 0; i < 3; i++) {
    float d = readDistanceCM(index);
    if (d > 0) {
      total += d;
      validCount++;
    }
    delay(60);
  }

  if (validCount == 0) {
    distances[index] = -1;
    fillPercent[index] = -1;
    sendResponse("LEVEL:" + String(index + 1) + ",ERROR");
    updateFirebaseData(index, -1, -1, "ERROR", false);
    
    // Gửi cảnh báo lỗi cảm biến lên hệ thống
    reportHardwareError("Cảm biến HC-SR04 ở ngăn " + String(binNames[index]) + " không phản hồi (Lỗi phần cứng)!");
    return;
  }

  distances[index] = total / validCount;
  fillPercent[index] = calculateFillPercent(distances[index]);

  String status;
  if (fillPercent[index] >= FULL_LEVEL) {
    status = "FULL";
  } else if (fillPercent[index] >= WARNING_LEVEL) {
    status = "WARNING";
  } else {
    status = "NORMAL";
  }

  // Cập nhật trạng thái bình thường lên Firebase
  updateFirebaseData(index, fillPercent[index], distances[index], status, true);

  String message = "LEVEL:" + String(index + 1) + "," + String(fillPercent[index]) + "," + String(distances[index], 1) + "," + status;
  sendResponse(message);
}

void checkAllBins() {
  for (int i = 0; i < SENSOR_COUNT; i++) {
    checkOneBin(i);
    delay(70);
  }
}

// Lắng nghe lệnh điều khiển Servo từ App thông qua nhánh /smart_bin/control
void checkFirebaseControl() {
  if (Firebase.ready()) {
    if (Firebase.getString(fbdo, "/smart_bin/control/command")) {
      String cmd = fbdo.stringData();
      // Đọc xong xóa node lệnh để tránh lặp lại
      Firebase.deleteNode(fbdo, "/smart_bin/control/command");

      cmd.trim();
      cmd.toUpperCase();

      if (cmd == "OPEN") {
        unlockDoor();
        openDoor();
        sendResponse("DOOR:OPEN");
      } else if (cmd == "CLOSE") {
        closeDoor();
        lockDoor();
        sendResponse("DOOR:CLOSED");
      } else if (cmd == "UNLOCK") {
        unlockDoor();
        sendResponse("DOOR:UNLOCKED");
      } else if (cmd == "LOCK") {
        lockDoor();
        sendResponse("DOOR:LOCKED");
      }
    }
  }
}

// =====================================================
// PHAN LOAI RAC
// =====================================================
void classifyWaste(int type) {
  float angle = 0;
  switch (type) {
    case 1: angle = ANGLE_ORGANIC; break;
    case 2: angle = ANGLE_RECYCLE; break;
    case 3: angle = ANGLE_NONRECYCLE; break;
    case 4: angle = ANGLE_HAZARDOUS; break;
    default:
      sendResponse("ERROR:INVALID_COMMAND");
      return;
  }

  long steps = angleToSteps(angle);
  sendResponse("ACK:" + String(type));

  rotateMotor(steps);
  delay(MOTOR_SETTLE_MS);
  dropWaste();
  rotateMotor(-steps);

  sendResponse("DONE:" + String(type));
}

// =====================================================
// XU LY LENH UART
// =====================================================
void processCommand(String command) {
  command.trim();
  command.toUpperCase();
  if (command.length() == 0) return;

  if (command == "PING") { sendResponse("PONG"); return; }
  if (command == "LEVEL") { checkAllBins(); lastSensorTime = millis(); return; }
  if (command == "SERVO") { dropWaste(); sendResponse("SERVO:DONE"); return; }
  if (command == "OPEN") { unlockDoor(); openDoor(); sendResponse("DOOR:OPEN"); return; }
  if (command == "CLOSE") { closeDoor(); lockDoor(); sendResponse("DOOR:CLOSED"); return; }

  if (command.startsWith("LEVEL")) {
    int index = command.substring(5).toInt() - 1;
    checkOneBin(index);
    lastSensorTime = millis();
    return;
  }

  if (command == "1" || command == "2" || command == "3" || command == "4") {
    classifyWaste(command.toInt());
    return;
  }

  sendResponse("ERROR:INVALID_COMMAND");
}

void readCommands(Stream &port, String &buffer) {
  while (port.available()) {
    char c = port.read();
    if (c == '\n' || c == '\r') {
      if (buffer.length() > 0) {
        String cmd = buffer;
        buffer = "";
        processCommand(cmd);
      }
    } else {
      if (buffer.length() < 32) buffer += c;
      else buffer = "";
    }
  }
}

// =====================================================
// SETUP & LOOP
// =====================================================
void setup() {
  Serial.begin(115200);
  Serial2.begin(UART_BAUD, SERIAL_8N1, RXD2, TXD2);

  // Kết nối Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi Connected!");

  // Cấu hình Firebase
  config.database_url = FIREBASE_HOST;
  config.signer.test_mode = true;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);
  digitalWrite(STEP_PIN, LOW);
  digitalWrite(DIR_PIN, LOW);
  digitalWrite(ENABLE_PIN, LOW);

  servo1.setPeriodHertz(50);
  servo2.setPeriodHertz(50);
  servo1.attach(SERVO1_PIN, 500, 2400);
  servo2.attach(SERVO2_PIN, 500, 2400);

  servo1.write(SERVO1_CLOSE_ANGLE);
  delay(SERVO1_MOVE_MS);
  servo2.write(SERVO2_LOCK_ANGLE);
  delay(SERVO2_MOVE_MS);

  for (int i = 0; i < SENSOR_COUNT; i++) {
    pinMode(trigPins[i], OUTPUT);
    pinMode(echoPins[i], INPUT);
    digitalWrite(trigPins[i], LOW);
  }

  sendResponse("READY");
  checkAllBins();
  lastSensorTime = millis();
}

void loop() {
  readCommands(Serial2, piBuffer);
  readCommands(Serial, usbBuffer);

  // Quét cảm biến định kỳ
  if (millis() - lastSensorTime >= SENSOR_INTERVAL) {
    checkAllBins();
    lastSensorTime = millis();
  }

  // Kiểm tra lệnh điều khiển Servo từ App mỗi 1 giây
  if (millis() - lastControlCheckTime >= 1000) {
    checkFirebaseControl();
    lastControlCheckTime = millis();
  }
}