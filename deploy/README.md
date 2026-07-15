# دليل النشر على خادم إنتاج

## ⭐ الطريقة الموصى بها: Docker (الأسهل — بلا إعداد يدوي للخادم)

كل ما تحتاجه: خادم Ubuntu (أي VPS بـ 5$) + نطاق يشير إلى عنوانه.
HTTPS يصدر ويتجدد **تلقائياً** عبر Caddy — لا certbot ولا إعدادات شهادات.

```bash
# 1) ثبّت Docker (أمر واحد)
curl -fsSL https://get.docker.com | sh

# 2) اجلب المشروع
git clone <رابط-مستودعك> /srv/pm && cd /srv/pm

# 3) اضبط الإعدادات
cp .env.example .env
nano .env        # النطاق + مفتاح سري عشوائي + كلمة مرور قاعدة البيانات

# 4) شغّل كل شيء (قاعدة بيانات + خلفية + واجهة + HTTPS)
docker compose up -d --build

# 5) أنشئ حساب المدير
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py shell -c "from core.models import User; u=User.objects.get(username='admin'); u.is_manager=True; u.save()"
```

افتح `https://نطاقك` — انتهى.

**التحديثات اللاحقة** بعد أي تعديل على الكود:

```bash
cd /srv/pm && git pull && docker compose up -d --build
```

أوامر مفيدة:

```bash
docker compose logs -f backend      # سجلات Django
docker compose ps                   # حالة الخدمات
docker compose exec db pg_dump -U pmuser pm > backup.sql   # نسخة احتياطية
```

**نقل بياناتك من جهاز التطوير**: على جهازك
`python manage.py dumpdata core -o data.json` (مع `$env:PYTHONUTF8='1'`)،
انسخ الملف ومجلد `server/media` إلى الخادم، ثم:

```bash
docker compose cp data.json backend:/app/
docker compose exec backend python manage.py loaddata /app/data.json
docker compose cp server/media/. backend:/app/media/
```

مكونات إعداد Docker: [docker-compose.yml](../docker-compose.yml) (ثلاث خدمات: postgres + django + caddy)،
[server/Dockerfile](../server/Dockerfile)، [Dockerfile.web](Dockerfile.web)، [Caddyfile](Caddyfile)، [.env.example](../.env.example).

---

## الطريقة اليدوية البديلة (Nginx + Gunicorn + systemd)

إن كنت تفضل التحكم الكامل بلا Docker. الملفات في هذا المجلد:

| الملف | الدور |
|---|---|
| `env.example` | نموذج متغيرات البيئة — يُنسخ إلى `server/.env` على الخادم |
| `pm-backend.service` | خدمة systemd لتشغيل Django (gunicorn) تلقائياً |
| `nginx-pm.conf` | إعداد Nginx: الواجهة + تمرير `/api` و`/media` |
| `deploy.sh` | سكربت التحديث الدوري (سحب، هجرات، بناء، إعادة تشغيل) |

> افتراضات الدليل: خادم Ubuntu 22.04+، المشروع في `/srv/pm`، النطاق `pm.example.com`.
> استبدل النطاق في `nginx-pm.conf` و`.env` بنطاقك الحقيقي.

## أولاً: التثبيت لأول مرة

### 1) الأساسيات

```bash
sudo apt update
sudo apt install -y python3-venv python3-dev nginx postgresql git curl
# Node لبناء الواجهة (عبر NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2) جلب المشروع

```bash
sudo mkdir -p /srv/pm && sudo chown "$USER" /srv/pm
git clone <رابط-مستودعك> /srv/pm     # أو ارفع الملفات بـ scp/rsync
```

### 3) قاعدة بيانات PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER pmuser WITH PASSWORD 'كلمة-مرور-قوية';"
sudo -u postgres psql -c "CREATE DATABASE pm OWNER pmuser;"
```

### 4) بيئة Python وملف البيئة

```bash
cd /srv/pm/server
python3 -m venv .venv
.venv/bin/pip install -r requirements-prod.txt

cp ../deploy/env.example .env
nano .env    # عدّل: SECRET_KEY، النطاق، كلمة مرور قاعدة البيانات
```

لتوليد مفتاح سري:

```bash
.venv/bin/python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 5) تهيئة قاعدة البيانات وحساب المدير

```bash
set -a; source .env; set +a     # حمّل المتغيرات لهذه الجلسة
.venv/bin/python manage.py migrate
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py createsuperuser   # ثم فعّل «مدير» له من /admin أو:
.venv/bin/python manage.py shell -c "from core.models import User; u=User.objects.get(username='admin'); u.is_manager=True; u.save()"
```

### 6) بناء الواجهة

```bash
cd /srv/pm/client
npm ci
npm run build        # الناتج في client/dist
```

### 7) تشغيل الخدمات

```bash
# صلاحيات مجلد الوسائط للمستخدم الذي تعمل به الخدمة
sudo chown -R www-data:www-data /srv/pm/server/media /srv/pm/server/staticfiles || true
sudo mkdir -p /srv/pm/server/media && sudo chown -R www-data:www-data /srv/pm/server/media

# خدمة Django
sudo cp /srv/pm/deploy/pm-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pm-backend
systemctl status pm-backend    # يجب أن تكون active (running)

# Nginx
sudo cp /srv/pm/deploy/nginx-pm.conf /etc/nginx/sites-available/pm
sudo ln -sf /etc/nginx/sites-available/pm /etc/nginx/sites-enabled/pm
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 8) HTTPS (إلزامي — النظام فيه كلمات مرور)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pm.example.com
```

certbot يعدّل إعداد Nginx تلقائياً ويجدد الشهادة ذاتياً. بعدها افتح
`https://pm.example.com` وسجّل الدخول.

## ثانياً: التحديثات اللاحقة

بعد أي تعديل على الكود:

```bash
cd /srv/pm && bash deploy/deploy.sh
```

السكربت يسحب الكود، يثبت الاعتمادات، يطبق الهجرات، يبني الواجهة، ويعيد تشغيل الخدمات.

## نقل بياناتك الحالية من جهاز التطوير (اختياري)

على جهازك (SQLite):

```powershell
cd c:\Projects\PM\server
$env:PYTHONUTF8='1'
.venv\Scripts\python.exe manage.py dumpdata core --indent 2 -o data.json
```

انقل `data.json` ومجلد `server/media/` إلى الخادم، ثم هناك:

```bash
.venv/bin/python manage.py loaddata data.json
```

## استكشاف الأخطاء

```bash
journalctl -u pm-backend -n 100 --no-pager   # سجلات Django/gunicorn
sudo tail -n 100 /var/log/nginx/error.log     # سجلات Nginx
```

- **403 CSRF** بعد النشر → تأكد من `DJANGO_CSRF_TRUSTED_ORIGINS=https://نطاقك` في `.env` ثم `sudo systemctl restart pm-backend`.
- **502 Bad Gateway** → خدمة `pm-backend` متوقفة؛ راجع سجلاتها.
- **الصور/المرفقات لا تظهر** → تحقق من صلاحيات `www-data` على `/srv/pm/server/media`.
