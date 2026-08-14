#!/bin/bash

# Define cleanup function to kill background processes on exit
cleanup() {
    echo -e "\n[System] Stopping all services..."
    # Kill all background jobs started by this script
    kill $(jobs -p) 2>/dev/null
    exit
}

# Catch Ctrl+C and exit signals to run cleanup
trap cleanup SIGINT SIGTERM EXIT

# Load Node.js (nvm) if it exists
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "==================================================="
echo "  Starting Vision AI YOLO System (Dynamic Backend) "
echo "==================================================="

# 1. Start PostgreSQL Database
echo -e "\n[1/4] Starting PostgreSQL Database..."
sudo docker compose up -d
sleep 2

# 2. Start MediaMTX WebRTC Server
echo -e "\n[2/4] Starting MediaMTX (Port 8081 & 9997)..."
cd services/mediamtx
./mediamtx mediamtx.yml &
cd ../..

# Wait 1 second to ensure MediaMTX API is up
sleep 1

# 3. Start FastAPI Backend
echo -e "\n[3/4] Starting FastAPI Backend (Port 8000)..."
cd backend
python3 main.py &
cd ..

# Wait 2 seconds to ensure Backend is ready
sleep 2

# 4. Start Next.js Frontend
echo -e "\n[4/4] Starting Next.js Frontend (Port 3000)..."
cd web-dashboard
npm run dev &
cd ..

echo -e "\n==================================================="
echo "  All services started successfully!"
echo "  - Web Dashboard : http://localhost:3000"
echo "  - Backend API   : http://localhost:8000/docs"
echo "  - WebRTC Server : http://localhost:8081"
echo ""
echo "  Press [Ctrl + C] to stop all services."
echo "==================================================="

# Keep the script running and wait for background processes
wait
