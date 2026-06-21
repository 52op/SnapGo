@echo off
cd /d "%~dp0"
echo Building frontend...
cd web
call npm install >nul 2>&1
call npm run build >nul 2>&1
cd ..
echo Building SnapGo...
go build -ldflags="-s -w" -o SnapGo.exe .
echo Done: SnapGo.exe
