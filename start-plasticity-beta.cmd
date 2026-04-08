@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launch-plasticity-hotkeys.ps1" -Channel beta %*
