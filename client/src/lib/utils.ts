import { clsx, type ClassValue } from 'clsx'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

const dateFormatter = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** تحويل HTML المحرر إلى نص عادي — يُستخدم في البحث الشامل. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} م.ب`
  return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`
}

export function isImageFile(fileName: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(fileName)
}
