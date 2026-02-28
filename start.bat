@echo off
echo Starting yt-dlp Studio...
cd /d "%~dp0"
start http://localhost:8000
python -m uvicorn ui.app:app --host localhost --port 8000
pause
