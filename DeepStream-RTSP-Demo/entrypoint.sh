#!/bin/bash
echo "Starting DeepStream App with 4 RTSP Cameras..."

# Start MediaMTX in the background
echo "Starting MediaMTX WebRTC server..."
/opt/mediamtx/mediamtx /app/mediamtx.yml &

# Allow a little time for MediaMTX to start
sleep 2

deepstream-app -c deepstream_app_config.txt
