@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:4173/tonedef/ after the server starts.
if exist "dist\index.html" (
  node scripts/serve.mjs dist
) else (
  node scripts/serve.mjs
)
pause
