import os
import sys
import time
import threading
import urllib.parse
from typing import Dict, List, Callable, Optional

try:
    import pyds
    import gi
    gi.require_version('Gst', '1.0')
    from gi.repository import Gst, GLib
except ImportError as e:
    print(f"Warning: Failed to import GStreamer/pyds on host (Expected when running outside Docker): {e}")

from core.reid_matcher import global_reid
from core.camera_calibrator import camera_calibrator
from core.behavior_analytics import behavior_engine
from core.database import db_manager

def sanitize_rtsp_url(url: str) -> str:
    """Safely URL-encodes credentials and removes invalid whitespace in RTSP URLs."""
    url = url.strip().replace(" ", "")
    if not url.startswith("rtsp://"):
        return url
    try:
        prefix = "rtsp://"
        rest = url[len(prefix):]
        if "@" in rest:
            last_at_idx = rest.rfind("@")
            userinfo = rest[:last_at_idx]
            hostpath = rest[last_at_idx+1:]
            if ":" in userinfo:
                u, p = userinfo.split(":", 1)
                u_enc = urllib.parse.quote(urllib.parse.unquote(u), safe="")
                p_enc = urllib.parse.quote(urllib.parse.unquote(p), safe="")
                return f"{prefix}{u_enc}:{p_enc}@{hostpath}"
    except Exception as e:
        print(f"Error sanitizing RTSP URL: {e}")
    return url

class DeepStreamManager:
    """
    Unified Multi-Stream Headless DeepStream Engine with MTMC Fusion & Behavior Analytics.
    - Manages dynamic runtime RTSP source add/delete on a single nvstreammux.
    - Zero GPU NVENC bottleneck by using fakesink (video streamed decoupled via MediaMTX).
    - Extracts Person Detection + Tracking metadata.
    - Performs Multi-Camera Global Re-ID Association & Floor Map Homography projection.
    - Runs Behavior Analytics (Intrusion, Tripwires, Dwell Time, Crowd Density).
    - Dispatches structured events to Database and WebSockets.
    """
    def __init__(self, metadata_callback: Optional[Callable[[dict], None]] = None, event_callback: Optional[Callable[[dict], None]] = None):
        self.metadata_callback = metadata_callback
        self.event_callback = event_callback
        self.sources: Dict[int, dict] = {} # source_id -> {cam_id, url, bin, pad}
        self.cam_id_to_source_id: Dict[str, int] = {}
        self.source_id_to_cam_id: Dict[int, str] = {}
        self.next_source_id = 0
        self.lock = threading.Lock()
        self.is_running = False
        self.pipeline = None
        
        try:
            if 'Gst' in globals() and not Gst.is_initialized():
                Gst.init(None)
            if 'GLib' in globals():
                self.loop = GLib.MainLoop()
                self._build_pipeline()
                self.thread = threading.Thread(target=self._run_loop, daemon=True)
        except Exception as e:
            print(f"[DeepStreamManager] Pipeline initialization deferred: {e}")

    def start(self):
        if hasattr(self, 'thread') and not self.is_running:
            self.thread.start()

    def _build_pipeline(self):
        self.pipeline = Gst.Pipeline(name="rtc-vms-pipeline")
        
        # 1. nvstreammux (Supports up to 32 parallel streams)
        self.muxer = Gst.ElementFactory.make("nvstreammux", "unified-muxer")
        self.muxer.set_property("batch-size", 32)
        self.muxer.set_property("width", 1280)
        self.muxer.set_property("height", 720)
        self.muxer.set_property("batched-push-timeout", 40000)
        self.muxer.set_property("live-source", 1)
        self.pipeline.add(self.muxer)
        
        # 2. PGIE (Primary YOLO Detector)
        self.pgie = Gst.ElementFactory.make("nvinfer", "primary-yolo-detector")
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_config", "config_infer_primary.txt")
        self.pgie.set_property("config-file-path", config_path)
        self.pipeline.add(self.pgie)
        
        # 3. nvtracker (NvDCF Tracker with Re-ID support)
        self.tracker = Gst.ElementFactory.make("nvtracker", "nvtracker-engine")
        tracker_config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_config", "tracker_config.yml")
        self.tracker.set_property("ll-config-file", tracker_config_path)
        self.tracker.set_property("ll-lib-file", "/opt/nvidia/deepstream/deepstream/lib/libnvds_nvmultiobjecttracker.so")
        self.pipeline.add(self.tracker)
        
        # 4. nvdsanalytics
        self.analytics = Gst.ElementFactory.make("nvdsanalytics", "analytics-engine")
        analytics_config = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_config", "config_nvdsanalytics.txt")
        if not os.path.exists(analytics_config):
            with open(analytics_config, "w") as f:
                f.write("[property]\nenable=1\nconfig-width=1280\nconfig-height=720\nosd-mode=2\ndisplay-font-size=12\n")
        self.analytics.set_property("config-file", analytics_config)
        self.pipeline.add(self.analytics)
        
        # 5. fakesink (Headless execution: 0 NVENC load, zero delay)
        self.sink = Gst.ElementFactory.make("fakesink", "headless-sink")
        self.sink.set_property("sync", False)
        self.sink.set_property("async", False)
        self.pipeline.add(self.sink)
        
        # Link pipeline core
        self.muxer.link(self.pgie)
        self.pgie.link(self.tracker)
        self.tracker.link(self.analytics)
        self.analytics.link(self.sink)
        
        # Add metadata probe on analytics src pad
        analytics_src_pad = self.analytics.get_static_pad("src")
        analytics_src_pad.add_probe(Gst.PadProbeType.BUFFER, self._metadata_probe, 0)
        
        # Bus message handler
        bus = self.pipeline.get_bus()
        bus.add_signal_watch()
        bus.connect("message", self._bus_call)

    def _bus_call(self, bus, message):
        t = message.type
        if t == Gst.MessageType.EOS:
            print("[DeepStreamManager] End-of-stream reached")
        elif t == Gst.MessageType.ERROR:
            err, debug = message.parse_error()
            print(f"[DeepStreamManager] Pipeline Error: {err}: {debug}")
        return True

    def _run_loop(self):
        if self.pipeline:
            self.pipeline.set_state(Gst.State.PLAYING)
            self.is_running = True
            print("[DeepStreamManager] Unified Headless Pipeline PLAYING")
            self.loop.run()

    def add_source(self, cam_id: str, rtsp_url: str) -> bool:
        """
        Dynamically adds an RTSP stream to the running nvstreammux at runtime.
        Runs safely on the GLib main loop.
        """
        if not self.pipeline:
            print(f"[DeepStreamManager] Note: Adding source {cam_id} in standalone mode")
            return True
            
        with self.lock:
            if cam_id in self.cam_id_to_source_id:
                print(f"[DeepStreamManager] Camera {cam_id} is already in pipeline.")
                return True
                
            clean_url = sanitize_rtsp_url(rtsp_url)
            source_id = self.next_source_id
            self.next_source_id += 1
            
            self.cam_id_to_source_id[cam_id] = source_id
            self.source_id_to_cam_id[source_id] = cam_id
            
            GLib.idle_add(self._add_source_glib, cam_id, clean_url, source_id)
            return True

    def _add_source_glib(self, cam_id, clean_url, source_id):
        bin_name = f"source-bin-{source_id}"
        source_bin = Gst.ElementFactory.make("nvurisrcbin", bin_name)
        if not source_bin:
            print(f"[DeepStreamManager] Failed to create nvurisrcbin for {cam_id}")
            return False
            
        source_bin.set_property("uri", clean_url)
        source_bin.set_property("source-id", source_id)
        source_bin.set_property("rtsp-reconnect-interval", 5)
        if source_bin.find_property("select-rtp-protocol"):
            source_bin.set_property("select-rtp-protocol", 4)
        
        source_bin.connect("pad-added", self._cb_newpad, source_id)
        source_bin.connect("child-added", self._cb_child_added)
        
        self.pipeline.add(source_bin)
        source_bin.sync_state_with_parent()
        
        with self.lock:
            self.sources[source_id] = {
                "cam_id": cam_id,
                "url": clean_url,
                "bin": source_bin,
                "pad": None
            }
            
        print(f"[DeepStreamManager] Added camera {cam_id} as source_id {source_id} ({clean_url})")
        return False

    def _cb_child_added(self, child_proxy, obj, name, user_data=None):
        if "source" in name or "rtspsrc" in name:
            obj.set_property("drop-on-latency", True)
            if obj.find_property("protocols"):
                obj.set_property("protocols", 4)
            if obj.find_property("latency"):
                obj.set_property("latency", 100)

    def _cb_newpad(self, decodebin, decoder_src_pad, source_id):
        caps = decoder_src_pad.get_current_caps()
        if not caps:
            caps = decoder_src_pad.query_caps()
        if caps and caps.get_size() > 0:
            gst_struct = caps.get_structure(0)
            name = gst_struct.get_name()
            if "video" not in name:
                return

        pad_name = f"sink_{source_id}"
        sink_pad = self.muxer.get_static_pad(pad_name)
        if not sink_pad:
            sink_pad = self.muxer.get_request_pad(pad_name)
            
        if sink_pad and not sink_pad.is_linked():
            decoder_src_pad.link(sink_pad)
            if source_id in self.sources:
                self.sources[source_id]["pad"] = sink_pad
            print(f"[DeepStreamManager] Linked pad {pad_name} for source {source_id}")

    def delete_source(self, cam_id: str) -> bool:
        """
        Dynamically removes an RTSP stream from the running nvstreammux at runtime.
        """
        if not self.pipeline:
            return True
            
        with self.lock:
            if cam_id not in self.cam_id_to_source_id:
                return False
                
            source_id = self.cam_id_to_source_id[cam_id]
            GLib.idle_add(self._delete_source_glib, cam_id, source_id)
            return True

    def _delete_source_glib(self, cam_id, source_id):
        with self.lock:
            source_info = self.sources.get(source_id)
            if not source_info:
                return False
                
            source_bin = source_info["bin"]
            sink_pad = source_info.get("pad")
            
            if sink_pad:
                self.muxer.release_request_pad(sink_pad)
                
            source_bin.set_state(Gst.State.NULL)
            self.pipeline.remove(source_bin)
            
            del self.sources[source_id]
            del self.cam_id_to_source_id[cam_id]
            del self.source_id_to_cam_id[source_id]
            
        print(f"[DeepStreamManager] Removed camera {cam_id} source_id {source_id}")
        return False

    def _metadata_probe(self, pad, info, u_data):
        """
        DeepStream C Pad Probe:
        1. Extracts Bounding Boxes + IDs
        2. Applies MTMC Cross-Camera Association & Homography Projection
        3. Executes Behavior Analytics (Intrusion, Tripwires, Dwell Time, Density)
        4. Broadcasts telemetry to WebSockets and PostgreSQL
        """
        try:
            gst_buffer = info.get_buffer()
            if not gst_buffer:
                return Gst.PadProbeReturn.OK

            batch_meta = pyds.gst_buffer_get_nvds_batch_meta(hash(gst_buffer))
            l_frame = batch_meta.frame_meta_list
            
            timestamp_ms = int(time.time() * 1000)
            streams_payload = []
            
            while l_frame is not None:
                try:
                    frame_meta = pyds.NvDsFrameMeta.cast(l_frame.data)
                except StopIteration:
                    break

                source_id = frame_meta.source_id
                cam_id = self.source_id_to_cam_id.get(source_id, f"cam_{source_id}")
                frame_w = max(1, frame_meta.source_frame_width)
                frame_h = max(1, frame_meta.source_frame_height)
                
                raw_detections = []
                l_obj = frame_meta.obj_meta_list
                
                while l_obj is not None:
                    try:
                        obj_meta = pyds.NvDsObjectMeta.cast(l_obj.data)
                    except StopIteration:
                        break
                        
                    # Filter person (class_id 0)
                    if obj_meta.class_id == 0 or obj_meta.obj_label.lower() == "person":
                        rect = obj_meta.rect_params
                        norm_x = max(0.0, min(1.0, rect.left / frame_w))
                        norm_y = max(0.0, min(1.0, rect.top / frame_h))
                        norm_w = max(0.0, min(1.0, rect.width / frame_w))
                        norm_h = max(0.0, min(1.0, rect.height / frame_h))
                        
                        raw_detections.append({
                            "local_id": int(obj_meta.object_id),
                            "class": "person",
                            "bbox": [norm_x, norm_y, norm_w, norm_h],
                            "confidence": float(obj_meta.confidence)
                        })
                        
                    try:
                        l_obj = l_obj.next
                    except StopIteration:
                        break

                # 1. Multi-Target Multi-Camera (MTMC) Fusion & Spatial Mapping
                if raw_detections:
                    augmented_dets = global_reid.process_camera_detections(cam_id, raw_detections)
                    objects_list = []
                    
                    for d in augmented_dets:
                        gid = d["global_id"]
                        fx = d.get("floor_x", 0.5)
                        fy = d.get("floor_y", 0.5)
                        
                        # Record trajectory waypoint in DB
                        db_manager.log_track_position(gid, cam_id, fx, fy)
                        
                        objects_list.append({
                            "id": gid,
                            "local_id": d["local_id"],
                            "class": "person",
                            "x": round(d["bbox"][0], 4),
                            "y": round(d["bbox"][1], 4),
                            "w": round(d["bbox"][2], 4),
                            "h": round(d["bbox"][3], 4),
                            "floor_x": fx,
                            "floor_y": fy,
                            "confidence": round(d.get("confidence", 0.9), 2)
                        })
                    
                    # 2. Behavior Analytics Processing
                    triggered_events, tripwire_stats = behavior_engine.process_frame(cam_id, objects_list)
                    
                    # Log events to PostgreSQL
                    for ev in triggered_events:
                        db_manager.log_event(ev)
                        if self.event_callback:
                            self.event_callback(ev)
                    
                    streams_payload.append({
                        "cam_id": cam_id,
                        "objects": objects_list,
                        "tripwire_stats": tripwire_stats
                    })

                try:
                    l_frame = l_frame.next
                except StopIteration:
                    break

            if streams_payload and self.metadata_callback:
                self.metadata_callback({
                    "timestamp": timestamp_ms,
                    "streams": streams_payload
                })

        except Exception as e:
            pass

        return Gst.PadProbeReturn.OK

# Instantiate Singleton
deepstream_manager = DeepStreamManager()
