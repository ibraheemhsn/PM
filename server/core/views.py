"""API views.

Roles enforced server-side (not just in the UI):
- المدير: كل عمليات CRUD على المشاريع والمهام والموظفين.
- الموظف: يرى المهام المسندة إليه فقط، يغيّر حالتها إلى «قيد الإنجاز» أو
  «قيد المراجعة» فقط، ويعلّق عليها.
"""
import calendar
import re
from datetime import timedelta

from django.contrib.auth import authenticate, login, logout
from django.core.files.storage import default_storage
from django.db.models import Count, Max, Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings

from .models import (
    ActivityLog, Attachment, Notification, Project, ProjectUpdate,
    ProjectUpdateRead, PushSubscription, Tag, Task, TaskComment,
    TaskCommentRead, TaskSeen, User,
)
from .permissions import IsManager, IsManagerOrReadOnly, is_manager
from .push import send_push
from .thumbnails import ATTACHMENT_THUMB_SIZE, is_image_name, make_thumbnail, thumb_name
from .serializers import (
    ActivityLogSerializer, AttachmentSerializer, ImageUploadSerializer,
    NotificationSerializer, ProjectSerializer, ProjectUpdateSerializer,
    TagSerializer, TaskCommentSerializer, TaskSerializer, UserBriefSerializer,
    UserSerializer,
)

ALLOWED_TASK_ORDERINGS = {"created_at", "updated_at"}

# ما يُسمح للموظف بتعديله في المهمة
EMPLOYEE_EDITABLE_FIELDS = {"status"}
# آلة حالات الموظف: التنقل بالاتجاهين حصراً بين هذه الحالات الأربع —
# «مقترحة» يعتمدها المدير، و«منجزة» يغلقها المدير حصراً
EMPLOYEE_ALLOWED_STATUSES = {
    Task.Status.OPEN, Task.Status.IN_PROGRESS,
    Task.Status.ON_HOLD, Task.Status.REVIEW,
}


# ===== مؤشرات «غير مقروء» =====

def _unread_comment_task_ids(user, task_ids=None):
    """المهام التي فيها تعليقات من الآخرين أحدث من آخر اطلاع للمستخدم.
    task_ids (اختياري) يحصر الفحص في مجموعة مهام محددة."""
    last_seen = dict(
        TaskCommentRead.objects.filter(user=user).values_list("task_id", "last_seen_at")
    )
    comments = TaskComment.objects.exclude(author=user)
    if task_ids is not None:
        comments = comments.filter(task_id__in=task_ids)
    latest_by_task = comments.values("task_id").annotate(latest=Max("created_at"))
    return {
        row["task_id"]
        for row in latest_by_task
        if row["task_id"] not in last_seen or row["latest"] > last_seen[row["task_id"]]
    }


def _advance_date(date, recurrence):
    """التاريخ التالي لمهمة متكررة — الشهري يقص لنهاية الشهر عند اللزوم
    (31 يناير ← 28/29 فبراير)."""
    if recurrence == Task.Recurrence.DAILY:
        return date + timedelta(days=1)
    if recurrence == Task.Recurrence.WEEKLY:
        return date + timedelta(weeks=1)
    year = date.year + (1 if date.month == 12 else 0)
    month = 1 if date.month == 12 else date.month + 1
    day = min(date.day, calendar.monthrange(year, month)[1])
    return date.replace(year=year, month=month, day=day)


# ===== سجل النشاط =====

def _log(project, actor, message):
    """سجّل حدثاً في سجل نشاط المشروع — يُعرض في صفحة المشروع."""
    ActivityLog.objects.create(project=project, actor=actor, message=message)


class ActivityLogViewSet(viewsets.GenericViewSet):
    """سجل النشاطات عبر المشاريع، الأحدث أولاً.
    بلا معامل project: كل المشاريع (الموظف: مشاريعه فقط). limit حتى 500."""

    serializer_class = ActivityLogSerializer

    def list(self, request):
        qs = ActivityLog.objects.select_related("actor", "project").filter(
            project__deleted_at__isnull=True
        )
        if not is_manager(request.user):
            qs = qs.filter(project__tasks__assignees=request.user).distinct()
        if project_id := request.query_params.get("project"):
            if not project_id.isdigit():
                return Response(
                    {"detail": "معامل project غير صالح."}, status=status.HTTP_400_BAD_REQUEST
                )
            qs = qs.filter(project_id=project_id)
        try:
            limit = int(request.query_params.get("limit", 100))
        except ValueError:
            limit = 100
        limit = max(1, min(limit, 500))
        return Response(
            ActivityLogSerializer(qs[:limit], many=True, context={"request": request}).data
        )


# ===== الإشعارات =====

def _managers():
    return User.objects.filter(Q(is_manager=True) | Q(is_superuser=True))


def _notify(recipients, *, actor, kind, message, task=None, project=None):
    """أنشئ إشعاراً لكل مستلم — مع استبعاد الفاعل نفسه وإزالة التكرار.
    يُرسل أيضاً إشعار Web Push يصل للجهاز حتى والتطبيق مغلق."""
    unique = {r.id: r for r in recipients if r.id != actor.id}
    Notification.objects.bulk_create(
        Notification(
            recipient=r, actor=actor, kind=kind, message=message,
            task=task, project=project,
        )
        for r in unique.values()
    )
    url = "/"
    if project:
        url = f"/projects/{project.id}" + (f"?focus=task-{task.id}" if task else "")
    send_push(unique.values(), message, url)


def _generate_due_reminders():
    """تذكير باقتراب الاستحقاق: إشعار واحد لكل مسند على مهمة يحين استحقاقها
    اليوم أو غداً وغير منجزة. يُستدعى من فحص الإشعارات الدوري (كل 15 ثانية
    من أي واجهة مفتوحة) — لا حاجة لمجدول خارجي، والتكرار ممنوع بفحص الوجود."""
    today = timezone.localdate()
    due_tasks = (
        Task.objects.filter(
            due_date__range=(today, today + timedelta(days=1)),
            deleted_at__isnull=True,
            project__deleted_at__isnull=True,
            project__archived_at__isnull=True,
        )
        .exclude(status=Task.Status.DONE)
        .prefetch_related("assignees")
    )
    for task in due_tasks:
        when = "اليوم" if task.due_date == today else "غداً"
        for assignee in task.assignees.all():
            already = Notification.objects.filter(
                recipient=assignee, task=task, kind=Notification.Kind.DUE_SOON
            ).exists()
            if not already:
                message = f"مهمة «{task.title}» يحين استحقاقها {when}"
                Notification.objects.create(
                    recipient=assignee, actor=None,
                    kind=Notification.Kind.DUE_SOON,
                    message=message,
                    task=task, project=task.project,
                )
                send_push(
                    [assignee], message,
                    url=f"/projects/{task.project_id}?focus=task-{task.id}",
                )


class NotificationViewSet(viewsets.GenericViewSet):
    """إشعارات المستخدم الحالي: القائمة (آخر 30) + تعليم كمقروء.
    الواجهة تفحصها دورياً وتعرض الجديد كإشعار متصفح مع صوت."""

    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def list(self, request):
        # الفحص الدوري هو «نبض» النظام — نولّد تذكيرات الاستحقاق عنده
        _generate_due_reminders()
        # limit اختياري لصفحة الإشعارات الكاملة — الافتراضي 30 (فحص الجرس الدوري)
        try:
            limit = int(request.query_params.get("limit", 30))
        except ValueError:
            limit = 30
        limit = max(1, min(limit, 200))
        qs = self.get_queryset().select_related("actor")[:limit]
        return Response(
            NotificationSerializer(qs, many=True, context={"request": request}).data
        )

    @action(detail=False, methods=["post"])
    def mark_read(self, request):
        """بدون ids: يعلّم الكل كمقروء؛ ومع ids: المحددة فقط."""
        qs = self.get_queryset().filter(is_read=False)
        if ids := request.data.get("ids"):
            qs = qs.filter(id__in=ids)
        qs.update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ===== اشتراكات Web Push =====

class PushKeyView(APIView):
    """المفتاح العام (VAPID) الذي يشترك به المتصفح في خدمة الدفع."""

    def get(self, request):
        return Response({"public_key": settings.VAPID_PUBLIC_KEY})


class PushSubscribeView(APIView):
    """حفظ اشتراك دفع لهذا المتصفح — endpoint فريد، وتكراره يحدّث صاحبه."""

    def post(self, request):
        data = request.data or {}
        endpoint = data.get("endpoint")
        keys = data.get("keys") or {}
        if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
            return Response(
                {"detail": "بيانات الاشتراك غير مكتملة."}, status=status.HTTP_400_BAD_REQUEST
            )
        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                "user": request.user,
                "p256dh": keys["p256dh"],
                "auth": keys["auth"],
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


# ===== المصادقة (جلسات Django) =====

@method_decorator(ensure_csrf_cookie, name="get")
class MeView(APIView):
    """يعيد المستخدم الحالي (أو null) ويزرع كعكة CSRF لبقية الطلبات."""

    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        data = UserSerializer(user, context={"request": request}).data if user else None
        return Response({"user": data})


class ProjectOrderView(APIView):
    """ترتيب المشاريع المخصص: يُحفظ لكل مستخدم على حدة (مدير أو موظف)
    وينعكس على واجهته فقط — لا يمس الترتيب الافتراضي ولا واجهات الآخرين."""

    def put(self, request):
        order = request.data.get("order")
        if not isinstance(order, list) or not all(isinstance(pk, int) for pk in order):
            return Response(
                {"detail": "الترتيب يجب أن يكون قائمة معرفات مشاريع."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.project_order = order
        request.user.save(update_fields=["project_order"])
        return Response({"project_order": order})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user = authenticate(
            request,
            username=request.data.get("username", ""),
            password=request.data.get("password", ""),
        )
        if user is None:
            return Response(
                {"detail": "اسم المستخدم أو كلمة المرور غير صحيحة."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        return Response({"user": UserSerializer(user, context={"request": request}).data})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ===== الموظفون (المدير فقط) =====

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.order_by("username")
    serializer_class = UserSerializer
    permission_classes = [IsManager]

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mentionable(self, request):
        """كل المستخدمين النشطين — لإكمال المنشن (@) في التعليقات.
        متاحة للجميع بعكس بقية العمليات (الموظف يحتاج منشن المدير مثلاً)."""
        qs = User.objects.filter(is_active=True).exclude(id=request.user.id).order_by("username")
        return Response(
            UserBriefSerializer(qs, many=True, context={"request": request}).data
        )

    def update(self, request, *args, **kwargs):
        # منع المدير من إزالة صلاحيته عن نفسه فيفقد الوصول فوراً
        # (القيم تصل bool من JSON أو نصاً من FormData)
        demoting = str(request.data.get("is_manager", "")).lower() in ("false", "0")
        if demoting and self.get_object() == request.user:
            raise PermissionDenied("لا يمكنك إزالة صلاحية المدير عن حسابك الحالي.")
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if self.get_object() == request.user:
            raise PermissionDenied("لا يمكنك حذف حسابك الحالي.")
        return super().destroy(request, *args, **kwargs)


# ===== المشاريع والمهام والوسوم =====

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsManagerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        manager = is_manager(user)

        # العدّاد لا يشمل المهام المنقولة إلى المحذوفات — وللموظف: مهامه المسندة فقط
        task_filter = Q(tasks__deleted_at__isnull=True)
        if not manager:
            task_filter &= Q(tasks__assignees=user)
        qs = Project.objects.annotate(
            tasks_count=Count("tasks", filter=task_filter, distinct=True)
        )

        # إجراءات المحذوفات تستهدف المشاريع المحذوفة ناعماً فقط
        if self.action in ("restore", "purge"):
            return qs.filter(deleted_at__isnull=False)
        if self.action == "list" and self.request.query_params.get("trashed"):
            if not manager:
                raise PermissionDenied("قسم المحذوفات متاح للمدير فقط.")
            return qs.filter(deleted_at__isnull=False).order_by("-deleted_at")
        qs = qs.filter(deleted_at__isnull=True)

        # قائمة الأرشيف (للمدير) — والقائمة الافتراضية بلا المؤرشف،
        # مع بقائه متاحاً بالمعرف (لعرض صفحة مشروع مؤرشف وإجراءاته)
        if self.action == "list":
            if self.request.query_params.get("archived"):
                if not manager:
                    raise PermissionDenied("الأرشيف متاح للمدير فقط.")
                return qs.filter(archived_at__isnull=False).order_by("-archived_at")
            qs = qs.filter(archived_at__isnull=True)

        # قائمة الموظف تقتصر على المشاريع التي له فيها مهام مسندة
        if self.action == "list" and not manager:
            qs = qs.filter(
                tasks__assignees=user, tasks__deleted_at__isnull=True
            ).distinct()
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # نقطة «غير مقروء» في الشريط الجانبي — تُحسب لقائمة المشاريع الحية فقط
        if self.action == "list" and not self.request.query_params.get("trashed"):
            context["unread_project_ids"] = self._unread_project_ids()
        return context

    def _unread_project_ids(self):
        """المشاريع التي فيها جديد لم يقرأه المستخدم: مهمة لم يطّلع عليها،
        أو تعليق غير مقروء على مهمة يراها، أو تحديث أحدث من آخر اطلاعه."""
        user = self.request.user
        manager = is_manager(user)

        tasks = Task.objects.filter(
            project__deleted_at__isnull=True,
            project__archived_at__isnull=True,  # لا نقاط حمراء للمؤرشف
            deleted_at__isnull=True,
        )
        if not manager:
            tasks = tasks.filter(assignees=user)  # الموظف: مهامه المسندة فقط
        task_project = dict(tasks.values_list("id", "project_id"))

        unread = set()

        # 1) مهام لم يطّلع عليها المستخدم بعد
        seen_ids = set(
            TaskSeen.objects.filter(user=user, task_id__in=task_project)
            .values_list("task_id", flat=True)
        )
        unread |= {pid for tid, pid in task_project.items() if tid not in seen_ids}

        # 2) تعليقات غير مقروءة على مهام ضمن نطاقه
        for task_id in _unread_comment_task_ids(user, task_project.keys()):
            unread.add(task_project[task_id])

        # 3) تحديثات مشاريع أحدث من آخر اطلاعه — الموظف: مشاريع مهامه فقط
        last_seen = dict(
            ProjectUpdateRead.objects.filter(user=user)
            .values_list("project_id", "last_seen_at")
        )
        updates = ProjectUpdate.objects.filter(
            project__deleted_at__isnull=True,
            project__archived_at__isnull=True,
            deleted_at__isnull=True,
        ).exclude(author=user)
        if not manager:
            updates = updates.filter(project_id__in=set(task_project.values()))
        latest_by_project = updates.values("project_id").annotate(latest=Max("created_at"))
        for row in latest_by_project:
            seen_at = last_seen.get(row["project_id"])
            if seen_at is None or row["latest"] > seen_at:
                unread.add(row["project_id"])

        return unread

    def _project_response(self, request, project):
        return Response(ProjectSerializer(project, context={"request": request}).data)

    def perform_create(self, serializer):
        project = serializer.save()
        _log(project, self.request.user, "أنشأ المشروع")

    def perform_update(self, serializer):
        project = serializer.save()
        message = (
            "حرّر التفاصيل الفنية" if "details" in self.request.data
            else "عدّل بيانات المشروع"
        )
        _log(project, self.request.user, message)

    def destroy(self, request, *args, **kwargs):
        """حذف ناعم: يُنقل المشروع إلى المحذوفات بدل الحذف النهائي."""
        project = self.get_object()
        project.deleted_at = timezone.now()
        project.save(update_fields=["deleted_at", "updated_at"])
        _log(project, request.user, "نقل المشروع إلى المحذوفات")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def restore(self, request, pk=None):
        """استعادة مشروع من المحذوفات."""
        project = self.get_object()
        project.deleted_at = None
        project.save(update_fields=["deleted_at", "updated_at"])
        _log(project, request.user, "استعاد المشروع من المحذوفات")
        return self._project_response(request, project)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def archive(self, request, pk=None):
        """أرشفة مشروع منتهٍ — يخرج من القوائم اليومية ويبقى سجله كاملاً."""
        project = self.get_object()
        project.archived_at = timezone.now()
        project.save(update_fields=["archived_at", "updated_at"])
        _log(project, request.user, "أرشف المشروع")
        return self._project_response(request, project)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def unarchive(self, request, pk=None):
        """إعادة مشروع من الأرشيف إلى القوائم النشطة."""
        project = self.get_object()
        project.archived_at = None
        project.save(update_fields=["archived_at", "updated_at"])
        _log(project, request.user, "أعاد المشروع من الأرشيف")
        return self._project_response(request, project)

    @action(detail=True, methods=["delete"], permission_classes=[IsManager])
    def purge(self, request, pk=None):
        """حذف نهائي لا رجعة فيه — يحذف المشروع بمهامه وتحديثاته."""
        self.get_object().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def propose_details(self, request, pk=None):
        """الموظف يقترح تعديلاً للتفاصيل الفنية — يُحفظ للمراجعة دون مساس بالنسخة المعتمدة."""
        project = self.get_object()
        project.pending_details = request.data.get("details", "")
        project.has_pending_details = True
        project.pending_details_by = request.user
        project.pending_details_at = timezone.now()
        project.save()
        _log(project, request.user, "اقترح تعديلاً على التفاصيل الفنية")
        _notify(
            _managers(), actor=request.user,
            kind=Notification.Kind.DETAILS_PROPOSED,
            message=f"اقترح {request.user} تعديلاً على تفاصيل مشروع «{project.title}»",
            project=project,
        )
        return self._project_response(request, project)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def approve_details(self, request, pk=None):
        """المدير يعتمد التعديل المقترح فيحل محل النسخة المعتمدة."""
        project = self.get_object()
        if not project.has_pending_details:
            return Response({"detail": "لا يوجد تعديل معلق."}, status=status.HTTP_400_BAD_REQUEST)
        project.details = project.pending_details
        self._clear_pending(project)
        _log(project, request.user, "اعتمد التعديل المقترح على التفاصيل الفنية")
        return self._project_response(request, project)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def reject_details(self, request, pk=None):
        """المدير يتجاهل التعديل المقترح ويُبقي آخر نسخة معتمدة."""
        project = self.get_object()
        if not project.has_pending_details:
            return Response({"detail": "لا يوجد تعديل معلق."}, status=status.HTTP_400_BAD_REQUEST)
        self._clear_pending(project)
        _log(project, request.user, "تجاهل التعديل المقترح وأبقى النسخة المعتمدة")
        return self._project_response(request, project)

    @staticmethod
    def _clear_pending(project):
        project.pending_details = ""
        project.has_pending_details = False
        project.pending_details_by = None
        project.pending_details_at = None
        project.save()


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer

    def get_queryset(self):
        qs = Task.objects.select_related("project").prefetch_related("tags", "assignees")
        qs = qs.filter(project__deleted_at__isnull=True)  # مهام المشاريع المحذوفة تختفي معها
        if not is_manager(self.request.user):
            qs = qs.filter(assignees=self.request.user)  # الموظف يرى مهامه فقط

        # إجراءات المحذوفات تستهدف المهام المحذوفة ناعماً فقط
        if self.action in ("restore", "purge"):
            return qs.filter(deleted_at__isnull=False)
        if self.action == "list" and self.request.query_params.get("trashed"):
            if not is_manager(self.request.user):
                raise PermissionDenied("قسم المحذوفات متاح للمدير فقط.")
            return qs.filter(deleted_at__isnull=False).order_by("-deleted_at")
        qs = qs.filter(deleted_at__isnull=True)

        params = self.request.query_params
        if project_id := params.get("project"):
            qs = qs.filter(project_id=project_id)
        if status_value := params.get("status"):
            qs = qs.filter(status=status_value)
        if assignee_id := params.get("assignee"):
            qs = qs.filter(assignees__id=assignee_id)
        if text := params.get("q"):
            qs = qs.filter(title__icontains=text)
        for tag_name in params.getlist("tag"):  # منطق AND: المهمة تحمل كل الوسوم المحددة
            qs = qs.filter(tags__name=tag_name)

        ordering = params.get("ordering", "-created_at")
        if ordering.lstrip("-") in ALLOWED_TASK_ORDERINGS:
            qs = qs.order_by(ordering)
        return qs.distinct()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["unread_task_ids"] = _unread_comment_task_ids(self.request.user)
        # المهام التي اطّلع عليها المستخدم — غيابها يعني «مهمة غير مقروءة»
        context["seen_task_ids"] = set(
            TaskSeen.objects.filter(user=self.request.user).values_list("task_id", flat=True)
        )
        return context

    @action(detail=False, methods=["post"])
    def mark_seen(self, request):
        """تعليم مهام كمقروءة — تستدعيها الواجهة بعد عرضها أمام المستخدم."""
        ids = request.data.get("ids") or []
        if not isinstance(ids, list):
            return Response({"detail": "ids يجب أن تكون قائمة."}, status=status.HTTP_400_BAD_REQUEST)
        ids = [item for item in ids if isinstance(item, int)]
        tasks = self.get_queryset().filter(id__in=ids)  # يحترم نطاق الموظف
        TaskSeen.objects.bulk_create(
            [TaskSeen(task=task, user=request.user) for task in tasks],
            ignore_conflicts=True,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_create(self, serializer):
        if is_manager(self.request.user):
            task = serializer.save()
        else:
            # الموظف يقترح مهمة: الحالة «مقترحة» إجبارياً وتُسند إليه ليراها
            # في قائمته — المدير يعتمدها (يفتحها) أو يعدّلها أو يحذفها
            task = serializer.save(
                status=Task.Status.SUGGESTED, assignees=[self.request.user]
            )
        # الكاتب اطّلع على مهمته بطبيعة الحال — تبقى «غير مقروءة» للبقية
        TaskSeen.objects.create(task=task, user=self.request.user)

        if task.status == Task.Status.SUGGESTED:
            _log(task.project, self.request.user, f"اقترح المهمة «{task.title}»")
            _notify(
                _managers(), actor=self.request.user,
                kind=Notification.Kind.TASK_SUGGESTED,
                message=f"اقترح {self.request.user} مهمة «{task.title}» — بانتظار اعتمادك",
                task=task, project=task.project,
            )
            return

        names = "، ".join(str(u) for u in task.assignees.all())
        _log(
            task.project, self.request.user,
            f"أنشأ المهمة «{task.title}»" + (f" وأسندها إلى {names}" if names else ""),
        )
        _notify(
            task.assignees.all(), actor=self.request.user,
            kind=Notification.Kind.TASK_ASSIGNED,
            message=f"أسند إليك {self.request.user} مهمة «{task.title}»",
            task=task, project=task.project,
        )

    def update(self, request, *args, **kwargs):
        task = self.get_object()
        if not is_manager(request.user):
            # قواعد الانتقال: الحالتان الحالية والجديدة يجب أن تكونا ضمن
            # حالات الموظف الأربع — «مقترحة» و«منجزة» خارج متناوله
            if task.status == Task.Status.SUGGESTED:
                raise PermissionDenied("المهمة المقترحة بانتظار اعتماد المدير أولاً.")
            if task.status == Task.Status.DONE:
                raise PermissionDenied("المهمة المنجزة مغلقة — لا يعيد فتحها إلا المدير.")
            extra_fields = set(request.data.keys()) - EMPLOYEE_EDITABLE_FIELDS
            if extra_fields:
                raise PermissionDenied("يمكن للموظف تغيير حالة المهمة فقط.")
            if request.data.get("status") not in EMPLOYEE_ALLOWED_STATUSES:
                raise PermissionDenied(
                    "يمكن للموظف التنقل بين «مفتوحة» و«قيد الإنجاز» و«قيد الانتظار» "
                    "و«قيد المراجعة» فقط — والإغلاق «منجزة» صلاحية المدير حصراً."
                )
        old_assignees = set(task.assignees.values_list("id", flat=True))
        old_status = task.status
        response = super().update(request, *args, **kwargs)
        task.refresh_from_db()

        # إشعار من أُسندت إليهم المهمة حديثاً
        added = set(task.assignees.values_list("id", flat=True)) - old_assignees
        if added:
            names = "، ".join(str(u) for u in User.objects.filter(id__in=added))
            _log(task.project, request.user, f"أسند المهمة «{task.title}» إلى {names}")
            _notify(
                User.objects.filter(id__in=added), actor=request.user,
                kind=Notification.Kind.TASK_ASSIGNED,
                message=f"أسند إليك {request.user} مهمة «{task.title}»",
                task=task, project=task.project,
            )

        # سجل النشاط: تغيّر الحالة أو تعديل عام
        if task.status != old_status:
            _log(
                task.project, request.user,
                f"غيّر حالة المهمة «{task.title}» إلى «{task.get_status_display()}»",
            )
        elif not added:
            _log(task.project, request.user, f"عدّل المهمة «{task.title}»")

        # مهمة متكررة أُنجزت الآن ← أنشئ دورتها التالية تلقائياً
        if (
            task.status == Task.Status.DONE
            and old_status != Task.Status.DONE
            and task.recurrence != Task.Recurrence.NONE
        ):
            self._spawn_next_occurrence(task, request.user)

        # إشعار تغيّر الحالة: الموظف يرفع للمراجعة → المدراء،
        # والمدير يغيّر الحالة → الموظفون المسندون
        if task.status != old_status:
            if not is_manager(request.user):
                if task.status == Task.Status.REVIEW:
                    _notify(
                        _managers(), actor=request.user,
                        kind=Notification.Kind.TASK_STATUS,
                        message=f"رفع {request.user} مهمة «{task.title}» للمراجعة",
                        task=task, project=task.project,
                    )
            else:
                _notify(
                    task.assignees.all(), actor=request.user,
                    kind=Notification.Kind.TASK_STATUS,
                    message=(
                        f"غيّر {request.user} حالة مهمة «{task.title}» "
                        f"إلى «{task.get_status_display()}»"
                    ),
                    task=task, project=task.project,
                )
        return response

    def _spawn_next_occurrence(self, task, actor):
        """استنساخ مهمة متكررة أُنجزت: نفس البيانات والمسندين، الحالة مفتوحة،
        والاستحقاق مُرحَّل حسب دورية التكرار (أساسه استحقاقها أو اليوم)."""
        next_due = _advance_date(task.due_date or timezone.localdate(), task.recurrence)
        clone = Task.objects.create(
            project=task.project, title=task.title, priority=task.priority,
            due_date=next_due, color=task.color, recurrence=task.recurrence,
        )
        clone.tags.set(task.tags.all())
        clone.assignees.set(task.assignees.all())
        _log(
            task.project, actor,
            f"أُنشئت الدورة التالية للمهمة المتكررة «{task.title}» (استحقاقها {next_due})",
        )
        _notify(
            clone.assignees.all(), actor=actor,
            kind=Notification.Kind.TASK_ASSIGNED,
            message=f"دورة جديدة من المهمة المتكررة «{clone.title}» — استحقاقها {next_due}",
            task=clone, project=clone.project,
        )

    def destroy(self, request, *args, **kwargs):
        """حذف ناعم: تُنقل المهمة إلى المحذوفات بدل الحذف النهائي."""
        if not is_manager(request.user):
            raise PermissionDenied("حذف المهام متاح للمدير فقط.")
        task = self.get_object()
        task.deleted_at = timezone.now()
        task.save(update_fields=["deleted_at", "updated_at"])
        _log(task.project, request.user, f"نقل المهمة «{task.title}» إلى المحذوفات")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def restore(self, request, pk=None):
        """استعادة مهمة من المحذوفات."""
        task = self.get_object()
        task.deleted_at = None
        task.save(update_fields=["deleted_at", "updated_at"])
        _log(task.project, request.user, f"استعاد المهمة «{task.title}» من المحذوفات")
        return Response(TaskSerializer(task, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["delete"], permission_classes=[IsManager])
    def purge(self, request, pk=None):
        """حذف نهائي لا رجعة فيه — يحذف المهمة بتعليقاتها."""
        task = self.get_object()
        _log(task.project, request.user, f"حذف المهمة «{task.title}» نهائياً")
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        """تعليقات المهمة: get_object يحترم نطاق الموظف، فلا يعلّق إلا على مهامه.
        القراءة أو الإضافة تُحدّث مؤشر «آخر اطلاع» فيختفي تنبيه غير المقروء."""
        task = self.get_object()
        # آخر اطلاع السابق يحدد أي التعليقات «غير مقروءة» في هذا العرض،
        # ثم يُحدَّث فوراً فتصبح مقروءة في الفتح التالي
        prev_seen = (
            TaskCommentRead.objects.filter(task=task, user=request.user)
            .values_list("last_seen_at", flat=True)
            .first()
        )
        TaskCommentRead.objects.update_or_create(
            task=task, user=request.user, defaults={"last_seen_at": timezone.now()}
        )
        if request.method == "GET":
            qs = task.comments.select_related("author")
            context = {"request": request, "prev_seen": prev_seen}
            return Response(TaskCommentSerializer(qs, many=True, context=context).data)
        serializer = TaskCommentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(task=task, author=request.user)
        _log(task.project, request.user, f"علّق على المهمة «{task.title}»")

        # منشن (@username): إشعار موجّه لكل مُشار إليه — وتُستبعد أسماؤهم من
        # إشعار التعليق العام كي لا يصلهم إشعاران عن التعليق نفسه
        usernames = set(re.findall(r"@([\w.@+-]+)", comment.body))
        mentioned = (
            list(User.objects.filter(username__in=usernames, is_active=True))
            if usernames else []
        )
        if mentioned:
            _notify(
                mentioned, actor=request.user,
                kind=Notification.Kind.MENTION,
                message=f"أشار إليك {request.user} في تعليق على مهمة «{task.title}»",
                task=task, project=task.project,
            )
        mentioned_ids = {u.id for u in mentioned}

        # يصل الإشعار للموظفين المسندين وللمدراء — عدا كاتب التعليق والمُشار إليهم
        recipients = [
            u for u in list(task.assignees.all()) + list(_managers())
            if u.id not in mentioned_ids
        ]
        _notify(
            recipients, actor=request.user,
            kind=Notification.Kind.NEW_COMMENT,
            message=f"علّق {request.user} على مهمة «{task.title}»",
            task=task, project=task.project,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProjectUpdateViewSet(viewsets.ModelViewSet):
    """تحديثات المشروع (سجل الأحداث): الكل يضيف، وكل كاتب يعدّل/يحذف
    تحديثاته فقط — والمدير يعدّل/يحذف أي تحديث."""

    serializer_class = ProjectUpdateSerializer

    def get_queryset(self):
        qs = (
            ProjectUpdate.objects.select_related("author", "project")
            .prefetch_related("attachments")
            .filter(project__deleted_at__isnull=True)
        )
        # إجراءات المحذوفات تستهدف التحديثات المحذوفة ناعماً فقط
        if self.action in ("restore", "purge"):
            return qs.filter(deleted_at__isnull=False)
        if self.action == "list" and self.request.query_params.get("trashed"):
            if not is_manager(self.request.user):
                raise PermissionDenied("قسم المحذوفات متاح للمدير فقط.")
            return qs.filter(deleted_at__isnull=False).order_by("-deleted_at")
        qs = qs.filter(deleted_at__isnull=True)
        if project_id := self.request.query_params.get("project"):
            qs = qs.filter(project_id=project_id)
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # آخر اطلاع لكل مشروع — أساس مؤشر «تحديث غير مقروء»
        context["updates_last_seen"] = dict(
            ProjectUpdateRead.objects.filter(user=self.request.user)
            .values_list("project_id", "last_seen_at")
        )
        return context

    def list(self, request, *args, **kwargs):
        # التسلسل مقصود: تُعلَّم غير المقروءة في الرد أولاً (وفق آخر اطلاع السابق)
        # ثم يُحدَّث الاطلاع — فتظهر مميزة مرة واحدة وتصبح مقروءة في الزيارة التالية.
        # فتح صفحة مشروع محدد فقط يُعدّ قراءةً — الخلاصة الموحدة لا تُعلّم شيئاً.
        response = super().list(request, *args, **kwargs)
        project_id = request.query_params.get("project")
        if project_id and project_id.isdigit() and Project.objects.filter(
            pk=project_id, deleted_at__isnull=True
        ).exists():
            ProjectUpdateRead.objects.update_or_create(
                project_id=project_id, user=request.user,
                defaults={"last_seen_at": timezone.now()},
            )
        return response

    def perform_create(self, serializer):
        update = serializer.save(author=self.request.user)
        _log(update.project, self.request.user, "أضاف تحديثاً على المشروع")
        # يصل الإشعار للمدراء ولكل موظف له مهمة في المشروع — عدا الكاتب
        recipients = list(_managers()) + list(
            User.objects.filter(assigned_tasks__project=update.project)
        )
        _notify(
            recipients, actor=self.request.user,
            kind=Notification.Kind.PROJECT_UPDATE,
            message=f"أضاف {self.request.user} تحديثاً على مشروع «{update.project.title}»",
            project=update.project,
        )

    def update(self, request, *args, **kwargs):
        self._check_can_modify(request)
        response = super().update(request, *args, **kwargs)
        update = self.get_object()
        _log(update.project, request.user, "عدّل تحديثاً على المشروع")
        return response

    def destroy(self, request, *args, **kwargs):
        """حذف ناعم: يُنقل التحديث إلى المحذوفات بدل الحذف النهائي."""
        self._check_can_modify(request)
        update = self.get_object()
        update.deleted_at = timezone.now()
        update.save(update_fields=["deleted_at", "updated_at"])
        _log(update.project, request.user, "نقل تحديثاً إلى المحذوفات")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def restore(self, request, pk=None):
        """استعادة تحديث من المحذوفات."""
        update = self.get_object()
        update.deleted_at = None
        update.save(update_fields=["deleted_at", "updated_at"])
        _log(update.project, request.user, "استعاد تحديثاً من المحذوفات")
        return Response(
            ProjectUpdateSerializer(update, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=["delete"], permission_classes=[IsManager])
    def purge(self, request, pk=None):
        """حذف نهائي لا رجعة فيه."""
        update = self.get_object()
        _log(update.project, request.user, "حذف تحديثاً نهائياً")
        update.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _check_can_modify(self, request):
        update = self.get_object()
        if not is_manager(request.user) and update.author_id != request.user.id:
            raise PermissionDenied("يمكنك تعديل أو حذف تحديثاتك فقط.")


class AttachmentViewSet(viewsets.ModelViewSet):
    """مرفقات المشاريع: الكل يرفع؛ صاحب المرفق يعدّل وصفه أو يحذفه —
    والمدير يدير الجميع."""

    serializer_class = AttachmentSerializer

    def get_queryset(self):
        # مرفقات المشاريع المحذوفة ناعماً تختفي مع مشاريعها (كالمهام والتحديثات)
        qs = Attachment.objects.select_related("uploaded_by", "project").filter(
            project__deleted_at__isnull=True
        )
        if project_id := self.request.query_params.get("project"):
            qs = qs.filter(project_id=project_id)
        else:
            # القائمة الشاملة (كل المرفقات) بلا مرفقات المشاريع المؤرشفة
            qs = qs.filter(project__archived_at__isnull=True)
        return qs

    def perform_create(self, serializer):
        uploaded_file = serializer.validated_data["file"]
        attachment = serializer.save(
            uploaded_by=self.request.user, file_name=uploaded_file.name
        )
        # مصغّرة للمرفقات الصورية — القوائم تعرضها بدل الأصل الكبير
        if is_image_name(attachment.file_name):
            thumb = make_thumbnail(attachment.file, ATTACHMENT_THUMB_SIZE)
            if thumb:
                attachment.thumbnail.save(thumb_name(attachment.file_name), thumb, save=True)
        _log(attachment.project, self.request.user, f"رفع المرفق «{attachment.file_name}»")

    def update(self, request, *args, **kwargs):
        self._check_can_modify(request)
        response = super().update(request, *args, **kwargs)
        attachment = self.get_object()
        _log(attachment.project, request.user, f"عدّل بيانات المرفق «{attachment.file_name}»")
        return response

    def destroy(self, request, *args, **kwargs):
        self._check_can_modify(request)
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        _log(instance.project, self.request.user, f"حذف المرفق «{instance.file_name}»")
        if instance.file:
            instance.file.delete(save=False)  # احذف الملف من القرص أيضاً
        if instance.thumbnail:
            instance.thumbnail.delete(save=False)
        instance.delete()

    def _check_can_modify(self, request):
        attachment = self.get_object()
        if not is_manager(request.user) and attachment.uploaded_by_id != request.user.id:
            raise PermissionDenied("يمكنك تعديل أو حذف مرفقاتك فقط.")


class DetailsImageUploadView(APIView):
    """رفع صورة تُدرج داخل محرر التفاصيل الفنية — يعيد رابط الصورة."""

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = serializer.validated_data["image"]
        path = default_storage.save(f"details/{image.name}", image)
        return Response({"url": default_storage.url(path)}, status=status.HTTP_201_CREATED)


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    """الوسوم تُدار ضمنياً عبر المهام؛ القراءة تكفي لاقتراحات الإدخال والفلاتر."""

    queryset = Tag.objects.all()
    serializer_class = TagSerializer


class GlobalSearchView(APIView):
    """بحث Ctrl+K الشامل: عناوين المشاريع وتفاصيلها + عناوين المهام
    + المرفقات (اسم الملف والوصف)."""

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"projects": [], "tasks": [], "attachments": []})

        projects = Project.objects.filter(
            deleted_at__isnull=True, archived_at__isnull=True
        ).filter(
            Q(title__icontains=query) | Q(details__icontains=query)
        ).annotate(tasks_count=Count("tasks", filter=Q(tasks__deleted_at__isnull=True)))[:10]

        tasks = (
            Task.objects.select_related("project")
            .prefetch_related("tags", "assignees")
            .filter(
                project__deleted_at__isnull=True,
                project__archived_at__isnull=True,
                deleted_at__isnull=True,
            )
        )
        if not is_manager(request.user):
            tasks = tasks.filter(assignees=request.user)
        tasks = tasks.filter(title__icontains=query)[:10]

        attachments = (
            Attachment.objects.select_related("uploaded_by", "project")
            .filter(project__deleted_at__isnull=True)
            .filter(Q(file_name__icontains=query) | Q(description__icontains=query))[:10]
        )

        context = {"request": request}
        return Response({
            "projects": ProjectSerializer(projects, many=True, context=context).data,
            "tasks": TaskSerializer(tasks, many=True, context=context).data,
            "attachments": AttachmentSerializer(attachments, many=True, context=context).data,
        })
