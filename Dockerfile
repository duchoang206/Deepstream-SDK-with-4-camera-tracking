FROM nvcr.io/nvidia/deepstream:6.3-triton-multiarch

WORKDIR /opt/nvidia/deepstream/deepstream-6.3/sources/apps/sample_apps/deepstream-4cam-tracker

COPY . .

RUN make clean && make

CMD ["./scripts/run.sh"]
