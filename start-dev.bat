@echo off
chcp 65001 >nul
rem ============================================
rem   تشغيل لوحة شركة الفخار — بيئة التطوير
rem   يفتح نافذتين (Django + React) ثم المتصفح
rem   للإيقاف: أغلق النافذتين
rem ============================================

echo [1/3] تشغيل خادم Django (المنفذ 8000)...
start "PM - Django Backend (8000)" cmd /k "cd /d %~dp0server && .venv\Scripts\activate && python manage.py runserver"

echo [2/3] تشغيل واجهة React (المنفذ 5173)...
start "PM - React Frontend (5173)" cmd /k "cd /d %~dp0client && npm run dev"

echo [3/3] فتح المتصفح...
timeout /t 6 /nobreak >nul
start "" http://localhost:5173

exit
