import asyncio
import subprocess

async def is_rtsp_valid_async(url, timeout=3):
    try:
        process = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet", "-rtsp_transport", "tcp", "-i", url,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        try:
            await asyncio.wait_for(process.wait(), timeout=timeout)
            return process.returncode == 0
        except asyncio.TimeoutError:
            process.kill()
            return False
    except Exception:
        return False
