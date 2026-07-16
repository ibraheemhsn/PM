"""اعتبار كل المحتوى الموجود قبل ميزة «غير مقروء» مقروءاً للجميع —
كي لا تُضاء كل العناصر صفراء عند أول تشغيل بعد الترقية."""
from django.db import migrations
from django.utils import timezone


def seed_read_state(apps, schema_editor):
    User = apps.get_model("core", "User")
    Task = apps.get_model("core", "Task")
    Project = apps.get_model("core", "Project")
    TaskSeen = apps.get_model("core", "TaskSeen")
    ProjectUpdateRead = apps.get_model("core", "ProjectUpdateRead")

    now = timezone.now()
    user_ids = list(User.objects.values_list("id", flat=True))

    TaskSeen.objects.bulk_create(
        (
            TaskSeen(task_id=task_id, user_id=user_id, seen_at=now)
            for task_id in Task.objects.values_list("id", flat=True)
            for user_id in user_ids
        ),
        ignore_conflicts=True,
    )
    ProjectUpdateRead.objects.bulk_create(
        (
            ProjectUpdateRead(project_id=project_id, user_id=user_id, last_seen_at=now)
            for project_id in Project.objects.values_list("id", flat=True)
            for user_id in user_ids
        ),
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_projectupdateread_taskseen"),
    ]

    operations = [
        migrations.RunPython(seed_read_state, migrations.RunPython.noop),
    ]
