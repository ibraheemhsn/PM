"""«تسجيل الدخول عبر Google» لربط البريد — OAuth 2.0.

الصلاحية المطلوبة https://mail.google.com/‎ تتيح IMAP وSMTP عبر XOAUTH2،
وopenid/email لمعرفة عنوان البريد المرتبط. refresh token يُحفظ مرة واحدة
وaccess token يتجدد تلقائياً قبيل انتهائه.
"""
from datetime import timedelta
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.utils import timezone

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
SCOPES = "https://mail.google.com/ openid email"
TIMEOUT = 20


class GoogleOAuthError(Exception):
    """فشل في تدفق OAuth — رسالته تصل للواجهة."""


def is_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def build_auth_url(state: str) -> str:
    """رابط شاشة موافقة Google — prompt=consent يضمن إصدار refresh token."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    """استبدال كود الموافقة بالتوكنات."""
    response = requests.post(TOKEN_URL, data={
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
        "code": code,
    }, timeout=TIMEOUT)
    if response.status_code != 200:
        raise GoogleOAuthError(f"رفض Google استبدال كود الموافقة: {response.text[:200]}")
    return response.json()


def fetch_email(access_token: str) -> str:
    """عنوان بريد الحساب الذي وافق على الربط."""
    response = requests.get(
        USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=TIMEOUT
    )
    if response.status_code != 200:
        raise GoogleOAuthError("تعذر قراءة عنوان البريد من Google.")
    email = response.json().get("email", "")
    if not email:
        raise GoogleOAuthError("لم يُعد Google عنوان بريد.")
    return email


def store_tokens(account, tokens: dict) -> None:
    """حفظ التوكنات على الحساب — refresh token لا يصل إلا بأول موافقة."""
    account.google_access_token = tokens.get("access_token", "")
    if tokens.get("refresh_token"):
        account.google_refresh_token = tokens["refresh_token"]
    account.google_token_expiry = timezone.now() + timedelta(
        seconds=int(tokens.get("expires_in", 3600))
    )
    account.save()


def get_access_token(account) -> str:
    """توكن وصول صالح — يُجدَّد تلقائياً قبل دقيقة من انتهائه."""
    if (
        account.google_access_token
        and account.google_token_expiry
        and account.google_token_expiry > timezone.now() + timedelta(minutes=1)
    ):
        return account.google_access_token

    if not account.google_refresh_token:
        raise GoogleOAuthError("انتهى ربط Google — أعد تسجيل الدخول عبر Google من إعدادات البريد.")
    response = requests.post(TOKEN_URL, data={
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": account.google_refresh_token,
    }, timeout=TIMEOUT)
    if response.status_code != 200:
        raise GoogleOAuthError(
            "تعذر تجديد توكن Google — أعد تسجيل الدخول عبر Google من إعدادات البريد."
        )
    store_tokens(account, response.json())
    return account.google_access_token


def revoke(account) -> None:
    """إلغاء التوكن لدى Google عند فصل الحساب — بأفضل جهد."""
    token = account.google_refresh_token or account.google_access_token
    if not token:
        return
    try:
        requests.post(REVOKE_URL, params={"token": token}, timeout=10)
    except requests.RequestException:
        pass
