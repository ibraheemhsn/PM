"""توليد مصغّرات للصور المرفوعة — القوائم تعرض المصغّرة بدل الملف الأصلي
(الذي قد يبلغ عدة ميغابايت) فيبقى التمرير سلساً، والأصل يُفتح في العارض فقط."""
import io
from pathlib import Path

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}

ATTACHMENT_THUMB_SIZE = (400, 400)
AVATAR_THUMB_SIZE = (128, 128)


def is_image_name(name: str) -> bool:
    return Path(name).suffix.lower() in IMAGE_EXTENSIONS


def make_thumbnail(django_file, max_size) -> ContentFile | None:
    """مصغّرة JPEG بحد أقصى max_size مع احترام اتجاه EXIF — None عند أي فشل
    (ملف تالف أو ليس صورة): يتعامل معه المستدعي بالإبقاء على الأصل."""
    try:
        with Image.open(django_file) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail(max_size, Image.LANCZOS)
            if image.mode != "RGB":
                image = image.convert("RGB")
            buffer = io.BytesIO()
            image.save(buffer, "JPEG", quality=80, optimize=True)
            return ContentFile(buffer.getvalue())
    except Exception:
        return None


def thumb_name(original_name: str) -> str:
    return f"{Path(original_name).stem}_thumb.jpg"
