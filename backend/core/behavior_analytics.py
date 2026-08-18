import time
import numpy as np
from typing import Dict, List, Tuple, Optional
from shapely.geometry import Point, Polygon, LineString

class BehaviorAnalyticsEngine:
    """
    Real-Time Behavior Analytics Engine.
    Processes tracking metadata against defined geometric rules:
    1. Intrusion Detection (Zone entry/trespassing)
    2. Tripwire Line Crossing (Directional crossing counter: In/Out)
    3. Dwell Time / Loitering (Target staying > threshold seconds)
    4. Crowd Density (Occupancy threshold alerts)
    """
    def __init__(self):
        # cam_id -> list of rules
        # rule = { "id": str, "type": "intrusion"|"tripwire"|"dwell_time"|"density", "config": dict }
        self.rules: Dict[str, List[dict]] = {}
        
        # Tripwire cumulative counters: rule_id -> { "in": int, "out": int }
        self.tripwire_counts: Dict[str, dict] = {}
        
        # Track history for line crossing: (cam_id, global_id) -> list of (timestamp, (x, y))
        self.track_positions: Dict[Tuple[str, int], List[Tuple[float, Tuple[float, float]]]] = {}
        
        # Dwell tracking: (cam_id, rule_id, global_id) -> first_seen_timestamp
        self.zone_occupancy: Dict[Tuple[str, str, int], float] = {}
        
        # Active alert cooldown to avoid spamming alerts: (cam_id, rule_id, global_id) -> last_alert_time
        self.alert_cooldowns: Dict[Tuple[str, str, int], float] = {}

    def set_rules(self, cam_id: str, rules_list: List[dict]):
        """
        Update rule configurations for a camera.
        """
        parsed_rules = []
        for r in rules_list:
            rule_type = r.get("type", "intrusion")
            rule_id = r.get("id", f"rule_{len(parsed_rules)+1}")
            points = r.get("points", []) # normalized [[x,y]...]
            target_objects = [t.lower() for t in r.get("target_objects", ["person"])]
            
            rule_obj = {
                "id": rule_id,
                "type": rule_type,
                "name": r.get("name", rule_id),
                "points": points,
                "target_objects": target_objects,
                "threshold": r.get("threshold", 10.0), # seconds for dwell time or count for density
                "direction": r.get("direction", "both") # "forward", "backward", "both" for tripwire
            }
            
            if rule_type in ("intrusion", "dwell_time", "density") and len(points) >= 3:
                try:
                    rule_obj["polygon"] = Polygon(points)
                except Exception:
                    rule_obj["polygon"] = None
            elif rule_type == "tripwire" and len(points) >= 2:
                try:
                    rule_obj["line"] = LineString(points[:2])
                except Exception:
                    rule_obj["line"] = None
                    
            parsed_rules.append(rule_obj)
            if rule_id not in self.tripwire_counts:
                self.tripwire_counts[rule_id] = {"in": 0, "out": 0}
                
        self.rules[cam_id] = parsed_rules

    def process_frame(self, cam_id: str, objects: List[dict]) -> Tuple[List[dict], Dict[str, dict]]:
        """
        Evaluates current detections against active camera rules.
        Returns:
          - triggered_events: list of alert event dicts
          - tripwire_stats: updated tripwire counters for the camera
        """
        now = time.time()
        triggered_events = []
        cam_rules = self.rules.get(cam_id, [])
        if not cam_rules:
            return triggered_events, self.get_tripwire_stats(cam_id)
            
        current_gids_in_frame = set()
        zone_occupants: Dict[str, List[int]] = {} # rule_id -> list of global_ids inside
        
        for obj in objects:
            gid = obj["id"]
            current_gids_in_frame.add(gid)
            x, y, w, h = obj["x"], obj["y"], obj["w"], obj["h"]
            
            # Ground contact point of bounding box (feet of person)
            bottom_center = (round(x + w / 2.0, 4), round(y + h, 4))
            pt_geom = Point(bottom_center[0], bottom_center[1])
            
            # Update trajectory for line crossing
            pos_key = (cam_id, gid)
            if pos_key not in self.track_positions:
                self.track_positions[pos_key] = []
            self.track_positions[pos_key].append((now, bottom_center))
            if len(self.track_positions[pos_key]) > 20:
                self.track_positions[pos_key].pop(0)
                
            prev_pos = self.track_positions[pos_key][-2][1] if len(self.track_positions[pos_key]) >= 2 else None
            
            # Check all rules for this camera
            for rule in cam_rules:
                rule_id = rule["id"]
                rule_type = rule["type"]
                
                # --- 1. INTRUSION DETECTION ---
                if rule_type == "intrusion" and rule.get("polygon"):
                    poly = rule["polygon"]
                    if poly.contains(pt_geom):
                        cooldown_key = (cam_id, rule_id, gid)
                        if now - self.alert_cooldowns.get(cooldown_key, 0) > 5.0:
                            self.alert_cooldowns[cooldown_key] = now
                            triggered_events.append({
                                "cam_id": cam_id,
                                "global_id": gid,
                                "rule_id": rule_id,
                                "rule_type": "intrusion",
                                "severity": "critical",
                                "description": f"Xâm nhập vùng cấm '{rule['name']}' bởi đối tượng #{gid}",
                                "bbox": [x, y, w, h],
                                "timestamp": int(now * 1000)
                            })
                            
                # --- 2. TRIPWIRE / LINE CROSSING ---
                elif rule_type == "tripwire" and rule.get("line") and prev_pos is not None:
                    line_geom = rule["line"]
                    motion_seg = LineString([prev_pos, bottom_center])
                    
                    if motion_seg.intersects(line_geom):
                        # Determine crossing direction using 2D cross-product
                        p1 = rule["points"][0]
                        p2 = rule["points"][1]
                        line_vec = (p2[0] - p1[0], p2[1] - p1[1])
                        motion_vec = (bottom_center[0] - prev_pos[0], bottom_center[1] - prev_pos[1])
                        
                        cross_prod = line_vec[0] * motion_vec[1] - line_vec[1] * motion_vec[0]
                        direction = "in" if cross_prod > 0 else "out"
                        
                        cooldown_key = (cam_id, rule_id, gid)
                        if now - self.alert_cooldowns.get(cooldown_key, 0) > 2.0:
                            self.alert_cooldowns[cooldown_key] = now
                            self.tripwire_counts[rule_id][direction] = self.tripwire_counts[rule_id].get(direction, 0) + 1
                            
                            triggered_events.append({
                                "cam_id": cam_id,
                                "global_id": gid,
                                "rule_id": rule_id,
                                "rule_type": "tripwire",
                                "severity": "info",
                                "direction": direction,
                                "description": f"Vượt vạch ảo '{rule['name']}' ({direction.upper()}) bởi đối tượng #{gid}",
                                "counts": dict(self.tripwire_counts[rule_id]),
                                "bbox": [x, y, w, h],
                                "timestamp": int(now * 1000)
                            })

                # --- 3. DWELL TIME (LOITERING) ---
                elif rule_type == "dwell_time" and rule.get("polygon"):
                    poly = rule["polygon"]
                    if poly.contains(pt_geom):
                        zone_key = (cam_id, rule_id, gid)
                        if zone_key not in self.zone_occupancy:
                            self.zone_occupancy[zone_key] = now
                        dwell_duration = now - self.zone_occupancy[zone_key]
                        
                        max_dwell = float(rule.get("threshold", 15.0))
                        if dwell_duration > max_dwell:
                            cooldown_key = (cam_id, rule_id, gid)
                            if now - self.alert_cooldowns.get(cooldown_key, 0) > 10.0:
                                self.alert_cooldowns[cooldown_key] = now
                                triggered_events.append({
                                    "cam_id": cam_id,
                                    "global_id": gid,
                                    "rule_id": rule_id,
                                    "rule_type": "dwell_time",
                                    "severity": "warning",
                                    "dwell_seconds": round(dwell_duration, 1),
                                    "description": f"Lảng vãng / dừng chờ lâu ({round(dwell_duration)}s > {int(max_dwell)}s) tại '{rule['name']}' đối tượng #{gid}",
                                    "bbox": [x, y, w, h],
                                    "timestamp": int(now * 1000)
                                })
                    else:
                        # Target left the zone
                        zone_key = (cam_id, rule_id, gid)
                        self.zone_occupancy.pop(zone_key, None)

                # --- 4. CROWD DENSITY ---
                elif rule_type == "density" and rule.get("polygon"):
                    poly = rule["polygon"]
                    if poly.contains(pt_geom):
                        if rule_id not in zone_occupants:
                            zone_occupants[rule_id] = []
                        zone_occupants[rule_id].append(gid)

        # Check Density Thresholds
        for rule in cam_rules:
            if rule["type"] == "density":
                rule_id = rule["id"]
                current_count = len(zone_occupants.get(rule_id, []))
                max_capacity = int(rule.get("threshold", 5))
                if current_count >= max_capacity:
                    cooldown_key = (cam_id, rule_id, 0)
                    if now - self.alert_cooldowns.get(cooldown_key, 0) > 10.0:
                        self.alert_cooldowns[cooldown_key] = now
                        triggered_events.append({
                            "cam_id": cam_id,
                            "global_id": 0,
                            "rule_id": rule_id,
                            "rule_type": "density",
                            "severity": "warning",
                            "count": current_count,
                            "max_capacity": max_capacity,
                            "description": f"Cảnh báo quá tải mật độ: {current_count} người tập trung tại '{rule['name']}' (ngưỡng {max_capacity})",
                            "timestamp": int(now * 1000)
                        })

        # Cleanup expired track positions & zone occupancies
        self._cleanup(now, current_gids_in_frame, cam_id)
        
        return triggered_events, self.get_tripwire_stats(cam_id)

    def _cleanup(self, now: float, current_gids: set, cam_id: str):
        # Remove tracks inactive for > 10 seconds
        keys_to_del = [k for k in self.track_positions.keys() if k[0] == cam_id and k[1] not in current_gids]
        for k in keys_to_del:
            self.track_positions.pop(k, None)
            
        # Clean zone occupancy
        zone_keys_to_del = [k for k in self.zone_occupancy.keys() if k[0] == cam_id and k[2] not in current_gids]
        for k in zone_keys_to_del:
            self.zone_occupancy.pop(k, None)

    def get_tripwire_stats(self, cam_id: str) -> Dict[str, dict]:
        cam_rules = self.rules.get(cam_id, [])
        stats = {}
        for r in cam_rules:
            if r["type"] == "tripwire":
                rid = r["id"]
                stats[rid] = {
                    "name": r["name"],
                    "in": self.tripwire_counts.get(rid, {}).get("in", 0),
                    "out": self.tripwire_counts.get(rid, {}).get("out", 0)
                }
        return stats

# Global singleton
behavior_engine = BehaviorAnalyticsEngine()
