FROM nvcr.io/nvidia/deepstream:7.0-triton-multiarch

# Set working directory
WORKDIR /app

# Install wget
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

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
