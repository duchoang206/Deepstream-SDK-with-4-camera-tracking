import threading
import time
import os
from ultralytics import YOLO
from core.rtsp_reader import RTSPLatestFrameReader
from core.intrusion_logic import IntrusionDetector
from core.circular_logger import CircularLogger
from core.database import db_manager

class YOLOEngine:
    """
    Background worker that runs YOLOv8 inference on a given camera stream.
    Checks for intrusions based on configured ROIs.
    """
    def __init__(self, cam_id: str, rtsp_url: str, logger: CircularLogger, target_fps=15):
        self.cam_id = cam_id
        self.rtsp_url = rtsp_url
        self.target_fps = target_fps
        self.sleep_time = 1.0 / target_fps
        self.logger = logger
        
        # Initialize YOLO model (fallback to nano if best.pt is missing)
        model_path = "weights/best.pt"
        if not os.path.exists(os.path.join(os.path.dirname(os.path.dirname(__file__)), model_path)):
            print(f"[{self.cam_id}] Warning: {model_path} not found, falling back to yolov8n.pt")
            model_path = "yolov8n.pt"
        self.model = YOLO(model_path) 
        
        # Default classes if none configured (use all available classes from model)
        self.default_classes = list(self.model.names.keys())
        
        self.rtsp_reader = RTSPLatestFrameReader(rtsp_url, cam_id)
        self.intrusion_detector = IntrusionDetector()
        
        # ROIs map: { roi_id: shapely.Polygon }
        self.rois = {}
        # ROI status map: { roi_id: "Carfull" / "Empty" }
        self.roi_status = {}
        
        self.running = True
        self.thread = threading.Thread(target=self._inference_loop, daemon=True)
        self.thread.start()

    def update_rois(self, rois_config: list):
        """
        Update the polygons to check against.
        rois_config: List of dicts [{"id": "roi_1", "points": [[x,y], ...]}]
        """
        new_rois = {}
        for r in rois_config:
            if len(r["points"]) >= 3:
                new_rois[r["id"]] = {
                    "polygon": self.intrusion_detector.create_polygon(r["points"]),
                    "target_objects": [t.lower() for t in r.get("target_objects", [])]
                }
                if r["id"] not in self.roi_status:
                    self.roi_status[r["id"]] = "Empty"
        self.rois = new_rois

    def _inference_loop(self):
        while self.running:
            start_time = time.time()
            
            ret, frame = self.rtsp_reader.get_latest_frame()
            if ret and frame is not None and len(self.rois) > 0:
                img_h, img_w = frame.shape[:2]
                
                # Dynamically determine target classes based on ROIs
                target_classes = set()
                for roi_data in self.rois.values():
                    for obj in roi_data["target_objects"]:
                        for idx, name in self.model.names.items():
                            if name.lower() == obj:
                                target_classes.add(idx)
                                break
                
                if not target_classes:
                    target_classes = set(self.default_classes)
                    
                target_classes_list = list(target_classes)
                
                # Run YOLO inference
                results = self.model(frame, verbose=False, classes=target_classes_list, device=0)
                
                # Check each ROI
                current_status = {roi_id: "Empty" for roi_id in self.rois.keys()}
                
                # To track class counts for detections
                class_counts = {self.model.names[idx].lower(): 0 for idx in target_classes_list}
                
                for result in results:
                    boxes = result.boxes.xyxy.cpu().numpy() # [x1, y1, x2, y2]
                    cls_ids = result.boxes.cls.cpu().numpy()
                    
                    for box, cls_id in zip(boxes, cls_ids):
                        class_name = self.model.names[int(cls_id)].lower()
                        if class_name in class_counts:
                            class_counts[class_name] += 1
                            
                        # Normalize the bbox to match the [0..1] scaled polygons
                        norm_box = [box[0]/img_w, box[1]/img_h, box[2]/img_w, box[3]/img_h]
                            
                        # Check this box against all ROIs
                        for roi_id, roi_data in self.rois.items():
                            if class_name in roi_data["target_objects"]:
                                if self.intrusion_detector.check_intrusion_bbox(norm_box, roi_data["polygon"]):
                                    current_status[roi_id] = "Carfull"
                
                # Log detections to DB
                if any(count > 0 for count in class_counts.values()):
                    db_manager.log_detections(self.cam_id, class_counts)
                
                # Update status and log changes
                for roi_id, status in current_status.items():
                    if status != self.roi_status.get(roi_id):
                        self.roi_status[roi_id] = status
                        self.logger.log_event(self.cam_id, roi_id, status)
                        db_manager.log_event(self.cam_id, roi_id, status)
                        print(f"[{self.cam_id}] ROI {roi_id} changed to {status}")
                        
            # Sleep to maintain target FPS (simulate wait for next frame)
            process_time = time.time() - start_time
            sleep_duration = max(0, self.sleep_time - process_time)
            time.sleep(sleep_duration)

    def get_status(self):
        return self.roi_status

    def stop(self):
        self.running = False
        self.rtsp_reader.stop()
        if self.thread.is_alive():
            self.thread.join(timeout=2)
