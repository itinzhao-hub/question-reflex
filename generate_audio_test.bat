@echo off
cd /d "%~dp0"
echo Generating all enabled profiles for the first 4 active stimuli...
py tools\generate_audio.py --limit 4
if errorlevel 1 (
  pause
  exit /b 1
)
py tools\build.py
echo.
echo Test generation complete.
pause
