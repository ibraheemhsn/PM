# لوحة تحكم شركة الفخار — إدارة المشاريع والمهام

لوحة تحكم عربية بالكامل (RTL) لإدارة المشاريع الهندسية والفنية ومهامها اليومية،
بنظام أدوار: **مدير** يدير كل شيء و**موظفون** يتابعون مهامهم المسندة.

## التقنيات المستخدمة

| الطبقة | التقنية | سبب الاختيار |
|---|---|---|
| الواجهة الأمامية | React 18 + TypeScript + Vite | مكونات قابلة لإعادة الاستخدام مع أنواع صارمة وتشغيل فوري |
| التنسيق | Tailwind CSS v3 | دعم أصيل للـ RTL عبر الخصائص المنطقية (`ps-` `pe-` `border-s` `start-`) |
| إدارة البيانات | TanStack React Query | تخزين مؤقت وإبطال تلقائي بعد كل عملية إضافة/تعديل/حذف |
| محرر النصوص | TipTap 2 | محرر غني يدعم العناوين والقوائم والروابط التشعبية ويعمل بسلاسة مع RTL |
| الواجهة الخلفية | Django 5 + Django REST Framework | مصادقة جلسات جاهزة + توافق مع خبرة الفريق |
| قاعدة البيانات | SQLite (تطوير) → PostgreSQL (إنتاج) | صفر إعداد الآن، ومسار ترقية واضح لاحقاً |

## مخطط قاعدة البيانات

```
User (المستخدم — AbstractUser)      Task (المهمة)
├─ username / password (مشفرة)      ├─ id
├─ first_name (الاسم الظاهر)        ├─ project_id ──► Project
├─ avatar (مفتاح أيقونة جاهزة)      ├─ title
└─ is_manager (مدير؟)               ├─ status (OPEN/IN_PROGRESS/REVIEW/DONE)
                                    ├─ color (HEX, اختياري)
Project (المشروع)                   ├─ tags ◄────► Tag (M2M)
├─ id                               ├─ assignees ◄────► User (M2M — الإسناد)
├─ title                            ├─ created_at (مفهرس للترتيب)
├─ color (HEX)                      └─ updated_at (مفهرس للترتيب)
├─ details (rich-text HTML معتمد)
├─ pending_details (+by/+at/+flag)  TaskComment (تعليق)
│    تعديل مقترح بانتظار المراجعة   ├─ task_id ──► Task
├─ created_at                       ├─ author_id ──► User (SET_NULL)
└─ updated_at                       ├─ body
                                    └─ created_at
Tag (الوسم)
├─ id                               Attachment (مرفق — placeholder)
└─ name (unique)                    └─ project_id ──► Project, file_name, file
```

## الأدوار والصلاحيات (مفروضة على الخادم)

| العملية | المدير | الموظف |
|---|---|---|
| المشاريع (إنشاء/تعديل/حذف) | ✔ | ✖ (قراءة فقط) |
| التفاصيل الفنية للمشروع | يحرر ويحفظ مباشرة + يعتمد/يرفض المقترحات | يقترح تعديلاً **يُحفظ للمراجعة** |
| تحديثات المشروع (سجل الأحداث) | يضيف + يعدّل/يحذف أي تحديث | يضيف + يعدّل/يحذف **تحديثاته فقط** |
| سلة المحذوفات (استعادة/حذف نهائي) | ✔ | ✖ |
| المهام (إنشاء/تعديل/حذف/إسناد) | ✔ | ✖ |
| رؤية المهام | كلها | **المسندة إليه فقط** |
| تغيير حالة المهمة | كل الحالات | «قيد الإنجاز» و«قيد المراجعة» فقط |
| التعليق على المهمة | ✔ | ✔ (على مهامه) |
| إدارة الموظفين (أيقونة + كلمة مرور) | ✔ | ✖ |

حذف المشروع **حذف ناعم**: يُنقل إلى «المحذوفات» (تختفي مهامه من اللوحة)،
ومن هناك يستعيده المدير أو يحذفه نهائياً.

- دورة حياة المهمة: **مفتوحة ← قيد الإنجاز ← قيد المراجعة ← منجزة** —
  الموظف يرفع المهمة للمراجعة، والمدير يعتمد إنجازها.
- مراجعة التفاصيل الفنية: تعديل الموظف يُخزَّن في `pending_details` دون مساس
  بالنسخة المعتمدة؛ المدير **يعتمد التعديل** (يحل محل المعتمدة) أو
  **يتراجع لآخر نسخة** (يتجاهل المقترح).
- أيقونة الموظف تُختار من 10 أيقونات جاهزة (`AVATAR_OPTIONS` في `types.ts`) —
  لا رفع ملفات.

## التشغيل

**الطريقة السريعة:** انقر نقراً مزدوجاً على `start-dev.bat` في جذر المشروع —
يشغّل الخادمين في نافذتين ويفتح المتصفح تلقائياً. للإيقاف أغلق النافذتين.

**يدوياً (نافذتان منفصلتان):**

### 1) الخادم (Django) — المنفذ 8000

```powershell
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 2) الواجهة (React) — المنفذ 5173

```powershell
cd client
npm install
npm run dev
```

ثم افتح: **http://localhost:5173**

> **حساب المدير الافتراضي:** اسم المستخدم `admin` وكلمة المرور `admin1234`
> — غيّرها فوراً عبر `python manage.py changepassword admin`.
> حسابات الموظفين تُنشأ من صفحة «الموظفون» داخل اللوحة.

## هيكلية الواجهة الأمامية

```
client/src/
├── main.tsx                    نقطة الدخول (React Query + Router)
├── App.tsx                     بوابة المصادقة + المسارات: /tasks /projects/:id /employees
├── types.ts                    الأنواع المشتركة + ثوابت الحالات والألوان
├── lib/
│   ├── api.ts                  عميل HTTP موحّد الأنواع (JSON + FormData + CSRF)
│   └── utils.ts                cn / تنسيق التواريخ بالعربية / تجريد HTML
├── hooks/
│   ├── useAuth.ts              المستخدم الحالي + دخول/خروج
│   ├── useUsers.ts             الموظفون + طفرات CRUD (للمدير)
│   ├── useProjects.ts          المشاريع + طفرات CRUD
│   └── useTasks.ts             المهام والوسوم والتعليقات + طفرات CRUD
└── components/
    ├── auth/                   LoginPage
    ├── layout/                 AppLayout (اختصار Ctrl+K) + Sidebar (حسب الدور)
    ├── employees/              EmployeesPage + EmployeeFormModal (رفع صورة)
    ├── projects/               ProjectPage + ProjectFormModal
    ├── tasks/                  AllTasksPage + TaskCard + TaskFormModal (إسناد)
    │                           + TaskCommentsModal + StatusIcon
    ├── editor/                 RichTextEditor (TipTap)
    ├── search/                 CommandPalette (البحث الشامل)
    └── ui/                     Modal + ColorPicker + Avatar
```

## نقاط ضبط RTL الأساسية

1. **الجذر**: `<html lang="ar" dir="rtl">` في `index.html` — كل شيء يتبعه تلقائياً.
2. **الخصائص المنطقية في Tailwind**: استخدم دائماً `ps-`/`pe-` بدل `pl-`/`pr-`، و`ms-`/`me-` بدل `ml-`/`mr-`، و`start-`/`end-` بدل `left-`/`right-`، و`border-s`/`border-e` و`text-start` — هكذا تعمل الواجهة تلقائياً في الاتجاهين.
3. **الخط**: IBM Plex Sans Arabic معرف في `tailwind.config.js` ومحمّل في `index.html`.
4. **اختصار Ctrl+K**: نفحص `e.code === 'KeyK'` وليس `e.key` فقط، كي يعمل الاختصار حتى عندما يكون تخطيط لوحة المفاتيح عربياً.
5. **محرر TipTap**: `dir="rtl"` على منطقة الكتابة، والنص التوضيحي (placeholder) يستخدم `float: right`.
6. **التواريخ**: `Intl.DateTimeFormat('ar')` لعرض التواريخ بصيغة عربية.
7. **CSS المخصص**: عند الحاجة استخدم `border-inline-start` و`inset-inline-end` بدل `left`/`right`.

## ملاحظات أمان قبل النشر

- المصادقة عبر جلسات Django + حماية CSRF (الواجهة ترسل `X-CSRFToken` تلقائياً).
- بدّل `SECRET_KEY` و`DEBUG` و`ALLOWED_HOSTS` إلى قيم بيئة الإنتاج.
- انتقل إلى PostgreSQL وفعّل HTTPS (وكوكيز `Secure`).

## خارطة الطريق

- [ ] برمجة منطق رفع المرفقات (النموذج `Attachment` والقسم في الواجهة جاهزان)
- [ ] إشعارات للموظف عند إسناد مهمة أو تعليق جديد
- [ ] ترقيم الصفحات (pagination) إذا تجاوزت المهام بضعة آلاف


اخر اوامر 

الأعلى قيمة (أنصح بالبدء بها)
1.	تاريخ استحقاق وأولوية للمهام — أكبر نقص حالياً كأداة إدارة أعمال: حقل «يُنجز قبل» + أولوية (عالية/متوسطة/منخفضة)، مع تمييز المهام المتأخرة بالأحمر تلقائياً، والفرز والفلترة بها، وإشعار قبل الاستحقاق بيوم. البنية جاهزة تماماً لذلك.
2.	لوحة كانبان — عرض بديل لصفحة المهام: أعمدة (مفتوحة/قيد الإنجاز/قيد المراجعة/منجزة) مع سحب وإفلات لتغيير الحالة. حالات المهام والصلاحيات موجودة أصلاً؛ يتبقى العرض فقط.
3.	لوحة إحصائيات للمدير — صفحة رئيسية تلخص: عدد المهام حسب الحالة لكل مشروع، حِمل كل موظف، المهام المتأخرة، آخر النشاطات. تعطي المدير نظرة صباحية واحدة بدل التنقل بين المشاريع.
4.	أرشفة المشاريع المنتهية — حالياً المشروع إما نشط أو محذوف؛ حالة «مؤرشف» تُبقي السجل دون أن تزحم القائمة الجانبية.
تحسينات تعاون سريعة
5.	منشن في التعليقات (@احمد) مع إشعار موجّه — نظام الإشعارات جاهز، تنقصه هذه الإضافة فقط.
6.	قوائم تحقق فرعية داخل المهمة (subtasks) مع شريط تقدم على البطاقة.
7.	سحب وإفلات الملفات لرفع المرفقات + لصق صورة من الحافظة مباشرة في التعليقات والتفاصيل.
8.	سجل نشاط للمشروع (من عدّل ماذا ومتى) — مفيد للمساءلة في العمل الهندسي.
9.	قوالب مشاريع — مشاريعكم متشابهة البنية غالباً (نفس التصنيفات والمهام الافتتاحية)؛ «إنشاء من قالب» يوفر وقتاً حقيقياً.
إدارة أعمال أعمق (جهد أكبر)
10.	عرض تقويم/مخطط زمني للمهام حسب الاستحقاق (يعتمد على النقطة 1).
11.	تقارير وتصدير — تقرير أسبوعي/شهري للمشروع (مهام أُنجزت، تحديثات، مرفقات) قابل للتصدير PDF/Excel لمشاركته مع العميل.
12.	مهام متكررة (صيانة دورية، تقارير شهرية…).
بنية تحتية قبل الاستخدام الجاد
13.	الانتقال إلى PostgreSQL + نسخ احتياطي مجدول — SQLite للتطوير فقط، ومسار الترقية جاهز في الكود (متغيرات البيئة فقط).
14.	PWA — تثبيت على الجوال مع إشعارات Push حقيقية بدل الاعتماد على فتح المتصفح (الفحص الدوري الحالي يعمل فقط والتبويب مفتوح).
لو طلبت رأيي بترتيب التنفيذ: 1 ثم 3 ثم 2 — ثلاثتها تحوّل الأداة من «قائمة مهام» إلى «إدارة أعمال» فعلياً، وكلها قابلة للتنفيذ على البنية الحالية دون إعادة هيكلة. قل لي أيها تريد وأبدأ.





تعليمات النشر 
المرحلة 0 — على جهازك: ارفع الكود إلى GitHub
لديك مستودع github.com/ibraheemhsn/PM وفيه 12 ملفاً غير مرفوع. من PowerShell:
cd c:\Projects\PM
git add -A
git commit -m "prepare production deploy"
git push
إن كان المستودع خاصاً (يُفضَّل): أنشئ Token للقراءة من GitHub: Settings ← Developer settings ← Fine-grained tokens ← Generate (صلاحية Contents: Read على مستودع PM فقط) — ستحتاجه في المرحلة 3.
المرحلة 1 — إنشاء الخادم في DigitalOcean
1.	سجّل في digitalocean.com ثم Create ← Droplet.
2.	الاختيارات:
o	Region: Frankfurt (الأقرب للعراق).
o	Image: Ubuntu 24.04 LTS.
o	Size: Basic ← Regular ← $6/شهر (1GB) يكفي مع خطوة الـ swap أدناه (أو $12/2GB لراحة أكبر).
o	Authentication: اختر SSH Key، وولّد مفتاحاً على جهازك إن لم يوجد:
o	ssh-keygen -t ed25519    # اضغط Enter للكل
o	type $env:USERPROFILE\.ssh\id_ed25519.pub
انسخ الناتج والصقه في DigitalOcean.
3.	أنشئ الدروبلت وخذ عنوان IP الظاهر.
المرحلة 2 — DNS من لوحة HostGator
في cPanel الخاص بـ alfakharco.com ← Zone Editor ← Add Record:
Type	Name	Address
A	pm	عنوان IP للدروبلت
ينتشر خلال دقائق غالباً. تحقق من جهازك: nslookup pm.alfakharco.com حتى يُظهر الـ IP.

المرحلة 3 — على الخادم: التثبيت والتشغيل
ادخل للخادم: ssh root@عنوان-IP ثم نفّذ بالترتيب:
# 1) ذاكرة تبادلية (ضرورية لبناء الواجهة على 1GB)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 2) جدار ناري أساسي
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw --force enable

# 3) Docker
curl -fsSL https://get.docker.com | sh

# 4) جلب المشروع (لمستودع خاص ضع التوكن قبل @)
git clone https://TOKEN@github.com/ibraheemhsn/PM.git /srv/pm
cd /srv/pm

# 5) ملف الإعدادات
cp .env.example .env
ولّد المفاتيح (سطران — انسخ نواتجهما):
# مفتاح Django السري
openssl rand -base64 48

# مفاتيح إشعارات Push (يطبع سطري VAPID جاهزين للصق)
docker run --rm python:3.12-slim sh -c "pip -q install cryptography && python -c \"
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64
k = ec.generate_private_key(ec.SECP256R1())
print('VAPID_PRIVATE_KEY=' + base64.urlsafe_b64encode(k.private_numbers().private_value.to_bytes(32,'big')).rstrip(b'=').decode())
print('VAPID_PUBLIC_KEY=' + base64.urlsafe_b64encode(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)).rstrip(b'=').decode())\""
ثم حرّر الملف nano .env واضبط:
SITE_DOMAIN=pm.alfakharco.com
SITE_ADDRESS=pm.alfakharco.com
DJANGO_SECRET_KEY=<ناتج openssl>
POSTGRES_PASSWORD=<كلمة مرور قوية من اختيارك>
VAPID_PUBLIC_KEY=<من الأمر أعلاه>
VAPID_PRIVATE_KEY=<من الأمر أعلاه>
VAPID_ADMIN_EMAIL=baitydev3@gmail.com
شغّل كل شيء (قاعدة بيانات + خلفية + واجهة + HTTPS تلقائي):
docker compose up -d --build     # يستغرق دقائق أول مرة
docker compose ps                # الثلاثة يجب أن تكون running
المرحلة 4 — البيانات: اختر أحد مسارين
(أ) بداية نظيفة — أنشئ حساب المدير:
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py shell -c "from core.models import User; u=User.objects.get(username='admin'); u.is_manager=True; u.save()"
(ب) نقل بياناتك الحالية (المشاريع والمستخدمون بكلمات مرورهم والمرفقات) — على جهازك:
cd c:\Projects\PM\server
$env:PYTHONUTF8='1'
.venv\Scripts\python.exe manage.py dumpdata core --indent 2 -o data.json
scp data.json root@IP:/srv/pm/
scp -r media root@IP:/srv/pm/dev-media
ثم على الخادم:
cd /srv/pm
docker compose cp data.json backend:/app/data.json
docker compose exec backend python manage.py loaddata /app/data.json
docker compose cp dev-media/. backend:/app/media/
المرحلة 5 — التحقق
افتح https://pm.alfakharco.com — يجب أن ترى صفحة الدخول بقفل HTTPS. جرّب: تسجيل الدخول، رفع مرفق، تثبيت التطبيق (أيقونة التثبيت في كروم / «إضافة للشاشة الرئيسية» في الجوال)، وتفعيل الإشعارات من الجرس — الـ Push سيعمل فعلياً الآن لأن HTTPS متوفر.
________________________________________
لاحقاً
•	تحديث التطبيق بعد أي تعديل: على جهازك git push، وعلى الخادم:
•	cd /srv/pm && git pull && docker compose up -d --build
•	نسخة احتياطية (يُنصح بها أسبوعياً على الأقل):
•	docker compose exec db pg_dump -U pmuser pm > backup-$(date +%F).sql
•	السجلات عند أي مشكلة: docker compose logs -f backend
إن تعثرت أي خطوة، الصق لي مخرجاتها وأشخّصها معك.
