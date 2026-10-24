@echo off
chcp 65001 > nul
title Subir Delarosa Nail Designer a GitHub
cls
echo ========================================================================
echo    🚀 SUBIENDO PROYECTO DELAROSA A TU GITHUB OFICIAL
echo ========================================================================
echo.
echo Repositorio: https://github.com/yoibersq-ui/delarosa.git
echo Rama: main
echo.
echo Conectando con GitHub y subiendo los 34 archivos...
echo.

set "GIT_CMD=%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe"
if not exist "%GIT_CMD%" set "GIT_CMD=git"

cd /d "%~dp0"
if exist "Delarosa_Nail_Designer_App" cd /d "%~dp0Delarosa_Nail_Designer_App"

"%GIT_CMD%" push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================================
    echo    🎉 ¡TODO SUBIDO CON ÉXITO TOTAL A GITHUB!
    echo ========================================================================
    echo.
    echo Tus 34 archivos ya están en vivo en tu repositorio:
    echo 👉 https://github.com/yoibersq-ui/delarosa
    echo.
    echo Ahora ve a Vercel para conectarlo y tener tu link público:
    echo 👉 https://vercel.com/new
    echo.
) else (
    echo.
    echo ========================================================================
    echo ℹ️ Si te pide iniciar sesión:
    echo 1. Usuario: yoibersq-ui
    echo 2. Contraseña: Tu Personal Access Token (o autoriza en el navegador)
    echo ========================================================================
)
echo.
pause
