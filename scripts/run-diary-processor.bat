@echo off
REM Diary Image Batch Processor - Windows Launcher
REM Used by Windows Task Scheduler (Mon/Thu 9 PM PKT) and for manual runs.
REM Double-click this file or run it from the command line to process pending images.

cd /d "%~dp0.."
echo [%DATE% %TIME%] Starting diary image batch processor...
node scripts\process-diary-images.mjs
echo [%DATE% %TIME%] Processor finished with exit code %ERRORLEVEL%.
