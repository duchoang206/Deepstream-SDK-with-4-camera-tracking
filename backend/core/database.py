import psycopg2
import os
import threading
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, db_url=None):
        self.db_url = db_url or os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/analytics")
        self._lock = threading.Lock()
        self._init_db()

    def _get_connection(self):
        try:
            return psycopg2.connect(self.db_url)
        except Exception as e:
            logger.error(f"Error connecting to PostgreSQL: {e}")
            raise

    def _init_db(self):
        with self._lock:
            try:
                conn = self._get_connection()
                cursor = conn.cursor()
                
                # Table for ROI intrusion events
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS events (
                        id SERIAL PRIMARY KEY,
                        cam_id TEXT NOT NULL,
                        roi_id TEXT NOT NULL,
                        status TEXT NOT NULL,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Table for raw detections
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS detections (
                        id SERIAL PRIMARY KEY,
                        cam_id TEXT NOT NULL,
                        class_name TEXT NOT NULL,
                        count INTEGER NOT NULL,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                conn.commit()
                conn.close()
            except Exception as e:
                logger.error(f"Failed to initialize database: {e}")

    def log_event(self, cam_id, roi_id, status):
        """Log an ROI status change event."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO events (cam_id, roi_id, status) VALUES (%s, %s, %s)",
                (cam_id, roi_id, status)
            )
            conn.commit()
            conn.close()

    def log_detections(self, cam_id, class_counts):
        """
        Log current frame detections. 
        class_counts is a dict: {'car': 2, 'motorcycle': 1}
        """
        if not class_counts:
            return
            
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            for class_name, count in class_counts.items():
                if count > 0:
                    cursor.execute(
                        "INSERT INTO detections (cam_id, class_name, count) VALUES (%s, %s, %s)",
                        (cam_id, class_name, count)
                    )
            conn.commit()
            conn.close()

    def get_dashboard_stats(self, active_cameras_count):
        """Aggregate data for the dashboard."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # 1. Total objects detected (sum of all max objects seen, or we just sum raw detections for simplicity)
            cursor.execute("SELECT SUM(count) FROM detections")
            total_objects = cursor.fetchone()[0] or 0
            
            # 2. Total Alerts (events where status='Carfull')
            cursor.execute("SELECT COUNT(*) FROM events WHERE status='Carfull'")
            total_alerts = cursor.fetchone()[0] or 0
            
            # 3. Detection distribution by class
            cursor.execute("SELECT class_name, SUM(count) FROM detections GROUP BY class_name")
            class_distribution = [{"name": row[0].capitalize(), "value": row[1]} for row in cursor.fetchall()]
            
            if not class_distribution:
                class_distribution = [
                    {"name": "Car", "value": 0},
                    {"name": "Motorcycle", "value": 0},
                    {"name": "Bus", "value": 0},
                    {"name": "Truck", "value": 0}
                ]
            
            # 4. Alerts over time (last 7 days grouped by date)
            seven_days_ago = (datetime.now() - timedelta(days=6)).strftime('%Y-%m-%d')
            cursor.execute('''
                SELECT DATE(timestamp) as event_date, COUNT(*) 
                FROM events 
                WHERE status='Carfull' AND DATE(timestamp) >= %s 
                GROUP BY DATE(timestamp)
                ORDER BY event_date ASC
            ''', (seven_days_ago,))
            
            daily_alerts = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Fill in empty days
            alerts_trend = []
            for i in range(7):
                d = (datetime.now() - timedelta(days=6 - i)).strftime('%Y-%m-%d')
                alerts_trend.append({
                    "date": d[5:], # MM-DD
                    "alerts": daily_alerts.get(d, 0)
                })

            # 5. Recent events (for Recent Alerts table)
            cursor.execute('''
                SELECT cam_id, roi_id, status, timestamp 
                FROM events 
                ORDER BY timestamp DESC LIMIT 5
            ''')
            recent_events = [{"camera": row[0], "type": row[1], "status": row[2], "time": row[3]} for row in cursor.fetchall()]
            
            # 6. Camera stats (for Camera Statistics table)
            cursor.execute('''
                SELECT cam_id, SUM(count) as total_detects 
                FROM detections 
                GROUP BY cam_id
            ''')
            camera_stats = [{"camera": row[0], "total": row[1]} for row in cursor.fetchall()]

            conn.close()
            
            return {
                "total_objects": total_objects,
                "active_cameras": active_cameras_count,
                "total_alerts": total_alerts,
                "system_efficiency": 98, # Mocked value for now
                "class_distribution": class_distribution,
                "alerts_trend": alerts_trend,
                "recent_events": recent_events,
                "camera_stats": camera_stats
            }

# Global singleton
db_manager = DatabaseManager()
