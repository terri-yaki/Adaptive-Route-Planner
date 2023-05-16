@echo off
start "Python App" cmd /k python mapapp.py
start "Ngrok" cmd /k ngrok http 80
