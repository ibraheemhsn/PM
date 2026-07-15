from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Attachment, Project, ProjectUpdate, Tag, Task, TaskComment, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("الملف الشخصي", {"fields": ("avatar", "is_manager")}),
    )
    list_display = ["username", "first_name", "is_manager", "is_superuser"]


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["title", "color", "created_at", "updated_at"]
    search_fields = ["title", "details"]


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "status", "created_at"]
    list_filter = ["status", "project", "assignees"]
    search_fields = ["title"]


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ["task", "author", "created_at"]


@admin.register(ProjectUpdate)
class ProjectUpdateAdmin(admin.ModelAdmin):
    list_display = ["project", "author", "created_at"]
    list_filter = ["project"]


admin.site.register(Tag)
admin.site.register(Attachment)
