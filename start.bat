@echo off
title Duelo — Launcher

echo Liberation du port 8081 (ancien serveur Expo eventuel)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081 " ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>&1

echo Demarrage du frontend...
start "Duelo — Frontend" cmd /k "cd /d "%~dp0frontend" && npx expo start --lan --clear --port 8081"

echo Ouverture du dashboard admin...
timeout /t 4 /nobreak >nul
start chrome "https://duelo-production.up.railway.app/api/admin/dashboard"

echo Frontend lance !
echo   Backend  : https://duelo-production.up.railway.app
echo   Admin    : https://duelo-production.up.railway.app/api/admin/dashboard
echo   Frontend : scanner le QR code dans la fenetre Expo (Expo Go SDK 57)
