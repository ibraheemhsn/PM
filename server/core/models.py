"""Domain models (المستخدمون، المشاريع، المهام، الوسوم، التعليقات، المرفقات).

User (مدير/موظف) — Task *—* User via assignees (إسناد المهام).
Project 1—* Task, Task *—* Tag, Task 1—* TaskComment, Project 1—* Attachment.
Project.details holds the rich-text HTML produced by the TipTap editor on the
client (headings, lists, hyperlinks); it is rendered back inside the same
editor, never as raw templates.
"""
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """مستخدم النظام: مدير أو موظف. first_name يُستخدم كاسم العرض."""

    # خياران للصورة الرمزية: مفتاح أيقونة جاهزة (avatar) أو صورة مرفوعة (photo)
    # — الصورة المرفوعة لها الأولوية في العرض إن وُجدت
    avatar = models.CharField("الأيقونة", max_length=20, blank=True, default="")
    photo = models.ImageField("الصورة", upload_to="avatars/", blank=True, null=True)
    is_manager = models.BooleanField("مدير", default=False)

    class Meta:
        verbose_name = "مستخدم"
        verbose_name_plural = "المستخدمون"

    def __str__(self):
        return self.first_name or self.username


class Project(models.Model):
    """مشروع هندسي/فني يضم تفاصيل غنية ومهام فرعية."""

    title = models.CharField("العنوان", max_length=200)
    color = models.CharField("اللون", max_length=7, default="#3b82f6")  # HEX color label
    details = models.TextField("التفاصيل الفنية", blank=True, default="")  # HTML من محرر TipTap

    # تعديل مقترح من موظف بانتظار مراجعة المدير — النسخة المعتمدة (details)
    # لا تتغير إلا عند الاعتماد
    pending_details = models.TextField("تفاصيل مقترحة", blank=True, default="")
    has_pending_details = models.BooleanField("يوجد تعديل معلق", default=False)
    pending_details_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="proposed_details", verbose_name="مقترح بواسطة",
    )
    pending_details_at = models.DateTimeField("تاريخ الاقتراح", null=True, blank=True)

    # حذف ناعم: المشروع يُنقل إلى «المحذوفات» ويبقى قابلاً للاستعادة
    # حتى الحذف النهائي (purge)
    deleted_at = models.DateTimeField(
        "تاريخ النقل للمحذوفات", null=True, blank=True, db_index=True
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "مشروع"
        verbose_name_plural = "المشاريع"

    def __str__(self):
        return self.title


class Tag(models.Model):
    """وسم مشترك بين المهام (علاقة كثير-إلى-كثير)."""

    name = models.CharField("الاسم", max_length=50, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "وسم"
        verbose_name_plural = "الوسوم"

    def __str__(self):
        return self.name


class Task(models.Model):
    """مهمة تابعة لمشروع، لها حالة ولون ووسوم وموظفون مسندون."""

    class Status(models.TextChoices):
        OPEN = "OPEN", "مفتوحة"
        IN_PROGRESS = "IN_PROGRESS", "قيد الإنجاز"
        REVIEW = "REVIEW", "قيد المراجعة"
        DONE = "DONE", "منجزة"

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="tasks", verbose_name="المشروع"
    )
    title = models.CharField("العنوان", max_length=300)
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    color = models.CharField("اللون", max_length=7, blank=True, default="")
    tags = models.ManyToManyField(Tag, blank=True, related_name="tasks", verbose_name="الوسوم")
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="assigned_tasks",
        verbose_name="الموظفون المسندون",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)  # للترتيب الزمني
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "مهمة"
        verbose_name_plural = "المهام"

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"


class ProjectUpdate(models.Model):
    """تحديث/حدث على المشروع: توقيع عقد، إرسال كتاب، تنصيب محطة…
    يُعرض زمنياً من الأقدم إلى الأحدث (الأحدث في الأسفل)."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="updates", verbose_name="المشروع"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="project_updates", verbose_name="الكاتب",
    )
    body = models.TextField("النص")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]  # الأقدم أولاً — الأحدث في الأسفل
        verbose_name = "تحديث مشروع"
        verbose_name_plural = "تحديثات المشاريع"

    def __str__(self):
        return f"تحديث #{self.pk} على {self.project_id}"


class TaskComment(models.Model):
    """تعليق على مهمة من مدير أو موظف مسند إليها."""

    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name="comments", verbose_name="المهمة"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="task_comments", verbose_name="الكاتب",
    )
    body = models.TextField("النص")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "تعليق"
        verbose_name_plural = "التعليقات"

    def __str__(self):
        return f"تعليق #{self.pk} على {self.task_id}"


class TaskCommentRead(models.Model):
    """آخر وقت اطّلع فيه المستخدم على تعليقات مهمة — أساس مؤشر «غير مقروء».
    يُحدَّث تلقائياً عند فتح التعليقات أو إضافة تعليق."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comment_reads")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comment_reads"
    )
    last_seen_at = models.DateTimeField("آخر اطلاع")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "user"], name="unique_task_user_read"),
        ]

    def __str__(self):
        return f"قراءة {self.user_id} لمهمة {self.task_id}"


class Notification(models.Model):
    """إشعار داخل التطبيق: إسناد مهمة، تعليق جديد، طلب مراجعة…
    تُنشأ من الـ views وتُقرأ عبر فحص دوري من الواجهة (مع إشعار متصفح وصوت)."""

    class Kind(models.TextChoices):
        TASK_ASSIGNED = "TASK_ASSIGNED", "مهمة مسندة"
        TASK_STATUS = "TASK_STATUS", "تغيير حالة مهمة"
        NEW_COMMENT = "NEW_COMMENT", "تعليق جديد"
        DETAILS_PROPOSED = "DETAILS_PROPOSED", "تعديل مقترح"
        PROJECT_UPDATE = "PROJECT_UPDATE", "تحديث مشروع"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="notifications", verbose_name="المستلم",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="+", verbose_name="الفاعل",
    )
    kind = models.CharField("النوع", max_length=20, choices=Kind.choices)
    message = models.CharField("النص", max_length=300)
    task = models.ForeignKey(
        Task, null=True, blank=True, on_delete=models.CASCADE, related_name="+",
        verbose_name="المهمة",
    )
    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.CASCADE, related_name="+",
        verbose_name="المشروع",
    )
    is_read = models.BooleanField("مقروء", default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "is_read"])]
        verbose_name = "إشعار"
        verbose_name_plural = "الإشعارات"

    def __str__(self):
        return f"إشعار لـ {self.recipient_id}: {self.message[:40]}"


class Attachment(models.Model):
    """مرفق تابع لمشروع: صورة أو PDF أو ملف نصي، مع وصف واسم الرافع."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="attachments", verbose_name="المشروع"
    )
    file_name = models.CharField("اسم الملف", max_length=255)
    file = models.FileField("الملف", upload_to="attachments/%Y/%m/", blank=True, null=True)
    description = models.CharField("الوصف", max_length=500, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="attachments", verbose_name="رفعه",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "مرفق"
        verbose_name_plural = "المرفقات"

    def __str__(self):
        return self.file_name
