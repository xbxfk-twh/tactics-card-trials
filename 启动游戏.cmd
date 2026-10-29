@echo off
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js，再双击此文件。
  pause
  exit /b 1
)
node "%~dp0apps\web\tools\launch.cjs"
if errorlevel 1 pause
