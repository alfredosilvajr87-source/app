@echo off
cd /d "C:\Users\alfre\Music\app-correto"
git add -A
git status
set /p msg="Mensagem do commit: "
git commit -m "%msg%"
git push
pause
