@echo off
title Duelo — Launcher

echo Demarrage du backend...
start "Duelo — Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn server:app --host 0.0.0.0 --port 8080 --reload"

timeout /t 2 /nobreak >nul

echo Demarrage du frontend...
start "Duelo — Frontend" cmd /k "cd /d "%~dp0frontend" && npx expo start --clear"

echo Ouverture du dashboard admin...
timeout /t 4 /nobreak >nul
start chrome "http://localhost:8080/api/admin/dashboard"

echo Les serveurs sont lances !
echo   Backend  : http://localhost:8080
echo   Admin    : http://localhost:8080/api/admin/dashboard
echo   Frontend : scanner le QR code dans la fenetre Expo
