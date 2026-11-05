import cv2
from ultralytics import YOLO

# 1. Load mô hình AI bạn đã train
model = YOLO('best.pt')

# 2. Mở webcam USB cắm ngoài (Thử đổi số 1 thành 2 hoặc 3 nếu máy tính có nhiều camera)
cap = cv2.VideoCapture(1)

# Kiểm tra xem webcam USB có mở thành công không
if not cap.isOpened():
    print("Không thể mở webcam USB ở cổng 1. Đang thử chuyển về cổng 0...")
    cap = cv2.VideoCapture(0)

print("Đang bật webcam USB... Hãy đưa rác trước ống kính để test.")
print("Bấm phím 'q' trên bàn phím để tắt chương trình.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        print("Không nhận được khung hình từ camera.")
        break

    # 3. Cho AI nhận diện khung hình hiện tại (Thêm conf=0.25 hoặc thấp hơn nếu cần)
    results = model(frame)

    # 4. Vẽ khung và tên loại rác lên màn hình
    annotated_frame = results[0].plot()

    # 5. Hiển thị cửa sổ camera
    cv2.imshow("Test Phan Loai Rac AI - USB Cam", annotated_frame)

    # Nhấn phím 'q' để thoát
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()