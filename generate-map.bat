@echo off
echo Generating clean MERN project map...

REM Output file
set OUTPUT=PROJECT_MAP.txt

REM Clear old file
if exist %OUTPUT% del %OUTPUT%

echo ============================== >> %OUTPUT%
echo        PROJECT MAP            >> %OUTPUT%
echo ============================== >> %OUTPUT%
echo. >> %OUTPUT%

REM List folders and files (filtered)
for /f "delims=" %%i in ('dir /S /B') do (
echo %%i | findstr /V /I "node_modules .git dist build coverage .next" >nul
if not errorlevel 1 (
echo %%i >> %OUTPUT%
)
)

echo. >> %OUTPUT%
echo ============================== >> %OUTPUT%
echo        IMPORTANT FILES        >> %OUTPUT%
echo ============================== >> %OUTPUT%

REM Highlight important MERN files
for /f "delims=" %%i in ('dir /S /B *.js *.jsx *.ts *.tsx') do (
echo %%i | findstr /I "controller route model service api config app server index" >nul
if not errorlevel 1 (
echo %%i >> %OUTPUT%
)
)

echo. >> %OUTPUT%
echo Map generated successfully: %OUTPUT%
pause
