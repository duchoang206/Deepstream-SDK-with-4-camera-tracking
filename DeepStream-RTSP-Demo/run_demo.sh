#!/bin/bash

# Allow local connections to X server
xhost +local:docker

# Build the docker image
echo "Building Docker image ds_rtsp_demo..."
sudo docker build -t ds_rtsp_demo .

# Run the docker container
echo "Running Docker container ds_rtsp_demo..."
sudo docker run -it --rm \
  --gpus all \
  --net=host \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -e DISPLAY=$DISPLAY \
  -v $(pwd):/app \
  -w /app \
  ds_rtsp_demo
