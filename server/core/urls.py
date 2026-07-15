from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AttachmentViewSet, DetailsImageUploadView, GlobalSearchView, LoginView,
    LogoutView, MeView, ProjectUpdateViewSet, ProjectViewSet, TagViewSet,
    TaskViewSet, UserViewSet,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("updates", ProjectUpdateViewSet, basename="update")
router.register("attachments", AttachmentViewSet, basename="attachment")
router.register("tasks", TaskViewSet, basename="task")
router.register("tags", TagViewSet, basename="tag")
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("uploads/images/", DetailsImageUploadView.as_view(), name="details-image-upload"),
    path("search/", GlobalSearchView.as_view(), name="global-search"),
    path("", include(router.urls)),
]
