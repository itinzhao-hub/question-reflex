@echo off
cd /d "%~dp0"
echo Starting Question Reflex at http://localhost:8765/
echo Keep the server window open while training.
echo Close the server window when finished.
start "Question Reflex Server" cmd /k "cd /d ""%~dp0"" && py -m http.server 8765"
timeout /t 1 /nobreak > nul
start "" "http://localhost:8765/"
