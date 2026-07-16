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

/** تخطيط لوحة المفاتيح: الحرف اللاتيني ← الحرف العربي على نفس المفتاح.
 *  يُستخدم في البحث الذكي: من يكتب «fdzm» ولوحته على الإنجليزية يقصد «بيئة». */
const KEYBOARD_AR: Record<string, string> = {
  q: 'ض', w: 'ص', e: 'ث', r: 'ق', t: 'ف', y: 'غ', u: 'ع', i: 'ه', o: 'خ', p: 'ح',
  '[': 'ج', ']': 'د',
  a: 'ش', s: 'س', d: 'ي', f: 'ب', g: 'ل', h: 'ا', j: 'ت', k: 'ن', l: 'م',
  ';': 'ك', "'": 'ط',
  z: 'ئ', x: 'ء', c: 'ؤ', v: 'ر', b: 'لا', n: 'ى', m: 'ة',
  ',': 'و', '.': 'ز', '/': 'ظ', '`': 'ذ',
}

const KEYBOARD_EN: Record<string, string> = Object.fromEntries(
  Object.entries(KEYBOARD_AR).map(([latin, arabic]) => [arabic, latin]),
)

/** ما كُتب بحروف لاتينية → ما يقابله على اللوحة العربية (fdzm → بيئة) */
export function latinToArabicKeys(text: string): string {
  return [...text.toLowerCase()].map((ch) => KEYBOARD_AR[ch] ?? ch).join('')
}

/** ما كُتب بحروف عربية → ما يقابله على اللوحة اللاتينية (يبلي → dfgd) */
export function arabicToLatinKeys(text: string): string {
  // «لا» حرفان على مفتاح واحد (b) — تُستبدل أولاً قبل التحويل حرفاً بحرف
  return [...text.replace(/لا/g, 'b')].map((ch) => KEYBOARD_EN[ch] ?? ch).join('')
}

/** تطبيع رابط خارجي أدخله المستخدم:
 *  - رابط بمخطط كامل (https: / file: …) يمر كما هو
 *  - مسار شبكة ‎\\server\share يتحول إلى file:
 *  - «example.com/folder» بلا مخطط يُسبق بـ https:// كي لا يُعامل كمسار داخلي */
export function externalHref(link: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return link
  if (link.startsWith('\\\\')) return `file:${link.replace(/\\/g, '/')}`
  return `https://${link}`
}
