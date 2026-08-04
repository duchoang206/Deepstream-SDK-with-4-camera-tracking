import time
import requests
import random

# TÊN MIỀN / API CỦA DASHBOARD (Next.js)
DASHBOARD_API = "http://localhost:3000/api/analytics"

def send_analytics(agv_count, person_count, rack_count):
    payload = {
        "agv": agv_count,
        "person": person_count,
        "rack": rack_count
    }
    
    try:
        response = requests.post(DASHBOARD_API, json=payload)
        if response.status_code == 200:
            print(f"[SUCCESS] Đã gửi: {payload}")
        else:
            print(f"[ERROR] Trả về: {response.status_code}")
    except Exception as e:
        print(f"[FAILED] Không thể kết nối tới Dashboard: {e}")

if __name__ == "__main__":
    print("Khởi động DeepStream Analytics Bridge...")
    print("Sẽ gửi dữ liệu tới:", DASHBOARD_API)
    
    # GIẢ LẬP: Chờ DeepStream trả về kết quả
    # Trong thực tế, bạn sẽ dùng pyds (Python bindings của DeepStream) để đếm số lượng 
    # vật thể trên frame và gọi hàm send_analytics() ở đây.
    
    while True:
        # Giả lập dữ liệu đếm được từ AI (thay bằng biến thực tế từ DeepStream)
        agv = random.randint(1, 10)
        person = random.randint(0, 5)
        rack = random.randint(20, 30)
        
        send_analytics(agv, person, rack)
        
        # Gửi API 2 giây 1 lần để Web Dashboard cập nhật
        time.sleep(2)
