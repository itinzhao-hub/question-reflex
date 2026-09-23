@echo off
cd /d "%~dp0"
py tools\generate_audio.py
if errorlevel 1 (
  pause
  exit /b 1
)
py tools\build.py
echo.
echo Full audio generation complete.
pause
