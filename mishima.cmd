@echo off
setlocal
set /p MISHIMA_NODE_VERSION=<"%~dp0.node-version"
set "MISHIMA_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "MISHIMA_ARCH=arm64"
if exist "%~dp0.tools\node-v%MISHIMA_NODE_VERSION%-win-%MISHIMA_ARCH%\node.exe" goto local
node "%~dp0scripts\windows\project-tools.cjs" %*
exit /b %ERRORLEVEL%
:local
"%~dp0.tools\node-v%MISHIMA_NODE_VERSION%-win-%MISHIMA_ARCH%\node.exe" "%~dp0scripts\windows\project-tools.cjs" %*
exit /b %ERRORLEVEL%
