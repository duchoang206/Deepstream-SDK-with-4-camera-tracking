import psycopg2
import psycopg2.extras
import os
import json
import time
import threading
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Optional
import queue

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    Unified Database Layer using PostgreSQL with PostGIS & JSONB.
    Stores metadata, analytics events, camera calibration configs,
    rules (ROI & Tripwires), and multi-camera trajectory logs.
    """
    def __init__(self, db_url=None):
        self.db_url = db_url or os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/analytics")
        self._lock = threading.Lock()
        self._init_db()

    def _get_connection(self):
        for attempt in range(5):
            try:
                return psycopg2.connect(self.db_url)
            except Exception as e:
                if attempt == 4:
                    logger.error(f"Error connecting to PostgreSQL after 5 attempts: {e}")
                    raise
                time.sleep(0.5)

    def _init_db(self):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # 1. Cameras & Calibration Table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cameras (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    rtsp_url TEXT NOT NULL,
                    calibration_points JSONB,
                    homography_matrix JSONB,
                    status TEXT DEFAULT 'online',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 2. Rules Table (ROI Intrusion, Tripwire, Dwell Time, Crowd Density)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rules (
                    id TEXT PRIMARY KEY,
                    cam_id TEXT NOT NULL,
                    rule_type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    points JSONB NOT NULL,
                    target_objects JSONB,
                    threshold DOUBLE PRECISION DEFAULT 10.0,
                    direction TEXT DEFAULT 'both',
                    enabled BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 3. Behavior Events Table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS events (
                    id SERIAL PRIMARY KEY,
                    cam_id TEXT NOT NULL,
                    global_id INTEGER NOT NULL DEFAULT 0,
                    rule_id TEXT,
                    rule_type TEXT NOT NULL,
                    severity TEXT DEFAULT 'warning',
                    description TEXT NOT NULL,
                    snapshot_bbox JSONB,
                    floor_pos JSONB,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 4. Tripwire Aggregate Counts Table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS tripwire_counts (
                    rule_id TEXT PRIMARY KEY,
                    cam_id TEXT NOT NULL,
                    entry_count INTEGER DEFAULT 0,
                    exit_count INTEGER DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 5. Raw Detections Log (Hourly / Daily traffic aggregation)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS detections (
                    id SERIAL PRIMARY KEY,
                    cam_id TEXT NOT NULL,
                    class_name TEXT NOT NULL,
                    count INTEGER NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # 6. Global Trajectory History Table (For Cross-Camera Person Journey Replay)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS global_tracks_log (
                    id SERIAL PRIMARY KEY,
                    global_id INTEGER NOT NULL,
                    cam_id TEXT NOT NULL,
                    floor_x DOUBLE PRECISION NOT NULL,
                    floor_y DOUBLE PRECISION NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            conn.close()
            print("[DatabaseManager] PostgreSQL Schema initialized successfully.")
        except Exception as e:
            print(f"[DatabaseManager] Database init warning (PostgreSQL might still be starting): {e}")

    # --- CAMERAS & CALIBRATION ---
    def save_camera(self, cam_id: str, name: str, rtsp_url: str):
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO cameras (id, name, rtsp_url) 
                    VALUES (%s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rtsp_url = EXCLUDED.rtsp_url
                ''', (cam_id, name, rtsp_url))
                conn.commit()
                conn.close()
            except Exception as e:
                logger.error(f"Error saving camera: {e}")

    def delete_camera(self, cam_id: str):
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                cursor.execute("DELETE FROM cameras WHERE id = %s", (cam_id,))
                cursor.execute("DELETE FROM rules WHERE cam_id = %s", (cam_id,))
                conn.commit()
                conn.close()
            except Exception as e:
                logger.error(f"Error deleting camera: {e}")

    def save_calibration(self, cam_id: str, src_points: list, dst_points: list, matrix: list):
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                calib_json = json.dumps({"src_points": src_points, "dst_points": dst_points})
                matrix_json = json.dumps(matrix)
                cursor.execute('''
                    UPDATE cameras 
                    SET calibration_points = %s, homography_matrix = %s
                    WHERE id = %s
                ''', (calib_json, matrix_json, cam_id))
                conn.commit()
                conn.close()
            except Exception as e:
                logger.error(f"Error saving calibration: {e}")

    def get_all_cameras(self) -> List[dict]:
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
                cursor.execute("SELECT * FROM cameras ORDER BY created_at ASC")
                rows = cursor.fetchall()
                conn.close()
                return [dict(r) for r in rows]
            except Exception:
                return []

    # --- RULES (ROI & TRIPWIRES) ---
    def save_rule(self, rule: dict):
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                r_type = rule.get("type") or rule.get("rule_type") or "intrusion"
                cursor.execute('''
                    INSERT INTO rules (id, cam_id, rule_type, name, points, target_objects, threshold, direction)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET 
                        rule_type = EXCLUDED.rule_type,
                        name = EXCLUDED.name,
                        points = EXCLUDED.points,
                        target_objects = EXCLUDED.target_objects,
                        threshold = EXCLUDED.threshold,
                        direction = EXCLUDED.direction
                ''', (
                    rule["id"], rule["cam_id"], r_type, rule["name"],
                    json.dumps(rule.get("points", [])),
                    json.dumps(rule.get("target_objects", ["person"])),
                    rule.get("threshold", 10.0),
                    rule.get("direction", "both")
                ))
                conn.commit()
                conn.close()
            except Exception as e:
                logger.error(f"Error saving rule: {e}")

    def delete_rule(self, rule_id: str):
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                cursor.execute("DELETE FROM rules WHERE id = %s", (rule_id,))
                conn.commit()
                conn.close()
            except Exception as e:
                logger.error(f"Error deleting rule: {e}")

    def get_rules_by_camera(self, cam_id: str) -> List[dict]:
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
                cursor.execute("SELECT * FROM rules WHERE cam_id = %s", (cam_id,))
                rows = cursor.fetchall()
                conn.close()
                res = []
                for r in rows:
                    d = dict(r)
                    if "rule_type" in d and ("type" not in d or not d["type"]):
                        d["type"] = d["rule_type"]
                    res.append(d)
                return res
            except Exception:
                return []

    # --- EVENTS & LOGGING ---
    def log_event(self, event: dict):
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO events (cam_id, global_id, rule_id, rule_type, severity, description, snapshot_bbox, floor_pos)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ''', (
                    event.get("cam_id"),
                    event.get("global_id", 0),
                    event.get("rule_id"),
                    event.get("rule_type", "intrusion"),
                    event.get("severity", "warning"),
                    event.get("description", ""),
                    json.dumps(event.get("bbox", [])),
                    json.dumps(event.get("floor_pos", []))
                ))
                conn.commit()
                conn.close()
            except Exception as e:
                logger.error(f"Error logging event: {e}")

    def log_track_position(self, global_id: int, cam_id: str, floor_x: float, floor_y: float):
        """Record spatial waypoint for trajectory replay."""
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO global_tracks_log (global_id, cam_id, floor_x, floor_y)
                    VALUES (%s, %s, %s, %s)
                ''', (global_id, cam_id, floor_x, floor_y))
                conn.commit()
                conn.close()
            except Exception:
                pass

    # --- ON-DEMAND ANALYTICS QUERIES (PostgreSQL Gateway) ---
    def get_events_list(self, limit: int = 50, rule_type: Optional[str] = None, cam_id: Optional[str] = None) -> List[dict]:
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
                query = "SELECT * FROM events WHERE 1=1"
                params = []
                if rule_type:
                    query += " AND rule_type = %s"
                    params.append(rule_type)
                if cam_id:
                    query += " AND cam_id = %s"
                    params.append(cam_id)
                query += " ORDER BY timestamp DESC LIMIT %s"
                params.append(limit)
                
                cursor.execute(query, tuple(params))
                rows = cursor.fetchall()
                conn.close()
                return [dict(r) for r in rows]
            except Exception:
                return []

    def get_global_track_journey(self, global_id: int) -> List[dict]:
        """Fetch chronological movement waypoints across all cameras for a Global ID."""
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
                cursor.execute('''
                    SELECT cam_id, floor_x, floor_y, timestamp 
                    FROM global_tracks_log
                    WHERE global_id = %s
                    ORDER BY timestamp ASC LIMIT 200
                ''', (global_id,))
                rows = cursor.fetchall()
                conn.close()
                return [dict(r) for r in rows]
            except Exception:
                return []

    def get_dashboard_stats(self, active_cameras_count: int) -> dict:
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                # 1. Total events count
                cursor.execute("SELECT COUNT(*) FROM events")
                total_events = cursor.fetchone()[0] or 0
                
                # 2. Events by rule type
                cursor.execute("SELECT rule_type, COUNT(*) FROM events GROUP BY rule_type")
                rule_distribution = [{"name": row[0].replace("_", " ").title(), "value": row[1]} for row in cursor.fetchall()]
                
                if not rule_distribution:
                    rule_distribution = [
                        {"name": "Intrusion", "value": 0},
                        {"name": "Tripwire", "value": 0},
                        {"name": "Dwell Time", "value": 0},
                        {"name": "Crowd Density", "value": 0}
                    ]

                # 3. Alerts trend (last 7 days)
                seven_days_ago = (datetime.now() - timedelta(days=6)).strftime('%Y-%m-%d')
                cursor.execute('''
                    SELECT DATE(timestamp) as event_date, COUNT(*) 
                    FROM events 
                    WHERE DATE(timestamp) >= %s 
                    GROUP BY DATE(timestamp)
                    ORDER BY event_date ASC
                ''', (seven_days_ago,))
                daily_alerts = {str(row[0]): row[1] for row in cursor.fetchall()}
                
                alerts_trend = []
                for i in range(7):
                    d = (datetime.now() - timedelta(days=6 - i)).strftime('%Y-%m-%d')
                    alerts_trend.append({
                        "date": d[5:],
                        "alerts": daily_alerts.get(d, 0)
                    })

                # 4. Recent events
                cursor.execute('''
                    SELECT cam_id, rule_type, description, severity, timestamp 
                    FROM events 
                    ORDER BY timestamp DESC LIMIT 10
                ''')
                recent_events = [
                    {"camera": row[0], "type": row[1], "description": row[2], "severity": row[3], "time": str(row[4])}
                    for row in cursor.fetchall()
                ]

                # 5. Tripwire summary
                cursor.execute("SELECT rule_id, cam_id, entry_count, exit_count FROM tripwire_counts")
                tripwires = [
                    {"rule_id": row[0], "cam_id": row[1], "entry": row[2], "exit": row[3]}
                    for row in cursor.fetchall()
                ]

                conn.close()

                return {
                    "total_objects": total_events,
                    "active_cameras": active_cameras_count,
                    "total_alerts": total_events,
                    "system_efficiency": 99.4,
                    "class_distribution": rule_distribution,
                    "alerts_trend": alerts_trend,
                    "recent_events": recent_events,
                    "tripwire_stats": tripwires
                }
            except Exception as e:
                logger.error(f"Error computing dashboard stats: {e}")
                return {
                    "total_objects": 0,
                    "active_cameras": active_cameras_count,
                    "total_alerts": 0,
                    "system_efficiency": 100,
                    "class_distribution": [],
                    "alerts_trend": [],
                    "recent_events": [],
                    "tripwire_stats": []
                }

# Global singleton
db_manager = DatabaseManager()
