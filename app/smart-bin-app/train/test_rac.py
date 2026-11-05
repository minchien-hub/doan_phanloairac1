import cv2
from ultralytics import YOLO

# 1. Load mô hình YOLO11 bạn vừa tải về máy
model = YOLO('best.pt')

# 2. Mở webcam của laptop
cap = cv2.VideoCapture(0)

print("Đang bật webcam... Hãy đưa rác ra trước camera để test. Nhấn 'q' để thoát.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

# Thay vì gọi: results = model(frame)
# Hãy sửa thành:
    results = model(frame, conf=0.05)

    # Vẽ khung kết quả
    annotated_frame = results[0].plot()

    # Hiển thị
    cv2.imshow("Test YOLO11 Phan Loai Rac", annotated_frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()