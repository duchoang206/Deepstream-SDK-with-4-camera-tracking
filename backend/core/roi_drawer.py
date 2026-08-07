import cv2
import json
import os
import numpy as np

class ROIDrawer:
    """
    OpenCV-based ROI configurator.
    Allows users to draw polygons on an image/frame.
    Controls:
    - 'c': clear current drawing
    - 's': save to json
    - 'q': quit without saving
    """
    def __init__(self, image, window_name="Draw ROI", save_path="roi_config.json"):
        self.original_image = image.copy()
        self.image = image.copy()
        self.window_name = window_name
        self.save_path = save_path
        
        self.current_polygon = []
        self.polygons = [] # List of list of points
        
        # Load existing ROIs if available
        if os.path.exists(self.save_path):
            try:
                with open(self.save_path, 'r') as f:
                    data = json.load(f)
                    self.polygons = data.get("rois", [])
            except Exception as e:
                print(f"Failed to load existing ROIs: {e}")

    def _mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.current_polygon.append([x, y])
            self._redraw()

    def _redraw(self):
        self.image = self.original_image.copy()
        
        # Draw existing polygons
        for i, poly in enumerate(self.polygons):
            pts = np.array(poly, np.int32)
            pts = pts.reshape((-1, 1, 2))
            cv2.polylines(self.image, [pts], isClosed=True, color=(0, 255, 0), thickness=2)
            # Put label
            if len(poly) > 0:
                cv2.putText(self.image, f"ROI_{i}", (poly[0][0], poly[0][1] - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
        # Draw current polygon
        if len(self.current_polygon) > 0:
            for pt in self.current_polygon:
                cv2.circle(self.image, tuple(pt), 4, (0, 0, 255), -1)
            if len(self.current_polygon) > 1:
                pts = np.array(self.current_polygon, np.int32)
                pts = pts.reshape((-1, 1, 2))
                cv2.polylines(self.image, [pts], isClosed=False, color=(0, 0, 255), thickness=2)
                
        cv2.imshow(self.window_name, self.image)

    def run(self):
        cv2.namedWindow(self.window_name)
        cv2.setMouseCallback(self.window_name, self._mouse_callback)
        self._redraw()
        
        print("Controls: [Left-Click] add point | [Enter/Space] finish polygon | 'c' clear current | 'd' delete last polygon | 's' save & quit | 'q' quit without save")
        
        while True:
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('q'):
                print("Exiting without saving.")
                break
            elif key == ord('s'):
                self.save()
                print(f"Saved ROIs to {self.save_path}")
                break
            elif key == ord('c'):
                self.current_polygon = []
                self._redraw()
                print("Cleared current drawing.")
            elif key == ord('d'):
                if len(self.polygons) > 0:
                    self.polygons.pop()
                    self._redraw()
                    print("Deleted last saved polygon.")
            elif key == 13 or key == 32: # Enter or Space
                if len(self.current_polygon) > 2:
                    self.polygons.append(self.current_polygon)
                    self.current_polygon = []
                    self._redraw()
                    print("Polygon completed.")
                else:
                    print("Need at least 3 points to form a polygon.")
                    
        cv2.destroyAllWindows()

    def save(self):
        with open(self.save_path, 'w') as f:
            json.dump({"rois": self.polygons}, f, indent=4)

if __name__ == "__main__":
    # Create a dummy image for testing
    dummy_img = np.zeros((720, 1280, 3), dtype=np.uint8)
    # Add some grid lines to make it look like a camera view
    for i in range(0, 1280, 100):
        cv2.line(dummy_img, (i, 0), (i, 720), (50, 50, 50), 1)
    for i in range(0, 720, 100):
        cv2.line(dummy_img, (0, i), (1280, i), (50, 50, 50), 1)
        
    drawer = ROIDrawer(dummy_img, save_path="test_roi.json")
    drawer.run()
