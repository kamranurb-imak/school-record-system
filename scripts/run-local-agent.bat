@echo off
cd /d "%~dp0.."
echo [%DATE% %TIME%] Starting local agent on port 3099...
node scripts\local-agent.mjs
echo [%DATE% %TIME%] Local agent stopped (exit code %ERRORLEVEL%).
pause
