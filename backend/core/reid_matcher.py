import time
import numpy as np
from typing import Dict, List, Optional, Tuple
from scipy.optimize import linear_sum_assignment
from core.camera_calibrator import camera_calibrator

class GlobalTrack:
    def __init__(self, global_id: int, initial_cam_id: str, initial_bbox: List[float], floor_pos: Tuple[float, float], feature_vector: Optional[np.ndarray] = None):
        self.global_id = global_id
        self.last_cam_id = initial_cam_id
        self.last_bbox = initial_bbox # [x, y, w, h] normalized 0..1
        self.floor_pos = floor_pos # (X_floor, Y_floor)
        self.last_seen = time.time()
        self.first_seen = self.last_seen
        self.feature_vector = feature_vector
        # List of (timestamp, cam_id, bbox, floor_pos)
        self.history: List[Tuple[float, str, List[float], Tuple[float, float]]] = [(self.last_seen, initial_cam_id, initial_bbox, floor_pos)]
        self.alpha = 0.85 # EMA weight for gallery feature updates

    def update(self, cam_id: str, bbox: List[float], floor_pos: Tuple[float, float], feature_vector: Optional[np.ndarray] = None):
        self.last_cam_id = cam_id
        self.last_bbox = bbox
        self.floor_pos = floor_pos
        self.last_seen = time.time()
        
        if feature_vector is not None:
            if self.feature_vector is None:
                self.feature_vector = feature_vector
            else:
                norm_feat = feature_vector / (np.linalg.norm(feature_vector) + 1e-6)
                self.feature_vector = self.alpha * self.feature_vector + (1.0 - self.alpha) * norm_feat
                self.feature_vector = self.feature_vector / (np.linalg.norm(self.feature_vector) + 1e-6)
                
        self.history.append((self.last_seen, cam_id, bbox, floor_pos))
        if len(self.history) > 120:
            self.history.pop(0)

class GlobalReIDMatcher:
    """
    Multi-Target Multi-Camera (MTMC) Fusion Engine.
    Combines:
    1. Appearance Feature Vectors (Cosine Similarity)
    2. Spatial Proximity on the 2D/3D Floor Plan (via Camera Calibration)
    3. Spatio-Temporal Transition Constraints
    4. Hungarian Assignment Optimization
    """
    def __init__(self, sim_threshold: float = 0.60, max_floor_dist: float = 0.35, max_time_gap: float = 20.0):
        self.sim_threshold = sim_threshold
        self.max_floor_dist = max_floor_dist # Normalized floor plan distance threshold
        self.max_time_gap = max_time_gap
        self.next_global_id = 1
        self.gallery: Dict[int, GlobalTrack] = {} # global_id -> GlobalTrack
        self.local_to_global_map: Dict[Tuple[str, int], int] = {} # (cam_id, local_id) -> global_id
        self.last_cleanup = time.time()

    def _cleanup_old_tracks(self):
        now = time.time()
        if now - self.last_cleanup < 5.0:
            return
        self.last_cleanup = now
        expired_ids = [gid for gid, track in self.gallery.items() if now - track.last_seen > self.max_time_gap]
        for gid in expired_ids:
            del self.gallery[gid]
            
        active_gids = set(self.gallery.keys())
        self.local_to_global_map = {
            k: v for k, v in self.local_to_global_map.items() if v in active_gids
        }

    def process_camera_detections(self, cam_id: str, detections: List[dict]) -> List[dict]:
        """
        Input:
          detections: list of dicts { local_id, bbox: [x,y,w,h], confidence, feature (optional) }
        Returns:
          augmented detections with 'global_id', 'floor_x', 'floor_y'.
        """
        self._cleanup_old_tracks()
        now = time.time()
        augmented = []
        unmatched_dets = []
        
        for det in detections:
            local_id = det["local_id"]
            key = (cam_id, local_id)
            bbox = det["bbox"]
            
            # Bottom-center point of bounding box
            cx = bbox[0] + bbox[2] / 2.0
            cy = bbox[1] + bbox[3]
            floor_x, floor_y = camera_calibrator.camera_to_floor(cam_id, cx, cy)
            det["floor_x"] = floor_x
            det["floor_y"] = floor_y
            
            # 1. Existing active track within this camera
            if key in self.local_to_global_map:
                gid = self.local_to_global_map[key]
                if gid in self.gallery:
                    self.gallery[gid].update(cam_id, bbox, (floor_x, floor_y), det.get("feature"))
                    det_copy = dict(det)
                    det_copy["global_id"] = gid
                    augmented.append(det_copy)
                    continue

            unmatched_dets.append(det)

        if not unmatched_dets:
            return augmented

        # 2. MTMC Hungarian Matching across candidate gallery tracks from other cameras
        candidate_gids = [
            gid for gid, track in self.gallery.items()
            if (now - track.last_seen <= self.max_time_gap and track.last_cam_id != cam_id)
        ]

        if candidate_gids and unmatched_dets:
            num_dets = len(unmatched_dets)
            num_cands = len(candidate_gids)
            cost_matrix = np.ones((num_dets, num_cands), dtype=np.float32) * 2.0
            
            for i, det in enumerate(unmatched_dets):
                det_fx, det_fy = det["floor_x"], det["floor_y"]
                det_feat = det.get("feature")
                if det_feat is not None:
                    det_feat = det_feat / (np.linalg.norm(det_feat) + 1e-6)
                    
                for j, gid in enumerate(candidate_gids):
                    track = self.gallery[gid]
                    # Spatial Distance on Floor Plan
                    track_fx, track_fy = track.floor_pos
                    floor_dist = np.hypot(det_fx - track_fx, det_fy - track_fy)
                    
                    # Visual Appearance Distance
                    visual_dist = 1.0
                    if det_feat is not None and track.feature_vector is not None:
                        sim = float(np.dot(det_feat, track.feature_vector))
                        visual_dist = 1.0 - max(0.0, sim)
                    
                    # Fused cost (70% visual appearance + 30% spatial floor proximity)
                    if det_feat is not None and track.feature_vector is not None:
                        fused_cost = 0.7 * visual_dist + 0.3 * (floor_dist / max(1e-4, self.max_floor_dist))
                    else:
                        # Fallback to spatial proximity when feature vectors are not yet extracted
                        fused_cost = floor_dist / max(1e-4, self.max_floor_dist)
                        
                    cost_matrix[i, j] = fused_cost

            row_ind, col_ind = linear_sum_assignment(cost_matrix)
            assigned_rows = set()
            
            for r, c in zip(row_ind, col_ind):
                cost = cost_matrix[r, c]
                if cost < 1.0: # Valid match
                    det = unmatched_dets[r]
                    gid = candidate_gids[c]
                    self.gallery[gid].update(cam_id, det["bbox"], (det["floor_x"], det["floor_y"]), det.get("feature"))
                    self.local_to_global_map[(cam_id, det["local_id"])] = gid
                    det_copy = dict(det)
                    det_copy["global_id"] = gid
                    augmented.append(det_copy)
                    assigned_rows.add(r)
                    
            unmatched_dets = [d for idx, d in enumerate(unmatched_dets) if idx not in assigned_rows]

        # 3. Create new Global ID for remaining unmatched detections
        for det in unmatched_dets:
            gid = self.next_global_id
            self.next_global_id += 1
            
            feat = det.get("feature")
            if feat is not None:
                feat = feat / (np.linalg.norm(feat) + 1e-6)
                
            self.gallery[gid] = GlobalTrack(gid, cam_id, det["bbox"], (det["floor_x"], det["floor_y"]), feat)
            self.local_to_global_map[(cam_id, det["local_id"])] = gid
            
            det_copy = dict(det)
            det_copy["global_id"] = gid
            augmented.append(det_copy)

        return augmented

    def get_track_history(self, global_id: int) -> Optional[dict]:
        track = self.gallery.get(global_id)
        if not track:
            return None
        return {
            "global_id": track.global_id,
            "last_camera": track.last_cam_id,
            "first_seen": track.first_seen,
            "last_seen": track.last_seen,
            "current_floor_pos": track.floor_pos,
            "trajectory": [
                {"timestamp": h[0], "cam_id": h[1], "bbox": h[2], "floor_pos": h[3]}
                for h in track.history
            ]
        }

# Global singleton
global_reid = GlobalReIDMatcher(sim_threshold=0.60, max_floor_dist=0.35, max_time_gap=20.0)
