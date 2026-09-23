@echo off
cd /d "%~dp0"
py tools\build.py
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo Build complete.
pause
