@echo off
title Duelo — Launcher

echo Demarrage du frontend...
start "Duelo — Frontend" cmd /k "cd /d "%~dp0frontend" && npx eas-cli@latest init --id 373a1773-3a32-42d5-a5b9-f80e4e070ebc && npx expo start --tunnel --clear"

echo Ouverture du dashboard admin...
timeout /t 4 /nobreak >nul
start chrome "https://duelo-production.up.railway.app/api/admin/dashboard"

echo Frontend lance !
echo   Backend  : https://duelo-production.up.railway.app
echo   Admin    : https://duelo-production.up.railway.app/api/admin/dashboard
echo   Frontend : scanner le QR code dans la fenetre Expo
