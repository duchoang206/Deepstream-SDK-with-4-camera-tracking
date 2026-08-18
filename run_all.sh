#!/bin/bash

echo "==================================================="
echo "  Starting Vision AI YOLO System (Docker Compose)  "
echo "==================================================="

# 1. Start all containers in background
echo -e "\n[1/2] Starting Docker Compose Services (Postgres, MediaMTX, DeepStream Backend, Web Dashboard)..."
sudo docker compose up -d --remove-orphans

if [ $? -ne 0 ]; then
    echo "[Error] Docker compose failed to start."
    exit 1
fi

echo -e "\n[2/2] Checking container statuses..."
sleep 3
sudo docker compose ps

echo -e "\n==================================================="
echo "  All services started successfully!"
echo "  - Web Dashboard : http://localhost:3000"
echo "  - Backend API   : http://localhost:8000/docs"
echo "  - WebRTC Server : http://localhost:8081"
echo ""
echo "  To view logs    : sudo docker compose logs -f"
echo "  To stop services: sudo docker compose down"
echo "==================================================="
