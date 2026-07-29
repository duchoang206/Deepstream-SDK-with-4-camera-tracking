FROM nvcr.io/nvidia/deepstream:7.0-triton-multiarch

# Set working directory
WORKDIR /app

# Install wget
RUN apt-get update && apt-get install -y wget git build-essential libglib2.0-dev libglib2.0-dev-bin libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/nvidia/deepstream/deepstream/sources
RUN git clone https://github.com/marcoslucianops/DeepStream-Yolo.git

# Download and extract mediamtx to /opt/mediamtx
WORKDIR /opt/mediamtx
RUN wget https://github.com/bluenviron/mediamtx/releases/download/v1.8.2/mediamtx_v1.8.2_linux_amd64.tar.gz && \
    tar -xzf mediamtx_v1.8.2_linux_amd64.tar.gz && \
    rm mediamtx_v1.8.2_linux_amd64.tar.gz

# Set working directory back to /app
WORKDIR /app

# Copy all source code, config and assets to /app
COPY . /app

# Make entrypoint script executable
RUN chmod +x /app/entrypoint.sh

# Set the default entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
