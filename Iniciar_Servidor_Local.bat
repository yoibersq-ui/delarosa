@echo off
title Servidor Local - Delarosa Nail Designer
echo ========================================================
echo        INICIANDO SERVIDOR LOCAL PARA CELULARES Y PC
echo ========================================================
echo.
echo 1. En este computador la app se abrira en:
echo    http://localhost:8080/
echo.
echo 2. Para abrirla desde tu celular conectado al mismo Wi-Fi:
echo    Abre tu navegador (Safari / Chrome) y escribe la IP de este equipo
echo.
echo Presiona Ctrl + C o cierra esta ventana para detener el servidor.
echo ========================================================
echo.

start "" "http://localhost:8080/"
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
