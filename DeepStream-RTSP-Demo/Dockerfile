FROM nvcr.io/nvidia/deepstream:7.0-triton-multiarch

# Set working directory
WORKDIR /app

# Copy all source code, config and assets to /app
COPY . /app

# Make entrypoint script executable
RUN chmod +x /app/entrypoint.sh

# Set the default entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
