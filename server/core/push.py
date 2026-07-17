"""إرسال إشعارات Web Push — تصل للجهاز حتى والتطبيق مغلق (بعكس فحص
الواجهة الدوري الذي يتطلب تبويباً مفتوحاً). الإرسال في خيط منفصل كي لا
يبطئ الطلب، والاشتراكات الميتة تُنظَّف تلقائياً."""
import json
import threading

from django.conf import settings

try:
    from pywebpush import WebPushException, webpush
except ImportError:  # المكتبة غير مثبتة — تُعطَّل الميزة بصمت
    webpush = None
    WebPushException = Exception


def send_push(recipients, message, url="/"):
    """أرسل إشعار دفع لكل اشتراكات المستلمين — أفضل جهد، لا يرفع أخطاء."""
    if webpush is None or not settings.VAPID_PRIVATE_KEY:
        return
    subscriptions = [sub for user in recipients for sub in user.push_subscriptions.all()]
    if not subscriptions:
        return

    payload = json.dumps({"title": "لوحة شركة الفخار", "body": message, "url": url})

    def _send():
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": f"mailto:{settings.VAPID_ADMIN_EMAIL}"},
                )
            except WebPushException as exc:
                response = getattr(exc, "response", None)
                if response is not None and response.status_code in (404, 410):
                    sub.delete()  # اشتراك منتهٍ — المتصفح ألغاه
            except Exception:
                pass  # فشل شبكة عابر — الإشعار داخل التطبيق يصل على أي حال

    threading.Thread(target=_send, daemon=True).start()
