import sys
import os
import asyncio
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Add parent directory to sys.path to import local yt_dlp
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import yt_dlp

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

@app.get("/")
async def get_index():
    return FileResponse(os.path.join(os.path.dirname(__file__), "static", "index.html"))

@app.post("/api/shutdown")
async def shutdown():
    def exit_app():
        os._exit(0)
    loop = asyncio.get_event_loop()
    loop.call_later(0.5, exit_app)
    return {"message": "Shutting down server."}

class DownloadRequest(BaseModel):
    url: str
    resolution: str = "best"
    threads: int = 1
    location: str = ""

# Global State
class DownloadManager:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.active_item = None
        self.pending_items = []
        self.active_websockets = set()
        self.pause_event = None
        
    @property
    def is_paused(self):
        return not self.pause_event.is_set() if self.pause_event else True
        
    async def broadcast(self, message):
        dead_ws = set()
        for ws in self.active_websockets:
            try:
                await ws.send_json(message)
            except Exception:
                dead_ws.add(ws)
        for ws in dead_ws:
            self.active_websockets.discard(ws)

manager = DownloadManager()

# Background Worker
async def download_worker():
    while True:
        try:
            if manager.pause_event:
                await manager.pause_event.wait()
                
            item = await manager.queue.get()
        except asyncio.CancelledError:
            break
            
        try:
            manager.active_item = item
            if item in manager.pending_items:
                manager.pending_items.remove(item)
            
            # Broadcast start
            await manager.broadcast({
                "status": "queue_started",
                "item": item,
                "pending": manager.pending_items
            })
            
            # Run blocking download in a separate thread
            import threading
            from queue import Queue as ThreadQueue
            
            thread_q = ThreadQueue()
            
            def run_yt_dlp():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                def hook(d):
                    # We pass the hook data back to the main thread via the queue
                    try:
                        downloaded = d.get('downloaded_bytes', 0) or 0
                        total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                        speed = d.get('speed', 0) or 0
                        eta = d.get('eta', 0) or 0
                        filename = d.get('filename', '')
                        pct = 0
                        if total > 0:
                            pct = (downloaded / total) * 100
                            
                        msg = {
                            "status": "downloading",
                            "percent": round(pct, 2),
                            "downloaded_bytes": downloaded,
                            "total_bytes": total,
                            "speed": speed,
                            "eta": eta,
                            "filename": filename,
                            "fragment_index": d.get('fragment_index'),
                            "fragment_count": d.get('fragment_count')
                        }
                        thread_q.put(msg)
                    except Exception as e:
                        print(f"Hook Error: {e}")

                fmt = 'bestvideo+bestaudio/best'
                if item['resolution'] == 'audio':
                    fmt = 'bestaudio/best'
                elif item['resolution'] != 'best':
                    fmt = f"bestvideo[height<={item['resolution']}]+bestaudio/best"
                
                downloads_dir = item['location']
                if not downloads_dir or not os.path.exists(downloads_dir):
                    downloads_dir = os.path.join(os.path.dirname(__file__), 'downloads')
                    os.makedirs(downloads_dir, exist_ok=True)
                    
                ydl_opts = {
                    'format': fmt,
                    'outtmpl': os.path.join(downloads_dir, '%(title)s.%(ext)s'),
                    'progress_hooks': [hook],
                    'ffmpeg_location': r'C:\Users\lasik\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin',
                    'concurrent_fragment_downloads': max(1, min(int(item['threads']), 32)),
                    'http_chunk_size': 10485760,
                    'quiet': True,
                    'no_warnings': True,
                }
                
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        ydl.download([item['url']])
                    thread_q.put({"status": "finished"})
                except Exception as e:
                    thread_q.put({"status": "error", "message": str(e)})

            t = threading.Thread(target=run_yt_dlp)
            t.start()
            
            # Read from thread queue asynchronously without blocking the main event loop
            while True:
                # Use asyncio.sleep to occasionally yield control back to event loop
                await asyncio.sleep(0.05)
                while not thread_q.empty():
                    msg = thread_q.get_nowait()
                    await manager.broadcast(msg)
                    if msg['status'] in ['finished', 'error']:
                        t.join() # Thread must be done
                        break # Break inner while
                if not t.is_alive() and thread_q.empty():
                    break # Break outer while
                    
        except Exception as e:
            print(f"Worker Error: {e}")
            await manager.broadcast({"status": "error", "message": f"Worker crashed: {e}"})
        finally:
            manager.active_item = None
            manager.queue.task_done()

@app.on_event("startup")
async def startup_event():
    manager.pause_event = asyncio.Event()
    manager.pause_event.clear()
    asyncio.create_task(download_worker())

@app.get("/api/select-folder")
async def select_folder():
    try:
        import subprocess
        picker_script = os.path.join(os.path.dirname(__file__), "folder_picker.py")
        # Run in a new process to avoid blocking async event loop and tkinter thread issues.
        result = await asyncio.to_thread(
            subprocess.run, 
            [sys.executable, picker_script], 
            capture_output=True, 
            text=True
        )
        path = result.stdout.strip()
        if path:
            return {"path": path}
        return {"path": ""}
    except Exception as e:
        return {"error": str(e)}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    manager.active_websockets.add(websocket)
    
    # Send current state upon connection
    await websocket.send_json({
        "status": "state",
        "active": manager.active_item,
        "pending": manager.pending_items,
        "is_paused": manager.is_paused
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            import json
            
            try:
                req = json.loads(data)
                action = req.get("action")
                
                if action == "start_queue":
                    if manager.pause_event: manager.pause_event.set()
                    await manager.broadcast({"status": "queue_update", "pending": manager.pending_items, "is_paused": False})
                    continue
                elif action == "pause_queue":
                    if manager.pause_event: manager.pause_event.clear()
                    await manager.broadcast({"status": "queue_update", "pending": manager.pending_items, "is_paused": True})
                    continue
                    
                url = req.get("url", "")
                resolution = req.get("resolution", "best")
                threads = req.get("threads", 1)
                location = req.get("location", "")
                
                if url:
                    item = {
                        "url": url,
                        "resolution": resolution,
                        "threads": threads,
                        "location": location,
                        "title": req.get("title") or url
                    }
                    manager.pending_items.append(item)
                    await manager.queue.put(item)
                    
                    # Notify everyone about the updated queue
                    await manager.broadcast({
                        "status": "queue_update",
                        "pending": manager.pending_items
                    })
            except Exception as e:
                print(f"Invalid websocket data: {e}")
    except Exception:
        pass
    finally:
        manager.active_websockets.discard(websocket)

@app.post("/api/queue/add")
async def add_to_queue(req: DownloadRequest):
    item = {
        "url": req.url,
        "resolution": req.resolution,
        "threads": req.threads,
        "location": req.location,
        "title": req.url
    }
    manager.pending_items.append(item)
    await manager.queue.put(item)
    
    await manager.broadcast({
        "status": "queue_update",
        "pending": manager.pending_items
    })
    return {"status": "success"}

@app.get("/api/channel/info")
async def get_channel_info(url: str, page: int = 1):
    try:
        start = (page - 1) * 20 + 1
        end = page * 20
        
        ydl_opts = {
            'extract_flat': True,
            'playliststart': start,
            'playlistend': end,
            'quiet': True,
            'no_warnings': True,
        }
        
        def run_extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)
                
        info = await asyncio.to_thread(run_extract)
        
        if 'entries' in info:
            entries = []
            for entry in info.get('entries', []):
                # Ensure we handle None entries which can happen for deleted videos
                if entry is None:
                    continue
                    
                _type = entry.get('_type')
                url = entry.get('url') or entry.get('webpage_url')
                if not url and entry.get('id'):
                   url = f"https://www.youtube.com/channel/{entry.get('id')}"
                
                is_playlist = _type == 'playlist' or not entry.get('duration')
                
                entries.append({
                    'id': entry.get('id'),
                    'title': entry.get('title'),
                    'duration': entry.get('duration'),
                    'thumbnails': entry.get('thumbnails', []),
                    'url': url,
                    'is_playlist': is_playlist
                })
            return {"status": "success", "title": info.get('title'), "entries": entries}
        else:
            # Single video returned instead of a playlist
            return {"status": "success", "title": info.get('title'), "entries": [{
                'id': info.get('id'),
                'title': info.get('title'),
                'duration': info.get('duration'),
                'thumbnails': info.get('thumbnails', []),
                'url': info.get('original_url') or info.get('webpage_url')
            }]}
            
    except Exception as e:
        return {"status": "error", "message": str(e)}
