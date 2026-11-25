@echo off
rem PromptHub: start on Windows (double-click). Logic is in start.ps1.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
