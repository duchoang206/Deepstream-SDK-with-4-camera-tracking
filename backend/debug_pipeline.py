#!/usr/bin/env python3
"""
Debug script - Run inside backend container to check:
1. GStreamer / DeepStream import
2. Engine file exists
3. Config file paths
4. Basic pipeline build without sources
"""
import os
import sys

print("=== DeepStream Detection Debug ===\n")

# 1. Check paths
base = os.path.dirname(os.path.abspath(__file__))
models_config = os.path.join(base, "models_config")

config_path = os.path.join(models_config, "config_infer_primary.txt")
engine_path = os.path.join(models_config, "weights", "yolov8n_b32_gpu0_fp16.engine")
onnx_path = os.path.join(models_config, "weights", "yolov8n.onnx")
labels_path = os.path.join(models_config, "labels.txt")
tracker_config = os.path.join(models_config, "tracker_config.yml")
custom_lib = os.path.join(models_config, "DeepStream-Yolo", "nvdsinfer_custom_impl_Yolo", "libnvdsinfer_custom_impl_Yolo.so")
tracker_lib = "/opt/nvidia/deepstream/deepstream/lib/libnvds_nvmultiobjecttracker.so"

print("[PATH CHECK]")
for label, p in [
    ("config_infer_primary.txt", config_path),
    ("yolov8n.engine", engine_path),
    ("yolov8n.onnx", onnx_path),
    ("labels.txt", labels_path),
    ("tracker_config.yml", tracker_config),
    ("libnvdsinfer_custom_impl_Yolo.so", custom_lib),
    ("libnvds_nvmultiobjecttracker.so", tracker_lib),
]:
    exists = os.path.exists(p)
    size = os.path.getsize(p) if exists else 0
    status = f"OK ({size/1024/1024:.1f}MB)" if exists else "MISSING"
    print(f"  {'✓' if exists else '✗'} {label}: {status}")
    print(f"    -> {p}")

# 2. Check config file paths
print("\n[CONFIG FILE ANALYSIS]")
with open(config_path) as f:
    content = f.read()
print(content)

# 3. Check if paths in config match actual paths
print("\n[PATH MISMATCH CHECK]")
if "/app/" in content:
    print("  CONFIG uses /app/ paths (Docker). Checking if running in Docker...")
    if os.path.exists("/app"):
        print("  ✓ /app exists, running in Docker container")
    else:
        print("  ✗ /app does NOT exist! Running outside Docker but config has /app/ paths")
        print("  --> FIX NEEDED: Update config paths to absolute paths")

# 4. Try importing GStreamer
print("\n[GSTREAMER/PYDS IMPORT CHECK]")
try:
    import pyds
    print("  ✓ pyds imported successfully")
except ImportError as e:
    print(f"  ✗ pyds import failed: {e}")

try:
    import gi
    gi.require_version('Gst', '1.0')
    from gi.repository import Gst
    Gst.init(None)
    print(f"  ✓ GStreamer {Gst.version_string()} initialized")
except Exception as e:
    print(f"  ✗ GStreamer failed: {e}")

# 5. Test nvinfer element creation
print("\n[ELEMENT CREATION CHECK]")
try:
    from gi.repository import Gst
    Gst.init(None)
    
    pipeline = Gst.Pipeline()
    muxer = Gst.ElementFactory.make("nvstreammux", "mux")
    nvinfer = Gst.ElementFactory.make("nvinfer", "pgie")
    tracker = Gst.ElementFactory.make("nvtracker", "tracker")
    
    for name, el in [("nvstreammux", muxer), ("nvinfer", nvinfer), ("nvtracker", tracker)]:
        if el:
            print(f"  ✓ {name} created OK")
        else:
            print(f"  ✗ {name} FAILED to create (plugin missing?)")
    
    if nvinfer:
        nvinfer.set_property("config-file-path", config_path)
        print(f"  ✓ nvinfer config set to: {config_path}")
        
except Exception as e:
    print(f"  ✗ Element check failed: {e}")
    import traceback
    traceback.print_exc()

print("\n=== Debug complete ===")
