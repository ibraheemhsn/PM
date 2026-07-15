"""DRF serializers.

- Tags travel as plain name lists in both directions; unknown names are
  created on the fly.
- Task assignees are written as user-id lists and read back as embedded
  user objects (id/username/first_name/avatar).
"""
from pathlib import Path

from rest_framework import serializers

from .models import Attachment, Project, ProjectUpdate, Tag, Task, TaskComment, User

# أنواع المرفقات المسموحة: صور وPDF وملفات نصية
ALLOWED_ATTACHMENT_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
    ".pdf", ".txt", ".md", ".csv",
}


class UserBriefSerializer(serializers.ModelSerializer):
    """تمثيل مختصر للمستخدم داخل المهام والتعليقات."""

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "avatar", "photo"]


class UserSerializer(serializers.ModelSerializer):
    """إدارة الموظفين: كلمة المرور للكتابة فقط، وتكون اختيارية عند التعديل."""

    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    is_manager = serializers.SerializerMethodField()

    class Meta:
        model = User
        # photo تُرسل multipart عند الرفع، أو null (JSON) للمسح عند اختيار أيقونة
        fields = ["id", "username", "first_name", "password", "avatar", "photo", "is_manager"]

    def get_is_manager(self, obj) -> bool:
        return obj.is_manager or obj.is_superuser

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "كلمة المرور مطلوبة."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user


class ProjectSerializer(serializers.ModelSerializer):
    tasks_count = serializers.IntegerField(read_only=True)
    pending_details_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "title", "color", "details",
            "pending_details", "has_pending_details", "pending_details_by", "pending_details_at",
            "deleted_at", "tasks_count", "created_at", "updated_at",
        ]
        # حقول المراجعة والحذف الناعم تُدار حصراً عبر الإجراءات المخصصة
        read_only_fields = [
            "pending_details", "has_pending_details", "pending_details_at", "deleted_at",
        ]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name"]


class TaskSerializer(serializers.ModelSerializer):
    # أسماء الوسوم كقائمة نصية — الوسوم الجديدة تُنشأ تلقائياً عند الحفظ
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50), write_only=True, required=False
    )
    # الإسناد يُكتب كقائمة معرفات ويُقرأ ككائنات مدمجة (انظر to_representation)
    assignees = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, write_only=True, required=False
    )
    project_title = serializers.CharField(source="project.title", read_only=True)
    project_color = serializers.CharField(source="project.color", read_only=True)
    comments_count = serializers.IntegerField(source="comments.count", read_only=True)
    has_unread_comments = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "project", "project_title", "project_color", "title", "status",
            "color", "tags", "assignees", "comments_count", "has_unread_comments",
            "created_at", "updated_at",
        ]

    def get_has_unread_comments(self, obj) -> bool:
        # تُحسب مسبقاً في TaskViewSet.get_serializer_context لتجنب استعلام لكل مهمة
        return obj.id in self.context.get("unread_task_ids", set())

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["tags"] = [tag.name for tag in instance.tags.all()]
        data["assignees"] = UserBriefSerializer(
            instance.assignees.all(), many=True, context=self.context
        ).data
        return data

    def create(self, validated_data):
        tag_names = validated_data.pop("tags", [])
        task = super().create(validated_data)  # DRF يتولى ضبط assignees (M2M) تلقائياً
        self._set_tags(task, tag_names)
        return task

    def update(self, instance, validated_data):
        tag_names = validated_data.pop("tags", None)
        task = super().update(instance, validated_data)
        if tag_names is not None:
            self._set_tags(task, tag_names)
        return task

    @staticmethod
    def _set_tags(task, names):
        clean = {name.strip() for name in names if name.strip()}
        task.tags.set([Tag.objects.get_or_create(name=name)[0] for name in clean])


class TaskCommentSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)

    class Meta:
        model = TaskComment
        fields = ["id", "author", "body", "created_at"]


class ProjectUpdateSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)
    # لعرض التحديث في الخلاصة الموحدة مع المهام
    project_title = serializers.CharField(source="project.title", read_only=True)
    project_color = serializers.CharField(source="project.color", read_only=True)

    class Meta:
        model = ProjectUpdate
        fields = [
            "id", "project", "project_title", "project_color",
            "author", "body", "created_at", "updated_at",
        ]

    def update(self, instance, validated_data):
        validated_data.pop("project", None)  # لا يُنقل التحديث بين المشاريع
        return super().update(instance, validated_data)


class AttachmentSerializer(serializers.ModelSerializer):
    file = serializers.FileField()  # إلزامي عند الرفع (حقل النموذج اختياري)
    uploaded_by = UserBriefSerializer(read_only=True)
    size = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = [
            "id", "project", "file", "file_name", "description",
            "uploaded_by", "size", "created_at",
        ]
        read_only_fields = ["file_name"]

    def get_size(self, obj) -> int:
        try:
            return obj.file.size if obj.file else 0
        except OSError:  # الملف حُذف من القرص
            return 0

    def validate_file(self, value):
        extension = Path(value.name).suffix.lower()
        if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
            raise serializers.ValidationError(
                "نوع الملف غير مدعوم — يُسمح بالصور وملفات PDF والملفات النصية."
            )
        return value

    def update(self, instance, validated_data):
        # بعد الرفع يُعدَّل الوصف فقط
        validated_data.pop("file", None)
        validated_data.pop("project", None)
        return super().update(instance, validated_data)


class ImageUploadSerializer(serializers.Serializer):
    """التحقق من صور محرر التفاصيل الفنية."""

    image = serializers.ImageField()
