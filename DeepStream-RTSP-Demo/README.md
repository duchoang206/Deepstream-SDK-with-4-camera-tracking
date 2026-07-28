# DeepStream 4 Camera RTSP Tracking Demo

This repository contains configurations and scripts to run a DeepStream 7.0 application that processes 4 RTSP camera streams simultaneously, performing object detection and multi-object tracking.

## Features
- DeepStream 7.0 (Multiarch Triton image)
- 4 concurrent RTSP Camera Inputs (Hikvision & Dahua)
- TrafficCamNet Object Detection
- NvDCF Multi-Object Tracker
- Tiled Display (2x2 grid) with On-Screen Display (Bounding Boxes, Tracking ID, Clock)

## Prerequisites
- NVIDIA GPU with drivers installed
- Docker installed and configured
- NVIDIA Container Toolkit installed

## Execution Guide

### 1. Make Scripts Executable
Run the following command to grant execution permissions to the scripts:
```bash
chmod +x run_demo.sh entrypoint.sh
```

### 2. Run the Demo
Simply execute the `run_demo.sh` script. It will set up the X11 display permissions, build the Docker image, and run the container:
```bash
./run_demo.sh
```

The script will automatically:
1. Allow local X server connections (`xhost +local:docker`).
2. Build the Docker image `ds_rtsp_demo`.
3. Launch the container with GPU access, X11 forwarding, and host networking to display the output stream.
