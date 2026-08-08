from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
import uuid
import sys
import os
import requests

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from core.yolo_engine import YOLOEngine
from core.circular_logger import CircularLogger
from core.database import db_manager

# MediaMTX API URL
MEDIAMTX_API = "http://localhost:9997/v3/config/paths"

# Initialize FastAPI app
app = FastAPI(title="Vision AI YOLO Backend", description="Dynamic RTSP & ROI Management API")

# Add CORS Middleware to allow Next.js (port 3000) to fetch APIs
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace "*" with "http://localhost:3000"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize central Circular Logger
app_logger = CircularLogger(log_dir="logs", max_size_bytes=3*1024*1024*1024)

# Temporary in-memory storage for engines
engines: Dict[str, YOLOEngine] = {}
cameras: Dict[str, dict] = {}

class ROI(BaseModel):
    id: str
    points: List[List[int]] # List of [x, y] coordinates

class CameraAddRequest(BaseModel):
    rtsp_url: str
    name: str

class ROISetupRequest(BaseModel):
    rois: List[ROI]

@app.post("/api/camera/add")
async def add_camera(request: CameraAddRequest):
    """
    Add a new RTSP camera stream to the system.
    """
    cam_id = str(uuid.uuid4())[:8]
    cameras[cam_id] = {
        "id": cam_id,
        "name": request.name,
        "rtsp_url": request.rtsp_url,
        "rois": []
    }
    
    # Initialize YOLO Engine which starts the background RTSP thread and Inference loop
    # We use the local transcoded stream (H.264) instead of the original stream to reduce CPU decode load
    local_rtsp = f"rtsp://localhost:8554/{cam_id}"
    engine = YOLOEngine(cam_id=cam_id, rtsp_url=local_rtsp, logger=app_logger)
    engines[cam_id] = engine
    
    # Add path to MediaMTX dynamically for WebRTC viewing, with FFmpeg transcoding to support H.265 sources
    try:
        ffmpeg_cmd = f"ffmpeg -rtsp_transport tcp -hwaccel cuda -i {request.rtsp_url} -c:v h264_nvenc -preset p1 -tune ll -g 30 -b:v 1M -c:a copy -f rtsp rtsp://localhost:8554/{cam_id}"
        requests.post(f"{MEDIAMTX_API}/add/{cam_id}", json={
            "source": "publisher",
            "runOnInit": ffmpeg_cmd,
            "runOnInitRestart": True
        }, timeout=2)
    except Exception as e:
        print(f"Failed to add path to MediaMTX: {e}")
        
    return {"message": "Camera added successfully", "camera": cameras[cam_id]}

@app.get("/api/camera/list")
async def list_cameras():
    """
    List all active cameras and their real-time ROI status.
    """
    result = []
    for cam_id, data in cameras.items():
        status = engines[cam_id].get_status() if cam_id in engines else {}
        cam_data = data.copy()
        cam_data["status"] = status
        result.append(cam_data)
        
    return {"cameras": result}

@app.post("/api/camera/{cam_id}/roi")
async def configure_roi(cam_id: str, request: ROISetupRequest):
    """
    Configure ROIs for a specific camera.
    """
    if cam_id not in cameras or cam_id not in engines:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    rois_dict = [roi.dict() for roi in request.rois]
    cameras[cam_id]["rois"] = rois_dict
    
    # Update the YOLO engine with the new ROIs
    engines[cam_id].update_rois(rois_dict)
    
    return {"message": "ROIs updated successfully", "rois": rois_dict}

@app.delete("/api/camera/{cam_id}")
async def remove_camera(cam_id: str):
    """
    Remove a camera and stop its processing thread.
    """
    if cam_id not in cameras:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    # Stop YOLO loop and RTSP reader
    if cam_id in engines:
        engines[cam_id].stop()
        del engines[cam_id]
        
    # Remove path from MediaMTX
    try:
        requests.delete(f"{MEDIAMTX_API}/delete/{cam_id}", timeout=2)
    except Exception as e:
        print(f"Failed to remove path from MediaMTX: {e}")
        
    del cameras[cam_id]
    return {"message": f"Camera {cam_id} removed"}

@app.get("/api/analytics/dashboard")
async def get_analytics_dashboard():
    """
    Get aggregated data for the analytics dashboard.
    """
    active_cameras_count = len(cameras)
    stats = db_manager.get_dashboard_stats(active_cameras_count)
    return stats

@app.on_event("shutdown")
def shutdown_event():
    # Cleanup on exit
    for engine in engines.values():
        engine.stop()
    app_logger.stop()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
