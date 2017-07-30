@echo off
SET commit_msg=%~1
IF [%1] == [] SET commit_msg=Update

git add .
git commit -m "%commit_msg%"
git push -u origin master
