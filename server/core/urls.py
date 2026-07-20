from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ActivityLogViewSet, AttachmentViewSet, DetailsImageUploadView,
    EmailOAuthCallbackView, EmailOAuthDisconnectView, EmailOAuthStartView,
    EmailSettingsView, EmailTestView, GlobalSearchView, LoginView, LogoutView,
    MeView, NotificationViewSet, ProjectEmailsView, ProjectOrderView,
    ProjectUpdateViewSet, ProjectViewSet, PushKeyView, PushSubscribeView,
    TagViewSet, TaskViewSet, UserViewSet,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("updates", ProjectUpdateViewSet, basename="update")
router.register("attachments", AttachmentViewSet, basename="attachment")
router.register("tasks", TaskViewSet, basename="task")
router.register("tags", TagViewSet, basename="tag")
router.register("users", UserViewSet, basename="user")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("activity", ActivityLogViewSet, basename="activity")

urlpatterns = [
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/project_order/", ProjectOrderView.as_view(), name="me-project-order"),
    path("uploads/images/", DetailsImageUploadView.as_view(), name="details-image-upload"),
    path("push/key/", PushKeyView.as_view(), name="push-key"),
    path("push/subscribe/", PushSubscribeView.as_view(), name="push-subscribe"),
    path("search/", GlobalSearchView.as_view(), name="global-search"),
    path("email/settings/", EmailSettingsView.as_view(), name="email-settings"),
    path("email/test/", EmailTestView.as_view(), name="email-test"),
    path("email/oauth/start/", EmailOAuthStartView.as_view(), name="email-oauth-start"),
    path("email/oauth/callback/", EmailOAuthCallbackView.as_view(), name="email-oauth-callback"),
    path("email/oauth/disconnect/", EmailOAuthDisconnectView.as_view(), name="email-oauth-disconnect"),
    path("emails/", ProjectEmailsView.as_view(), name="project-emails"),
    path("", include(router.urls)),
]
