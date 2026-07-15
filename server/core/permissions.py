"""صلاحيات الأدوار: المدير يدير كل شيء، الموظف يرى مهامه ويحدّث حالتها ويعلّق."""
from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_manager(user) -> bool:
    return bool(user and user.is_authenticated and (user.is_manager or user.is_superuser))


class IsManager(BasePermission):
    message = "هذه العملية متاحة للمدير فقط."

    def has_permission(self, request, view):
        return is_manager(request.user)


class IsManagerOrReadOnly(BasePermission):
    message = "التعديل متاح للمدير فقط."

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or is_manager(request.user)
