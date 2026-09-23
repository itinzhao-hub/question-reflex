@echo off
setlocal
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not available in PATH.
  echo Install Git for Windows first: https://git-scm.com/download/win
  pause
  exit /b 1
)

if exist ".git" (
  echo [INFO] This folder is already a Git repository.
  echo Use publish_github.bat for normal updates.
  pause
  exit /b 0
)

echo.
echo Before continuing:
echo 1. Create a NEW EMPTY repository on GitHub.
echo 2. Do NOT add README, .gitignore, or license on GitHub.
echo 3. Copy its HTTPS repository URL.
echo.
set /p REPO_URL=Paste repository HTTPS URL: 

if "%REPO_URL%"=="" (
  echo [ERROR] Repository URL is empty.
  pause
  exit /b 1
)

git init
if errorlevel 1 goto :fail

git branch -M main
if errorlevel 1 goto :fail

git add -A
if errorlevel 1 goto :fail

git commit -m "Initial Question Reflex PWA"
if errorlevel 1 (
  echo.
  echo [ERROR] Commit failed.
  echo If Git asks for your identity, run:
  echo   git config --global user.name "Your Name"
  echo   git config --global user.email "you@example.com"
  pause
  exit /b 1
)

git remote add origin "%REPO_URL%"
if errorlevel 1 goto :fail

git push -u origin main
if errorlevel 1 (
  echo.
  echo [ERROR] Push failed.
  echo GitHub may ask you to authenticate in the browser.
  echo If the remote repository was not empty, create a fresh empty repo or reconcile its history manually.
  pause
  exit /b 1
)

echo.
echo [OK] Initial push complete.
echo Next, configure GitHub Pages:
echo   Repository ^> Settings ^> Pages
echo   Source: Deploy from a branch
echo   Branch: main
echo   Folder: /(root)
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Git command failed. Check the messages above.
pause
exit /b 1
