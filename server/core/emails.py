"""جلب إيميلات المشروع عبر IMAP واختبار الاتصال (IMAP + SMTP).

آلية الربط: كل رسالة تخص مشروعاً يحمل موضوعها «وسم المشروع» (email_tag).
نمسح ترويسات أحدث الرسائل في صندوق الوارد ونرشّح محلياً — أوثق من بحث
IMAP بالعربية الذي تختلف دقته بين المزودات.
"""
import base64
import email
import imaplib
import re
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


# أسماء مجلد «المُرسَل» الشائعة عبر المزودات — نجرّبها إذا فشل اكتشاف السمة \Sent
SENT_FOLDER_CANDIDATES = [
    "[Gmail]/Sent Mail", "Sent", "Sent Items", "Sent Messages", "INBOX.Sent",
]


def _select_sent(box) -> bool:
    """اختيار مجلد الصادر: نكتشفه أولاً عبر السمة الخاصة \\Sent (RFC 6154)
    ثم نتراجع إلى الأسماء الشائعة. يعيد True عند نجاح الاختيار."""
    names: list[str] = []
    try:
        typ, boxes = box.list()
        if typ == "OK":
            for raw in boxes or []:
                line = raw.decode(errors="ignore") if isinstance(raw, (bytes, bytearray)) else str(raw)
                if "\\Sent" in line:
                    # اسم المجلد هو آخر سلسلة مقتبسة في السطر
                    match = re.search(r'"([^"]+)"\s*$', line)
                    if match:
                        names.append(match.group(1))
    except Exception:
        pass
    names += SENT_FOLDER_CANDIDATES
    for name in names:
        try:
            typ, _ = box.select(f'"{name}"', readonly=True)
            if typ == "OK":
                return True
        except Exception:
            continue
    return False


def fetch_mailbox(account, folder: str = "received", tag: str = "",
                  query: str = "", limit: int = MAX_RESULTS) -> list[dict]:
    """صندوق بريد موحّد: أحدث رسائل الوارد (INBOX) أو الصادر (Sent)، مع
    ترشيح اختياري بوسم مشروع (subject) وبنص بحث (subject/from/to). الأحدث أولاً."""
    box = _connect_imap(account)
    try:
        if folder == "sent":
            if not _select_sent(box):
                raise EmailFetchError("تعذر العثور على مجلد الصادر في خادم البريد.")
        else:
            box.select("INBOX", readonly=True)

        typ, data = box.uid("search", None, "ALL")
        if typ != "OK":
            raise EmailFetchError("تعذر قراءة صندوق البريد.")
        uids = data[0].split()
        recent = uids[-SCAN_DEPTH:]
        if not recent:
            return []

        id_range = b",".join(recent).decode()
        typ, chunks = box.uid(
            "fetch", id_range, "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO DATE)])"
        )
        if typ != "OK":
            raise EmailFetchError("تعذر جلب ترويسات الرسائل.")

        needle = tag.strip().lower()
        q = query.strip().lower()
        results: list[dict] = []
        for part in chunks:
            if not isinstance(part, tuple):
                continue
            descr = part[0]
            descr = descr.decode(errors="ignore") if isinstance(descr, (bytes, bytearray)) else str(descr)
            uid_match = re.search(r"UID (\d+)", descr)
            uid = int(uid_match.group(1)) if uid_match else len(results)

            message = email.message_from_bytes(part[1])
            subject = _decode(message.get("Subject"))
            sender = _decode(message.get("From"))
            recipient = _decode(message.get("To"))
            if needle and needle not in subject.lower():
                continue
            if q and q not in subject.lower() and q not in sender.lower() and q not in recipient.lower():
                continue
            sent_at = None
            try:
                sent_at = parsedate_to_datetime(message.get("Date", "")).isoformat()
            except Exception:
                pass
            results.append({
                "id": uid,
                "subject": subject,
                "sender": sender,
                "to": recipient,
                "date": sent_at,
                "folder": folder,
            })
        # UID تصاعدي في الخادم، والأحدث الأعلى — نرتّب تنازلياً لضمان الترتيب
        results.sort(key=lambda m: m["id"], reverse=True)
        return results[:limit]
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
