"""API views.

Roles enforced server-side (not just in the UI):
- المدير: كل عمليات CRUD على المشاريع والمهام والموظفين.
- الموظف: يرى المهام المسندة إليه فقط، يغيّر حالتها إلى «قيد الإنجاز» أو
  «قيد المراجعة» فقط، ويعلّق عليها.
"""
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

from .models import (
    Attachment, Notification, Project, ProjectUpdate, Tag, Task, TaskComment,
    TaskCommentRead, User,
)
from .permissions import IsManager, IsManagerOrReadOnly, is_manager
from .serializers import (
    AttachmentSerializer, ImageUploadSerializer, NotificationSerializer,
    ProjectSerializer, ProjectUpdateSerializer, TagSerializer,
    TaskCommentSerializer, TaskSerializer, UserSerializer,
)

ALLOWED_TASK_ORDERINGS = {"created_at", "updated_at"}

# ما يُسمح للموظف بتعديله في المهمة
EMPLOYEE_EDITABLE_FIELDS = {"status"}
EMPLOYEE_ALLOWED_STATUSES = {Task.Status.IN_PROGRESS, Task.Status.REVIEW}


# ===== الإشعارات =====

def _managers():
    return User.objects.filter(Q(is_manager=True) | Q(is_superuser=True))


def _notify(recipients, *, actor, kind, message, task=None, project=None):
    """أنشئ إشعاراً لكل مستلم — مع استبعاد الفاعل نفسه وإزالة التكرار."""
    unique = {r.id: r for r in recipients if r.id != actor.id}
    Notification.objects.bulk_create(
        Notification(
            recipient=r, actor=actor, kind=kind, message=message,
            task=task, project=project,
        )
        for r in unique.values()
    )


class NotificationViewSet(viewsets.GenericViewSet):
    """إشعارات المستخدم الحالي: القائمة (آخر 30) + تعليم كمقروء.
    الواجهة تفحصها دورياً وتعرض الجديد كإشعار متصفح مع صوت."""

    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def list(self, request):
        qs = self.get_queryset().select_related("actor")[:30]
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


# ===== المصادقة (جلسات Django) =====

@method_decorator(ensure_csrf_cookie, name="get")
class MeView(APIView):
    """يعيد المستخدم الحالي (أو null) ويزرع كعكة CSRF لبقية الطلبات."""

    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        data = UserSerializer(user, context={"request": request}).data if user else None
        return Response({"user": data})


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

    def destroy(self, request, *args, **kwargs):
        if self.get_object() == request.user:
            raise PermissionDenied("لا يمكنك حذف حسابك الحالي.")
        return super().destroy(request, *args, **kwargs)


# ===== المشاريع والمهام والوسوم =====

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsManagerOrReadOnly]

    def get_queryset(self):
        qs = Project.objects.annotate(tasks_count=Count("tasks"))
        # إجراءات المحذوفات تستهدف المشاريع المحذوفة ناعماً فقط
        if self.action in ("restore", "purge"):
            return qs.filter(deleted_at__isnull=False)
        if self.action == "list" and self.request.query_params.get("trashed"):
            if not is_manager(self.request.user):
                raise PermissionDenied("قسم المحذوفات متاح للمدير فقط.")
            return qs.filter(deleted_at__isnull=False).order_by("-deleted_at")
        return qs.filter(deleted_at__isnull=True)

    def _project_response(self, request, project):
        return Response(ProjectSerializer(project, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        """حذف ناعم: يُنقل المشروع إلى المحذوفات بدل الحذف النهائي."""
        project = self.get_object()
        project.deleted_at = timezone.now()
        project.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def restore(self, request, pk=None):
        """استعادة مشروع من المحذوفات."""
        project = self.get_object()
        project.deleted_at = None
        project.save(update_fields=["deleted_at", "updated_at"])
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
        return self._project_response(request, project)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def reject_details(self, request, pk=None):
        """المدير يتجاهل التعديل المقترح ويُبقي آخر نسخة معتمدة."""
        project = self.get_object()
        if not project.has_pending_details:
            return Response({"detail": "لا يوجد تعديل معلق."}, status=status.HTTP_400_BAD_REQUEST)
        self._clear_pending(project)
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
        context["unread_task_ids"] = self._unread_task_ids()
        return context

    def _unread_task_ids(self):
        """المهام التي فيها تعليقات من الآخرين أحدث من آخر اطلاع للمستخدم."""
        user = self.request.user
        last_seen = dict(
            TaskCommentRead.objects.filter(user=user).values_list("task_id", "last_seen_at")
        )
        latest_by_task = (
            TaskComment.objects.exclude(author=user)
            .values("task_id")
            .annotate(latest=Max("created_at"))
        )
        return {
            row["task_id"]
            for row in latest_by_task
            if row["task_id"] not in last_seen or row["latest"] > last_seen[row["task_id"]]
        }

    def create(self, request, *args, **kwargs):
        if not is_manager(request.user):
            raise PermissionDenied("إنشاء المهام متاح للمدير فقط.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        task = serializer.save()
        _notify(
            task.assignees.all(), actor=self.request.user,
            kind=Notification.Kind.TASK_ASSIGNED,
            message=f"أسند إليك {self.request.user} مهمة «{task.title}»",
            task=task, project=task.project,
        )

    def update(self, request, *args, **kwargs):
        if not is_manager(request.user):
            extra_fields = set(request.data.keys()) - EMPLOYEE_EDITABLE_FIELDS
            if extra_fields:
                raise PermissionDenied("يمكن للموظف تغيير حالة المهمة فقط.")
            if request.data.get("status") not in EMPLOYEE_ALLOWED_STATUSES:
                raise PermissionDenied(
                    "يمكن للموظف نقل المهمة إلى «قيد الإنجاز» أو «قيد المراجعة» فقط."
                )

        task = self.get_object()
        old_assignees = set(task.assignees.values_list("id", flat=True))
        old_status = task.status
        response = super().update(request, *args, **kwargs)
        task.refresh_from_db()

        # إشعار من أُسندت إليهم المهمة حديثاً
        added = set(task.assignees.values_list("id", flat=True)) - old_assignees
        if added:
            _notify(
                User.objects.filter(id__in=added), actor=request.user,
                kind=Notification.Kind.TASK_ASSIGNED,
                message=f"أسند إليك {request.user} مهمة «{task.title}»",
                task=task, project=task.project,
            )

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

    def destroy(self, request, *args, **kwargs):
        if not is_manager(request.user):
            raise PermissionDenied("حذف المهام متاح للمدير فقط.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        """تعليقات المهمة: get_object يحترم نطاق الموظف، فلا يعلّق إلا على مهامه.
        القراءة أو الإضافة تُحدّث مؤشر «آخر اطلاع» فيختفي تنبيه غير المقروء."""
        task = self.get_object()
        TaskCommentRead.objects.update_or_create(
            task=task, user=request.user, defaults={"last_seen_at": timezone.now()}
        )
        if request.method == "GET":
            qs = task.comments.select_related("author")
            return Response(
                TaskCommentSerializer(qs, many=True, context={"request": request}).data
            )
        serializer = TaskCommentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(task=task, author=request.user)
        # يصل الإشعار للموظفين المسندين وللمدراء — عدا كاتب التعليق
        _notify(
            list(task.assignees.all()) + list(_managers()), actor=request.user,
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
        qs = ProjectUpdate.objects.select_related("author", "project").filter(
            project__deleted_at__isnull=True
        )
        if project_id := self.request.query_params.get("project"):
            qs = qs.filter(project_id=project_id)
        return qs

    def perform_create(self, serializer):
        update = serializer.save(author=self.request.user)
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
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._check_can_modify(request)
        return super().destroy(request, *args, **kwargs)

    def _check_can_modify(self, request):
        update = self.get_object()
        if not is_manager(request.user) and update.author_id != request.user.id:
            raise PermissionDenied("يمكنك تعديل أو حذف تحديثاتك فقط.")


class AttachmentViewSet(viewsets.ModelViewSet):
    """مرفقات المشاريع: الكل يرفع؛ صاحب المرفق يعدّل وصفه أو يحذفه —
    والمدير يدير الجميع."""

    serializer_class = AttachmentSerializer

    def get_queryset(self):
        qs = Attachment.objects.select_related("uploaded_by")
        if project_id := self.request.query_params.get("project"):
            qs = qs.filter(project_id=project_id)
        return qs

    def perform_create(self, serializer):
        uploaded_file = serializer.validated_data["file"]
        serializer.save(uploaded_by=self.request.user, file_name=uploaded_file.name)

    def update(self, request, *args, **kwargs):
        self._check_can_modify(request)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._check_can_modify(request)
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if instance.file:
            instance.file.delete(save=False)  # احذف الملف من القرص أيضاً
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
    """بحث Ctrl+K الشامل: عناوين المشاريع وتفاصيلها + عناوين المهام."""

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"projects": [], "tasks": []})

        projects = Project.objects.filter(
            deleted_at__isnull=True
        ).filter(
            Q(title__icontains=query) | Q(details__icontains=query)
        ).annotate(tasks_count=Count("tasks"))[:10]

        tasks = (
            Task.objects.select_related("project")
            .prefetch_related("tags", "assignees")
            .filter(project__deleted_at__isnull=True)
        )
        if not is_manager(request.user):
            tasks = tasks.filter(assignees=request.user)
        tasks = tasks.filter(title__icontains=query)[:10]

        context = {"request": request}
        return Response({
            "projects": ProjectSerializer(projects, many=True, context=context).data,
            "tasks": TaskSerializer(tasks, many=True, context=context).data,
        })
