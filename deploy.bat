@echo off
SET commit_msg=%1
IF [%1] == [] SET commit_msg=Update

git update-index --chmod=+x .openshift/action_hooks/post_deploy
git add .
git commit --allow-empty -m "%commit_msg%"
git push

