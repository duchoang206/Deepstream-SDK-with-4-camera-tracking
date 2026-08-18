import os
import time
import threading
from datetime import datetime

class CircularLogger:
    """
    A logger that writes events to file and automatically cleans up old logs 
    when the total size of the log directory exceeds a specified limit (default 3GB).
    """
    def __init__(self, log_dir="logs", max_size_bytes=3*1024*1024*1024, check_interval_sec=60):
        self.log_dir = log_dir
        self.max_size_bytes = max_size_bytes
        self.check_interval_sec = check_interval_sec
        self.running = True
        
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir)
            
        # Current active log file (rolling by day)
        self.current_log_file = self._get_current_log_path()
        
        # Start cleanup thread
        self.cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self.cleanup_thread.start()

    def _get_current_log_path(self):
        date_str = datetime.now().strftime("%Y-%m-%d")
        return os.path.join(self.log_dir, f"events_{date_str}.log")

    def log_event(self, cam_id, roi_id, status):
        """
        Write an event to the log.
        Format: [YYYY-MM-DD HH:MM:SS] Cam: <cam_id> ROI ID: <roi_id> <status>
        Example: [2026-08-07 15:30:00] Cam: 1 ROI ID: 2 Empty
        """
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
        log_line = f"[{timestamp}] Cam: {cam_id} ROI ID: {roi_id} {status}\n"
        
        # Check if day changed to create new log file
        new_log_file = self._get_current_log_path()
        if new_log_file != self.current_log_file:
            self.current_log_file = new_log_file
            
        try:
            with open(self.current_log_file, 'a') as f:
                f.write(log_line)
        except Exception as e:
            print(f"Failed to write log: {e}")

    def _get_dir_size(self):
        total_size = 0
        for dirpath, _, filenames in os.walk(self.log_dir):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if not os.path.islink(fp):
                    total_size += os.path.getsize(fp)
        return total_size

    def _cleanup_loop(self):
        while self.running:
            try:
                current_size = self._get_dir_size()
                if current_size > self.max_size_bytes:
                    print(f"[CircularLogger] Log dir size ({current_size / (1024*1024):.2f}MB) exceeds limit ({self.max_size_bytes / (1024*1024):.2f}MB). Cleaning up...")
                    self._delete_oldest_files()
            except Exception as e:
                print(f"[CircularLogger] Cleanup error: {e}")
            
            time.sleep(self.check_interval_sec)

    def _delete_oldest_files(self):
        # Get list of files with their modified times
        files = []
        for f in os.listdir(self.log_dir):
            full_path = os.path.join(self.log_dir, f)
            if os.path.isfile(full_path):
                files.append((full_path, os.path.getmtime(full_path)))
                
        # Sort by oldest first
        files.sort(key=lambda x: x[1])
        
        # Delete files until size is under limit
        current_size = self._get_dir_size()
        for filepath, _ in files:
            if current_size <= self.max_size_bytes:
                break
            
            # Don't delete the active log file unless it's the only one
            if filepath == self.current_log_file and len(files) > 1:
                continue
                
            try:
                file_size = os.path.getsize(filepath)
                os.remove(filepath)
                current_size -= file_size
                print(f"[CircularLogger] Deleted old log file: {filepath}")
            except Exception as e:
                print(f"[CircularLogger] Failed to delete {filepath}: {e}")

    def stop(self):
        self.running = False
        if self.cleanup_thread.is_alive():
            self.cleanup_thread.join(timeout=2)

app_logger = CircularLogger()

if __name__ == "__main__":
    # Test circular logger with a very small limit (e.g. 100 bytes)
    print("Testing CircularLogger with 100 bytes limit...")
    test_logger = CircularLogger(log_dir="test_logs", max_size_bytes=100, check_interval_sec=2)
    
    try:
        for i in range(10):
            test_logger.log_event("Cam_1", "ROI_1", "Full")
            time.sleep(1)
            print(f"Logged event {i+1}. Current dir size: {test_logger._get_dir_size()} bytes")
    except KeyboardInterrupt:
        pass
    finally:
        test_logger.stop()
        print("Logger stopped.")
