"""جلب إيميلات المشروع عبر IMAP واختبار الاتصال (IMAP + SMTP).

آلية الربط: كل رسالة تخص مشروعاً يحمل موضوعها «وسم المشروع» (email_tag).
نمسح ترويسات أحدث الرسائل في صندوق الوارد ونرشّح محلياً — أوثق من بحث
IMAP بالعربية الذي تختلف دقته بين المزودات.
"""
import base64
import email
import imaplib
import smtplib
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

from .google_oauth import GoogleOAuthError, get_access_token

# عدد الرسائل الأحدث التي تُمسح ترويساتها بحثاً عن الوسم
SCAN_DEPTH = 300
# الحد الأقصى للنتائج المعادة
MAX_RESULTS = 50
TIMEOUT = 20


class EmailFetchError(Exception):
    """خطأ اتصال/مصادقة مع خادم البريد — رسالته تصل للواجهة كما هي."""


def _decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _xoauth2_string(account) -> str:
    """سلسلة مصادقة XOAUTH2 لجلسات IMAP/SMTP بتوكن Google."""
    try:
        token = get_access_token(account)
    except GoogleOAuthError as error:
        raise EmailFetchError(str(error)) from error
    return f"user={account.email_address}\1auth=Bearer {token}\1\1"


def _connect_imap(account) -> imaplib.IMAP4_SSL:
    try:
        box = imaplib.IMAP4_SSL(account.imap_host, account.imap_port, timeout=TIMEOUT)
    except Exception as error:
        raise EmailFetchError(
            f"تعذر الاتصال بخادم الاستلام {account.imap_host}:{account.imap_port} — {error}"
        ) from error
    try:
        if account.auth_method == "GOOGLE":
            auth = _xoauth2_string(account)
            box.authenticate("XOAUTH2", lambda _challenge: auth.encode())
        else:
            box.login(account.email_address, account.password)
    except imaplib.IMAP4.error as error:
        raise EmailFetchError(
            "رفض خادم البريد تسجيل الدخول — "
            + (
                "أعد تسجيل الدخول عبر Google من إعدادات البريد."
                if account.auth_method == "GOOGLE"
                else "تأكد من العنوان وكلمة مرور التطبيق "
                "(حساب Google يتطلب App Password وليس كلمة المرور العادية)."
            )
        ) from error
    return box


def fetch_project_emails(account, tag: str) -> list[dict]:
    """أحدث رسائل الوارد التي يحمل موضوعها وسم المشروع — الأحدث أولاً."""
    box = _connect_imap(account)
    try:
        box.select("INBOX", readonly=True)
        status, data = box.uid("search", None, "ALL")
        if status != "OK":
            raise EmailFetchError("تعذر قراءة صندوق الوارد.")
        uids = data[0].split()
        recent = uids[-SCAN_DEPTH:]
        if not recent:
            return []

        id_range = b",".join(recent).decode()
        status, chunks = box.uid(
            "fetch", id_range, "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE)])"
        )
        if status != "OK":
            raise EmailFetchError("تعذر جلب ترويسات الرسائل.")

        needle = tag.strip().lower()
        results: list[dict] = []
        for index, part in enumerate(chunks):
            if not isinstance(part, tuple):
                continue
            message = email.message_from_bytes(part[1])
            subject = _decode(message.get("Subject"))
            if needle not in subject.lower():
                continue
            sent_at = None
            try:
                sent_at = parsedate_to_datetime(message.get("Date", "")).isoformat()
            except Exception:
                pass
            results.append({
                # مفتاح فريد للواجهة — رقم الرسالة ضمن الدفعة يكفي
                "id": index,
                "subject": subject,
                "sender": _decode(message.get("From")),
                "date": sent_at,
            })
        results.reverse()  # الأحدث أولاً
        return results[:MAX_RESULTS]
    finally:
        try:
            box.logout()
        except Exception:
            pass


def test_connection(account) -> dict:
    """اختبار المصادقة على IMAP وSMTP معاً — يعيد نتيجة كل جهة."""
    imap_ok, imap_error = True, ""
    try:
        _connect_imap(account).logout()
    except EmailFetchError as error:
        imap_ok, imap_error = False, str(error)

    smtp_ok, smtp_error = True, ""
    try:
        if account.smtp_port == 465:
            server = smtplib.SMTP_SSL(account.smtp_host, account.smtp_port, timeout=TIMEOUT)
        else:
            server = smtplib.SMTP(account.smtp_host, account.smtp_port, timeout=TIMEOUT)
            server.starttls()
        if account.auth_method == "GOOGLE":
            encoded = base64.b64encode(_xoauth2_string(account).encode()).decode()
            code, reply = server.docmd("AUTH", "XOAUTH2 " + encoded)
            if code != 235:
                raise EmailFetchError(f"رفض خادم الإرسال المصادقة ({code}): {reply!r}")
        else:
            server.login(account.email_address, account.password)
        server.quit()
    except EmailFetchError as error:
        smtp_ok, smtp_error = False, str(error)
    except Exception as error:
        smtp_ok, smtp_error = False, f"تعذر الاتصال بخادم الإرسال — {error}"

    return {
        "imap_ok": imap_ok, "imap_error": imap_error,
        "smtp_ok": smtp_ok, "smtp_error": smtp_error,
    }
