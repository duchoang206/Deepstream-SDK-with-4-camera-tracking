from shapely.geometry import Point, Polygon
from typing import List, Tuple

class IntrusionDetector:
    def __init__(self):
        pass

    def create_polygon(self, points: List[List[int]]) -> Polygon:
        """
        Convert list of [x, y] coordinates into a Shapely Polygon.
        """
        if len(points) < 3:
            raise ValueError("Polygon must have at least 3 points")
        return Polygon(points)

    def check_intrusion_point(self, point: Tuple[int, int], polygon: Polygon) -> bool:
        """
        Check if a single point (e.g., bottom-center of a bounding box) is inside the polygon.
        """
        p = Point(point[0], point[1])
        return polygon.contains(p)

    def check_intrusion_bbox(self, bbox: List[float], polygon: Polygon, spatial_method="bbox_intersects") -> bool:
        """
        Check if a bounding box [x1, y1, x2, y2] intrudes into the polygon.
        spatial_method: "bbox_intersects" or "center_bottom".
        """
        x1, y1, x2, y2 = bbox
        
        if spatial_method == "center_bottom":
            center_x = (x1 + x2) / 2.0
            bottom_y = y2
            return self.check_intrusion_point((center_x, bottom_y), polygon)
        elif spatial_method == "center":
            center_x = (x1 + x2) / 2.0
            center_y = (y1 + y2) / 2.0
            return self.check_intrusion_point((center_x, center_y), polygon)
        elif spatial_method == "bbox_intersects":
            # Check intersection of bounding box rectangle with polygon
            bbox_poly = Polygon([
                (x1, y1),
                (x2, y1),
                (x2, y2),
                (x1, y2)
            ])
            return polygon.intersects(bbox_poly)
        return False
