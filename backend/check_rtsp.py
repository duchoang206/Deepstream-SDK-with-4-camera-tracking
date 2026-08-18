import asyncio
import socket
from urllib.parse import urlparse

async def is_rtsp_valid_async(url: str, timeout: float = 2.0) -> bool:
    try:
        clean = url
        if "@" in clean:
            clean = "rtsp://" + clean.split("@", 1)[1]
        
        parsed = urlparse(clean)
        host = parsed.hostname
        port = parsed.port or 554
        
        if not host:
            return False
            
        loop = asyncio.get_running_loop()
        
        def check_tcp():
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(timeout)
            try:
                res = s.connect_ex((host, int(port)))
                s.close()
                return res == 0
            except Exception:
                return False
                
        return await loop.run_in_executor(None, check_tcp)
    except Exception as e:
        print(f"[check_rtsp] Error checking {url}: {e}", flush=True)
        return False
