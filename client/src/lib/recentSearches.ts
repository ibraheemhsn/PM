/** سجل «عمليات البحث الأخيرة» للبحث الشامل (Ctrl+K).
 *
 *  التخزين في localStorage بمفتاح خاص بكل مستخدم:
 *  - أداء لحظي: صفر طلبات شبكة عند فتح النافذة أو التعديل.
 *  - خصوصية: سجل البحث لا يغادر جهاز المستخدم إطلاقاً.
 *  - فقدانه عند تغيير الجهاز غير مؤذٍ — مجرد تسهيل وصول، لا بيانات عمل. */
import type { TaskStatus } from '../types'

/** نتيجة محفوظة — نفس حقول نتيجة البحث الضرورية لإعادة عرضها وفتحها */
export interface RecentSearchItem {
  type: 'project' | 'task' | 'attachment' | 'comment' | 'update'
  key: string
  title: string
  subtitle: string
  color: string
  to: string
  status?: TaskStatus
  href?: string
}

const MAX_ITEMS = 8

const storageKey = (userId: number) => `pm-recent-searches:${userId}`

export function loadRecentSearches(userId: number): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    const parsed = raw ? (JSON.parse(raw) as RecentSearchItem[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(userId: number, items: RecentSearchItem[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(items))
  } catch {
    // مساحة التخزين ممتلئة أو معطلة — السجل ميزة تحسينية فلا نفشل
  }
}

/** أدرج نتيجة مفتوحة في مقدمة السجل — بلا تكرار وبحد أقصى ثابت */
export function addRecentSearch(userId: number, item: RecentSearchItem): RecentSearchItem[] {
  const items = [item, ...loadRecentSearches(userId).filter((r) => r.key !== item.key)]
    .slice(0, MAX_ITEMS)
  persist(userId, items)
  return items
}

export function removeRecentSearch(userId: number, key: string): RecentSearchItem[] {
  const items = loadRecentSearches(userId).filter((r) => r.key !== key)
  persist(userId, items)
  return items
}
