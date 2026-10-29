@echo off
REM ============================================================
REM  Happy Click 2.0 - Kiosk (Laptop 2)
REM  Membuka Chrome mode kiosk ke server Laptop 1 di Wi-Fi lokal.
REM
REM  GANTI nilai SERVER dengan IP statis Laptop 1 (lihat §4.6).
REM  Flag --unsafely-treat-insecure-origin-as-secure diperlukan agar
REM  getUserMedia (kamera) berjalan pada origin HTTP LAN (§4.3).
REM ============================================================
title happy-click-kiosk
set "SERVER=http://192.168.50.10:3000"

echo ============================================================
echo  Happy Click 2.0 - Kiosk
echo  Server: %SERVER%
echo  Jika layar tidak memuat, periksa Wi-Fi lokal dan firewall.
echo ============================================================
start "" chrome ^
  --kiosk ^
  --user-data-dir="%LOCALAPPDATA%\happy-click-kiosk" ^
  --unsafely-treat-insecure-origin-as-secure="%SERVER%" ^
  --autoplay-policy=no-user-gesture-required ^
  --disable-features=Translate ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  "%SERVER%/kiosk"
exit /b 0
