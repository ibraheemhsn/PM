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
from email import policy
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

from django.utils import timezone

from .google_oauth import GoogleOAuthError, get_access_token
from .models import EmailFolder, EmailMessage, EmailSyncState, Project

# عدد الرسائل الأحدث التي تُمسح ترويساتها بحثاً عن الوسم
SCAN_DEPTH = 300
# الحد الأقصى للنتائج المعادة
MAX_RESULTS = 50
TIMEOUT = 20
# حد المزامنة الأولى (لكل مجلد) — يمنع جلب آلاف الرسائل القديمة دفعة واحدة
INITIAL_SYNC_LIMIT = 300
# أقصى طول لنص الرسالة المخزَّن (كافٍ للبحث والعرض دون تضخيم القاعدة)
BODY_MAX = 20000
# حجم دفعة الجلب من الخادم
FETCH_BATCH = 40


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


# ===== المزامنة إلى قاعدة البيانات (صندوق منفصل لكل مستخدم) =====

def _strip_html(html: str) -> str:
    """تحويل HTML إلى نص عادي — لتخزين نص الرسائل ذات المحتوى HTML."""
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    return re.sub(r"[ \t\r\f]*\n[ \t\r\f]*", "\n", re.sub(r"[ \t]{2,}", " ", text)).strip()


def _parse_date(raw):
    """يحوّل ترويسة Date إلى datetime واعٍ بالمنطقة الزمنية (أو None)."""
    try:
        dt = parsedate_to_datetime(str(raw))
    except Exception:
        return None
    if dt is None:
        return None
    if timezone.is_naive(dt):
        try:
            dt = timezone.make_aware(dt, timezone.get_default_timezone())
        except Exception:
            return None
    return dt


def _extract(raw: bytes) -> dict:
    """يستخرج من رسالة كاملة: الموضوع والمرسِل والمستلِم والتاريخ ونصاً عادياً."""
    message = email.message_from_bytes(raw, policy=policy.default)
    body = ""
    try:
        part = message.get_body(preferencelist=("plain", "html"))
        if part is not None:
            content = part.get_content()
            if part.get_content_type() == "text/html":
                content = _strip_html(content)
            body = content
    except Exception:
        body = ""
    return {
        "message_id": str(message.get("Message-ID", "") or "")[:500],
        "subject": str(message.get("Subject", "") or ""),
        "sender": str(message.get("From", "") or ""),
        "recipient": str(message.get("To", "") or ""),
        "date": _parse_date(message.get("Date", "")),
        "body": (body or "").strip()[:BODY_MAX],
    }


def _batches(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def _match_project(subject: str, projects: list[tuple]) -> "Project | None":
    """أول مشروع يحمل موضوع الرسالة وسمه (مطابقة غير حساسة لحالة الأحرف)."""
    lower = subject.lower()
    for project, tag_lower in projects:
        if tag_lower and tag_lower in lower:
            return project
    return None


def _read_uidvalidity(box) -> int:
    try:
        _typ, data = box.response("UIDVALIDITY")
        if data and data[0]:
            return int(data[0])
    except Exception:
        pass
    return 0


def _sync_folder(box, user, folder: str, projects: list[tuple]) -> int:
    """مزامنة تزايدية لمجلد واحد على اتصال مفتوح — يعيد عدد الرسائل الجديدة."""
    if folder == EmailFolder.SENT:
        if not _select_sent(box):
            raise EmailFetchError("تعذر العثور على مجلد الصادر في خادم البريد.")
    else:
        box.select("INBOX", readonly=True)

    uidvalidity = _read_uidvalidity(box)
    state, _ = EmailSyncState.objects.get_or_create(user=user, folder=folder)
    if state.uidvalidity != uidvalidity:
        # صندوق أعيد بناؤه على الخادم (تغيّر UIDVALIDITY) — أعد المزامنة من الصفر
        EmailMessage.objects.filter(user=user, folder=folder).delete()
        state.uidvalidity = uidvalidity
        state.last_uid = 0

    if state.last_uid > 0:
        typ, data = box.uid("search", None, f"UID {state.last_uid + 1}:*")
        raw = data[0].split() if (typ == "OK" and data and data[0]) else []
        new_uids = [int(x) for x in raw if int(x) > state.last_uid]
    else:
        typ, data = box.uid("search", None, "ALL")
        raw = data[0].split() if (typ == "OK" and data and data[0]) else []
        new_uids = [int(x) for x in raw][-INITIAL_SYNC_LIMIT:]

    if not new_uids:
        state.last_synced_at = timezone.now()
        state.save()
        return 0

    stored = 0
    max_uid = state.last_uid
    for chunk in _batches(new_uids, FETCH_BATCH):
        id_range = ",".join(str(u) for u in chunk)
        typ, parts = box.uid("fetch", id_range, "(BODY.PEEK[])")
        if typ != "OK":
            continue
        objs = []
        for part in parts:
            if not isinstance(part, tuple):
                continue
            descr = part[0]
            descr = descr.decode(errors="ignore") if isinstance(descr, (bytes, bytearray)) else str(descr)
            match = re.search(r"UID (\d+)", descr)
            if not match:
                continue
            uid = int(match.group(1))
            fields = _extract(part[1])
            objs.append(EmailMessage(
                user=user, folder=folder, uidvalidity=uidvalidity, uid=uid,
                project=_match_project(fields["subject"], projects), **{
                    k: fields[k] for k in ("message_id", "subject", "sender", "recipient", "body", "date")
                },
            ))
            max_uid = max(max_uid, uid)
        if objs:
            EmailMessage.objects.bulk_create(objs, ignore_conflicts=True)
            stored += len(objs)

    state.last_uid = max_uid
    state.uidvalidity = uidvalidity
    state.last_synced_at = timezone.now()
    state.save()
    return stored


def sync_account(account, folders=(EmailFolder.RECEIVED, EmailFolder.SENT)) -> dict:
    """مزامنة صندوق المستخدم إلى قاعدة البيانات (وارد/صادر) على اتصال واحد.
    يعيد {folder: عدد الجديد} أو {folder: {"error": "..."}} لكل مجلد."""
    user = account.user
    projects = [
        (p, p.email_tag.strip().lower())
        for p in Project.objects.filter(deleted_at__isnull=True).exclude(email_tag="")
    ]
    box = _connect_imap(account)
    results: dict = {}
    try:
        for folder in folders:
            try:
                results[folder] = _sync_folder(box, user, folder, projects)
            except EmailFetchError as error:
                # فشل مجلد (كعدم وجود «الصادر») لا يُسقط الآخر
                results[folder] = {"error": str(error)}
    finally:
        try:
            box.logout()
        except Exception:
            pass
    return results
