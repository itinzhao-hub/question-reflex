@echo off
setlocal
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not available in PATH.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] This folder is not initialized as a Git repository.
  echo Run github_first_setup.bat first.
  pause
  exit /b 1
)

echo.
echo Current changes:
git status --short
echo.

set /p MSG=Commit message [Update training content]: 
if "%MSG%"=="" set "MSG=Update training content"

git add -A
if errorlevel 1 goto :fail

git diff --cached --quiet
if not errorlevel 1 (
  echo [INFO] No changes to commit.
  echo Trying git push anyway...
  git push
  pause
  exit /b %errorlevel%
)

git commit -m "%MSG%"
if errorlevel 1 goto :fail

git push
if errorlevel 1 goto :fail

echo.
echo [OK] Pushed to GitHub. GitHub Pages will publish from main /(root).
pause
exit /b 0

:fail
echo.
echo [ERROR] Git command failed. Check the messages above.
pause
exit /b 1
