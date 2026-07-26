#include <iostream>
#include <gst/gst.h>
#include "utils.h"

int main(int argc, char *argv[]) {
    std::cout << "Starting 4-camera DeepStream Tracking application..." << std::endl;
    
    // Initialize GStreamer
    gst_init(&argc, &argv);

    // TODO: Build DeepStream pipeline here
    
    std::cout << "Application finished." << std::endl;
    return 0;
}
