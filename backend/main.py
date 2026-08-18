import os
import sys
import uuid
import json
import asyncio
import requests
from typing import Dict, List, Set, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.database import db_manager
from utils.circular_logger import app_logger
from core.deepstream_engine import deepstream_manager, sanitize_rtsp_url
from core.camera_calibrator import camera_calibrator
from core.behavior_analytics import behavior_engine
from core.reid_matcher import global_reid

app = FastAPI(title="RTC VMS (R-SkyView) - Real-time Decoupled Multi-Camera Analytics", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MEDIAMTX_API = os.getenv("MEDIAMTX_API", "http://127.0.0.1:9997/v3/config/paths")

# In-memory registry of active cameras
cameras: Dict[str, dict] = {}

# Active WebSocket connections
connected_metadata_ws: Set[WebSocket] = set()
connected_event_ws: Set[WebSocket] = set()
loop: Optional[asyncio.AbstractEventLoop] = None

# --- REQUEST MODELS ---
class CameraAddRequest(BaseModel):
    name: str
    rtsp_url: str

class CalibrationRequest(BaseModel):
    src_points: List[List[float]] # 4 points normalized [[x,y]...]
    dst_points: List[List[float]] # 4 points floor map [[x,y]...]

class RuleItem(BaseModel):
    id: str
    type: str # intrusion, tripwire, dwell_time, density
    name: str
    points: List[List[float]] # polygon or line coordinates
    target_objects: Optional[List[str]] = ["person"]
    threshold: Optional[float] = 10.0
    direction: Optional[str] = "both"

class SaveRulesRequest(BaseModel):
    rules: List[RuleItem]

# --- ASYNC EVENT & METADATA BROADCASTERS ---
def broadcast_metadata_sync(payload: dict):
    if not connected_metadata_ws or not loop:
        return
    msg = json.dumps(payload)
    asyncio.run_coroutine_threadsafe(_broadcast_to_set(connected_metadata_ws, msg), loop)

def broadcast_event_sync(event_payload: dict):
    if not connected_event_ws or not loop:
        return
    msg = json.dumps(event_payload)
    asyncio.run_coroutine_threadsafe(_broadcast_to_set(connected_event_ws, msg), loop)

async def _broadcast_to_set(target_set: Set[WebSocket], msg: str):
    disconnected = set()
    for ws in list(target_set):
        try:
            await ws.send_text(msg)
        except Exception:
            disconnected.add(ws)
    for ws in disconnected:
        target_set.discard(ws)

@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()
    deepstream_manager.metadata_callback = broadcast_metadata_sync
    deepstream_manager.event_callback = broadcast_event_sync
    # deepstream_manager.start() moved to end of startup
    # Pre-populate cameras from DB if existing
    db_cams = db_manager.get_all_cameras()
    for c in db_cams:
        cam_id = c["id"]
        cameras[cam_id] = {
            "id": cam_id,
            "name": c["name"],
            "rtsp_url": c["rtsp_url"],
            "calibration": c.get("calibration_points"),
            "status": "online"
        }
        # Load calibration if available
        calib_pts = c.get("calibration_points")
        if calib_pts and isinstance(calib_pts, dict):
            camera_calibrator.set_calibration(
                cam_id, 
                calib_pts.get("src_points", []), 
                calib_pts.get("dst_points", [])
            )
        # Load rules
        rules = db_manager.get_rules_by_camera(cam_id)
        if rules:
            behavior_engine.set_rules(cam_id, rules)
            
        # Validate stream before adding to avoid DeepStream core dump
        from check_rtsp import is_rtsp_valid_async
        is_valid = await is_rtsp_valid_async(c["rtsp_url"], timeout=3)
        if is_valid:
            deepstream_manager.add_source(cam_id, c["rtsp_url"])
        else:
            print(f"[Main] Warning: Camera {cam_id} is unreachable. Skipping DeepStream initialization.")
            
    print(f"[Main] DeepStream Manager started. Loaded {len(cameras)} cameras from database.")
    deepstream_manager.start()

# --- WEBSOCKET ENDPOINTS ---
@app.websocket("/ws/metadata")
async def websocket_metadata_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_metadata_ws.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_metadata_ws.discard(websocket)
    except Exception:
        connected_metadata_ws.discard(websocket)

@app.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_event_ws.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_event_ws.discard(websocket)
    except Exception:
        connected_event_ws.discard(websocket)

# --- CAMERA MANAGEMENT API ---
@app.post("/api/v1/streams/add")
@app.post("/api/camera/add")
async def add_camera(request: CameraAddRequest):
    cam_id = str(uuid.uuid4())[:8]
    clean_url = sanitize_rtsp_url(request.rtsp_url)
    
    # 1. Register Camera Stream in MediaMTX for direct WebRTC/WHEP streaming
    try:
        res = requests.post(f"{MEDIAMTX_API}/add/{cam_id}", json={
            "source": clean_url,
            "sourceOnDemand": False,
            "rtspTransport": "tcp"
        }, timeout=4)
        if res.status_code not in (200, 201):
            requests.post(f"{MEDIAMTX_API}/patch/{cam_id}", json={"source": clean_url}, timeout=2)
    except Exception as e:
        print(f"[MediaMTX] Note: proxy path registration: {e}")

    # 2. Pre-validate stream to avoid DeepStream core dump for unreachable cameras
    from check_rtsp import is_rtsp_valid_async
    is_valid = await is_rtsp_valid_async(clean_url, timeout=3)
    
    if is_valid:
        # Dynamically add stream to unified DeepStream nvstreammux
        success = deepstream_manager.add_source(cam_id, clean_url)
        if not success:
            print(f"[Main] Warning: Failed to add valid stream {clean_url} to DeepStream.")
    else:
        print(f"[Main] Warning: Stream {clean_url} is unreachable. Saved to DB but not added to DeepStream pipeline.")

    # 3. Save to DB regardless of validation (as requested by user)
    db_manager.save_camera(cam_id, request.name, clean_url)

    cameras[cam_id] = {
        "id": cam_id,
        "name": request.name,
        "rtsp_url": clean_url,
        "status": "online"
    }
    
    return {"status": "success", "camera": cameras[cam_id]}

@app.delete("/api/v1/streams/{cam_id}")
@app.delete("/api/camera/{cam_id}")
async def delete_camera(cam_id: str):
    if cam_id not in cameras:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    deepstream_manager.delete_source(cam_id)
    try:
        requests.post(f"{MEDIAMTX_API}/delete/{cam_id}", timeout=2)
    except Exception:
        pass
        
    db_manager.delete_camera(cam_id)
    del cameras[cam_id]
    return {"status": "success", "deleted_id": cam_id}

@app.get("/api/v1/streams/list")
@app.get("/api/camera/list")
async def list_cameras():
    return {
        "status": "success",
        "cameras": list(cameras.values())
    }

# --- CAMERA CALIBRATION API (2D-to-Floor-Map) ---
@app.post("/api/camera/{cam_id}/calibration")
async def save_camera_calibration(cam_id: str, calib: CalibrationRequest):
    if cam_id not in cameras:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    success = camera_calibrator.set_calibration(cam_id, calib.src_points, calib.dst_points)
    if not success:
        raise HTTPException(status_code=400, detail="Không thể tính ma trận biến đổi từ các điểm đã chọn")
        
    cfg = camera_calibrator.get_config(cam_id)
    if cfg:
        db_manager.save_calibration(cam_id, calib.src_points, calib.dst_points, cfg["matrix"])
        cameras[cam_id]["calibration"] = cfg
        
    return {"status": "success", "config": cfg}

@app.get("/api/camera/{cam_id}/calibration")
async def get_camera_calibration(cam_id: str):
    cfg = camera_calibrator.get_config(cam_id)
    return {"status": "success", "calibration": cfg}

# --- BEHAVIOR RULES (ROI & TRIPWIRES) API ---
@app.post("/api/camera/{cam_id}/rules")
@app.post("/api/camera/{cam_id}/roi")
async def save_camera_rules(cam_id: str, req: SaveRulesRequest):
    if cam_id not in cameras:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    rules_dict_list = []
    for r in req.rules:
        r_dict = {
            "id": r.id,
            "cam_id": cam_id,
            "type": r.type,
            "name": r.name,
            "points": r.points,
            "target_objects": r.target_objects,
            "threshold": r.threshold,
            "direction": r.direction
        }
        db_manager.save_rule(r_dict)
        rules_dict_list.append(r_dict)
        
    behavior_engine.set_rules(cam_id, rules_dict_list)
    return {"status": "success", "rules_count": len(rules_dict_list)}

@app.get("/api/camera/{cam_id}/rules")
async def get_camera_rules(cam_id: str):
    rules = db_manager.get_rules_by_camera(cam_id)
    return {"status": "success", "rules": rules}

# --- ON-DEMAND ANALYTICS & EVENTS API (PostgreSQL Storage) ---
@app.get("/api/analytics/dashboard")
async def get_dashboard_analytics():
    stats = db_manager.get_dashboard_stats(active_cameras_count=len(cameras))
    return stats

@app.get("/api/analytics/classes")
async def get_analytics_classes():
    return {"status": "success", "labels": ["person", "car", "truck", "bus"]}

@app.get("/api/events/list")
async def list_events(
    limit: int = Query(50, ge=1, le=500),
    rule_type: Optional[str] = None,
    cam_id: Optional[str] = None
):
    events = db_manager.get_events_list(limit=limit, rule_type=rule_type, cam_id=cam_id)
    return {"status": "success", "events": events}

@app.get("/api/tracks/{global_id}/history")
async def get_track_history(global_id: int):
    # Try in-memory track history first, fallback to DB
    mem_history = global_reid.get_track_history(global_id)
    if mem_history:
        return {"status": "success", "source": "realtime", "data": mem_history}
        
    db_history = db_manager.get_global_track_journey(global_id)
    return {
        "status": "success",
        "source": "database",
        "data": {
            "global_id": global_id,
            "trajectory": db_history
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
