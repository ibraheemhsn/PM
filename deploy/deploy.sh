#!/usr/bin/env bash
# سكربت النشر/التحديث — يُشغَّل على الخادم من داخل /srv/pm
# الاستخدام:  bash deploy/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/pm}"
cd "$APP_DIR"

echo "==> سحب آخر نسخة من الكود"
if [ -d .git ]; then
    git pull --ff-only
fi

echo "==> الواجهة الخلفية: الاعتمادات + الهجرات + الملفات الثابتة"
cd "$APP_DIR/server"
.venv/bin/pip install -q -r requirements-prod.txt
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput

echo "==> الواجهة الأمامية: البناء"
cd "$APP_DIR/client"
npm ci --silent
npm run build

echo "==> إعادة تشغيل الخدمات"
sudo systemctl restart pm-backend
sudo systemctl reload nginx

echo "✔ تم النشر بنجاح"
