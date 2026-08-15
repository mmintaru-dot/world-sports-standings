@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "WORLD TABLE" /min py -m http.server 8765
  timeout /t 2 /nobreak >nul
  start "" "http://localhost:8765"
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "WORLD TABLE" /min python -m http.server 8765
  timeout /t 2 /nobreak >nul
  start "" "http://localhost:8765"
  exit /b
)
start "" "%~dp0index.html"
