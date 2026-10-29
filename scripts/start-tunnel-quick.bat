@echo off
REM ============================================================
REM  Happy Click 2.0 - Quick Tunnel (Laptop 1)
REM  JANGAN TUTUP jendela ini selama acara berlangsung.
REM  URL publik dicatat otomatis ke app\logs\cloudflared.log
REM  dan dibaca oleh server untuk mengisi publicBaseUrl.
REM ============================================================
title cloudflared-quick-tunnel
set "APPDIR=%~dp0..\app"
cd /d "%APPDIR%"
if not exist logs mkdir logs
if not exist "%APPDIR%\..\.cloudflared\config.yml" goto :noconfig
echo [INFO] Ditemukan .cloudflared\config.yml. Quick Tunnel dapat terpengaruh konfigurasi Named Tunnel.
:noconfig
echo ============================================================
echo  Menjalankan cloudflared Quick Tunnel ke http://localhost:3000
echo  Tunggu sampai muncul URL https://xxxx.trycloudflare.com
echo ============================================================
cloudflared tunnel --url http://localhost:3000 --logfile logs\cloudflared.log
echo.
echo [STOP] cloudflared berhenti. Bila ini terjadi saat acara, mulai ulang
echo        dan perbarui publicBaseUrl di Pengaturan Operator (URL berubah).
pause
