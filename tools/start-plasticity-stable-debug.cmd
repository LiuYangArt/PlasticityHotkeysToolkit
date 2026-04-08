@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-plasticity-hotkeys.ps1" -Channel stable -DebugUi %*
