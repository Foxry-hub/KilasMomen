@echo off
REM ============================================================
REM  Happy Click 2.0 - Operator (Laptop 1)
REM  Menjalankan server pada 0.0.0.0:3000 lalu membuka /operator.
REM  Pastikan sudah di-build: npm run build
REM ============================================================
title happy-click-operator
set "APPDIR=%~dp0..\app"
cd /d "%APPDIR%"

if not exist "%APPDIR%\.next\BUILD_ID" (
  echo [INFO] Build produksi belum ada. Membangun aplikasi...
  call npm run build
)

echo ============================================================
echo  Menjalankan server Happy Click di 0.0.0.0:3000
echo  Biarkan jendela "happy-click-server" tetap terbuka.
echo ============================================================
start "happy-click-server" cmd /k "npm run start"

echo Menunggu server siap...
timeout /t 5 /nobreak >nul
start "" chrome "http://localhost:3000/operator"
exit /b 0
