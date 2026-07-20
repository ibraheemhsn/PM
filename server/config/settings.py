"""Django settings — لوحة تحكم شركة الفخار لإدارة المشاريع والمهام.

القيم الحساسة تُقرأ من متغيرات البيئة، مع افتراضات تطويرية آمنة:
بدون أي متغيرات بيئة يعمل المشروع محلياً كما هو (SQLite + DEBUG).
للإنتاج: انظر deploy/README.md وملف deploy/env.example.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "django-insecure-dev-only-change-me-before-production"
)

# مفاتيح Web Push (VAPID) — قيم تطوير افتراضية؛ ولّد مفاتيحك الخاصة للإنتاج
# وبدّلها عبر متغيرات البيئة («or» كي لا تعطّل القيمة الفارغة الافتراضيات)
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY") or (
    "BOcJhUo9jKEst57Wvwlg2QSP1-1PXCqzA9oYobAyXc6WgANJoyefPDvWVV0LdYv91vY6tg9SxKoVbn6kxPAd2QM"
)
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY") or (
    "CYLUsb-c60goUySOhG_LUV0bnx1XWF7GsYub-_rMYos"
)
VAPID_ADMIN_EMAIL = os.environ.get("VAPID_ADMIN_EMAIL") or "baitydev3@gmail.com"
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

# «تسجيل الدخول عبر Google» لربط البريد (OAuth 2.0) — أنشئ بيانات العميل من
# Google Cloud Console وسجّل GOOGLE_REDIRECT_URI نفسه في شاشة الاعتماد
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:8000/api/email/oauth/callback/" if DEBUG else "",
)
# وجهة المتصفح بعد إتمام الربط — واجهة Vite في التطوير، ونفس الأصل في الإنتاج
FRONTEND_ORIGIN = os.environ.get(
    "FRONTEND_ORIGIN", "http://localhost:5173" if DEBUG else ""
)
ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",") if h]
# مطلوب في الإنتاج خلف HTTPS، مثال: https://pm.example.com
CSRF_TRUSTED_ORIGINS = [
    o for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o
]
# أثناء التطوير تمر الطلبات عبر وسيط Vite فيختلف الـ Origin عن مضيف Django —
# بدون هذا السطر يرفض Django أي POST من المتصفح بـ "Origin checking failed"
if DEBUG:
    CSRF_TRUSTED_ORIGINS += ["http://localhost:5173", "http://127.0.0.1:5173"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# وجود POSTGRES_DB في البيئة يعني الإنتاج (PostgreSQL)، وإلا SQLite للتطوير
if os.environ.get("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["POSTGRES_DB"],
            "USER": os.environ.get("POSTGRES_USER", ""),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
            "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ar"
TIME_ZONE = "Asia/Riyadh"  # عدِّل المنطقة الزمنية حسب موقع الشركة
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # وجهة collectstatic (ملفات لوحة /admin)

# ملفات الوسائط: صور الموظفين، مرفقات المشاريع، صور المحرر
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# نموذج مستخدم مخصص (صورة + دور مدير/موظف)
AUTH_USER_MODEL = "core.User"

# أسماء مخصصة للكوكيز حتى لا تتعارض مع كوكيز Secure قديمة على نفس النطاق
# (كوكي sessionid قديم بخاصية Secure على localhost يمنع المتصفح من حفظ الجديد عبر http)
SESSION_COOKIE_NAME = "pm_sessionid"
CSRF_COOKIE_NAME = "pm_csrftoken"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# واجهة Vite أثناء التطوير (المتصفح يمر عبر proxy عادةً، لكن نسمح بالوصول المباشر أيضاً)
# في الإنتاج الواجهة والـ API تحت نفس النطاق عبر Nginx فلا حاجة لـ CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# تشديدات الإنتاج (تُفعَّل تلقائياً عند DJANGO_DEBUG=0)
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")  # خلف Nginx
