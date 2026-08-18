FROM nvcr.io/nvidia/deepstream:7.0-triton-multiarch

# Install build dependencies for YOLO custom parser and other python deps
RUN apt-get update && apt-get install -y \
    build-essential \
    libssl-dev \
    wget \
    python3-pip \
    python3-gi python3-dev python3-gst-1.0 python-gi-dev libglib2.0-dev libgstreamer1.0-dev libgirepository1.0-dev \
    libgstrtspserver-1.0-0 libgstrtspserver-1.0-dev gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-plugins-good \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/NVIDIA-AI-IOT/deepstream_python_apps/releases/download/v1.1.11/pyds-1.1.11-py3-none-linux_x86_64.whl && \
    pip3 install pyds-1.1.11-py3-none-linux_x86_64.whl && \
    rm pyds-1.1.11-py3-none-linux_x86_64.whl

WORKDIR /app

# Copy DeepStream-Yolo source
COPY models_config/DeepStream-Yolo /app/DeepStream-Yolo

# Build the custom YOLO parser
ENV CUDA_VER=12.2
RUN cd /app/DeepStream-Yolo/nvdsinfer_custom_impl_Yolo && \
    make CUDA_VER=${CUDA_VER}

# Copy backend requirements and install
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy all source files
COPY . /app

# Ensure pyds (Python bindings) is accessible
ENV PYTHONPATH="/opt/nvidia/deepstream/deepstream/lib:${PYTHONPATH}"
ENV LD_LIBRARY_PATH="/opt/nvidia/deepstream/deepstream/lib:${LD_LIBRARY_PATH}"

# Chỉ cài ultralytics (bản headless để không lỗi libGL) phục vụ việc export sau này
RUN pip3 install --default-timeout=1000 --no-cache-dir ultralytics opencv-python-headless

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
