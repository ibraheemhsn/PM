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
