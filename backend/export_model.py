import shutil
from ultralytics import YOLO

print("Downloading and exporting YOLOv8n to ONNX...")
model = YOLO('yolov8n.pt')
exported_path = model.export(format='onnx', opset=12)

dest_path = '/app/models_config/weights/yolov8n.onnx'
shutil.move(exported_path, dest_path)
print(f"Export successful! File moved to: {dest_path}")
