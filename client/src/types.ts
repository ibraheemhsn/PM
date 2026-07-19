/** الأنواع المشتركة — تطابق حقول DRF serializers (snake_case). */

export type TaskStatus = 'SUGGESTED' | 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'REVIEW' | 'DONE'

export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export type TaskRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface UserBrief {
  id: number
  username: string
  first_name: string
  /** مفتاح أيقونة جاهزة من AVATAR_OPTIONS */
  avatar: string | null
  /** صورة مرفوعة — لها الأولوية في العرض على الأيقونة */
  photo: string | null
  /** مصغّرة الصورة (تولَّد تلقائياً) — القوائم تعرضها بدل الأصل الكبير */
  photo_thumb: string | null
}

export interface User extends UserBrief {
  is_manager: boolean
  /** ترتيب المشاريع المخصص لهذا المستخدم (معرفات بالترتيب المفضل) —
   *  يخص واجهته فقط، والمشاريع غير المذكورة تلحق بالترتيب الافتراضي */
  project_order: number[]
}

export interface Project {
  id: number
  title: string
  color: string
  details: string
  /** رابط مشاركة ملفات المشروع — أيقونة الفولدر بجانب العنوان */
  share_link: string
  /** ملف Google Docs للكتب الصادرة */
  outgoing_link: string
  /** ملف Google Sheets لحسابات المشروع والأسعار */
  accounts_link: string
  /** مجلد Google Drive لصور الكتب الواردة */
  incoming_link: string
  /** محادثة الذكاء الاصطناعي الخاصة بالمشروع (ChatGPT/Claude/Gemini…) */
  ai_link: string
  /** تعديل مقترح بانتظار مراجعة المدير — النسخة المعتمدة في details لا تتغير إلا بالاعتماد */
  pending_details: string
  has_pending_details: boolean
  pending_details_by: UserBrief | null
  pending_details_at: string | null
  /** غير فارغ = المشروع مؤرشف (خارج القوائم اليومية مع بقاء سجله) */
  archived_at: string | null
  /** غير فارغ = المشروع في سلة المحذوفات */
  deleted_at: string | null
  tasks_count: number
  /** يوجد جديد لم يقرأه المستخدم (مهمة/تعليق/تحديث) — نقطة حمراء في الشريط الجانبي */
  has_unread: boolean
  created_at: string
  updated_at: string
}

/** طبّق ترتيب المستخدم المخصص على قائمة مشاريع: المذكورة في الترتيب أولاً
 *  بترتيبها، وغير المذكورة (الجديدة مثلاً) تلحق بترتيبها الافتراضي */
export function orderProjects<T extends { id: number }>(projects: T[], order: number[]): T[] {
  if (order.length === 0) return projects
  const rank = new Map(order.map((id, index) => [id, index]))
  return [...projects].sort((a, b) => {
    const rankA = rank.get(a.id)
    const rankB = rank.get(b.id)
    if (rankA === undefined && rankB === undefined) return 0
    if (rankA === undefined) return 1
    if (rankB === undefined) return -1
    return rankA - rankB
  })
}

export interface Task {
  id: number
  project: number
  project_title: string
  project_color: string
  /** مشروع المهمة مؤرشف — تُستبعد من القوائم العامة */
  project_archived: boolean
  title: string
  status: TaskStatus
  priority: TaskPriority
  /** تاريخ الاستحقاق (YYYY-MM-DD) — غير المنجزة بعده تُعد متأخرة */
  due_date: string | null
  /** عند إنجاز المتكررة تُنشأ دورتها التالية تلقائياً */
  recurrence: TaskRecurrence
  color: string
  tags: string[]
  assignees: UserBrief[]
  comments_count: number
  /** توجد تعليقات من الآخرين لم يقرأها المستخدم الحالي */
  has_unread_comments: boolean
  /** لم يطّلع المستخدم الحالي على المهمة بعد — تُميَّز بخلفية صفراء */
  is_unread: boolean
  /** غير فارغ = المهمة في سلة المحذوفات */
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskComment {
  id: number
  author: UserBrief | null // null إذا حُذف حساب الكاتب
  body: string
  /** أحدث من آخر اطلاع للمستخدم وليس من كتابته — يُميَّز بخلفية صفراء */
  is_unread: boolean
  created_at: string
}

/** مرفق مختصر معروض تحت تحديث المشروع */
export interface UpdateAttachment {
  id: number
  file: string
  file_name: string
  /** مصغّرة للصور — تُعرض في القوائم والأصل يُفتح في العارض */
  thumbnail: string | null
  size: number
}

/** تحديث/حدث على المشروع (توقيع عقد، إرسال كتاب…) — الأحدث في أسفل القائمة */
export interface ProjectUpdate {
  id: number
  project: number
  project_title: string
  project_color: string
  /** مشروع التحديث مؤرشف — يُستبعد من الخلاصة الموحدة */
  project_archived: boolean
  author: UserBrief | null
  body: string
  /** مرفقات مرتبطة بهذا التحديث — تظهر في قسم المرفقات أيضاً */
  attachments: UpdateAttachment[]
  /** أحدث من آخر اطلاع للمستخدم على تحديثات المشروع وليس من كتابته */
  is_unread: boolean
  /** غير فارغ = التحديث في سلة المحذوفات */
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/** تصنيفات المرفقات — أساس الفلترة السريعة في أقسام المرفقات */
export type AttachmentCategory =
  | 'OUTGOING'
  | 'INCOMING'
  | 'ACCOUNTS'
  | 'OFFER'
  | 'QUOTATION'
  | 'DATASHEET'
  | 'MANUAL'

export const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  OUTGOING: 'صادر',
  INCOMING: 'وارد',
  ACCOUNTS: 'حسابات',
  OFFER: 'عرض',
  QUOTATION: 'Quotation',
  DATASHEET: 'Datasheet',
  MANUAL: 'Manual',
}

export const ATTACHMENT_CATEGORIES = Object.keys(
  ATTACHMENT_CATEGORY_LABELS,
) as AttachmentCategory[]

/** مرفق مشروع: صورة أو PDF أو ملف نصي */
export interface Attachment {
  id: number
  project: number
  project_title: string
  project_color: string
  /** رابط الملف */
  file: string
  file_name: string
  /** مصغّرة للصور — تُعرض في القوائم والأصل يُفتح في العارض */
  thumbnail: string | null
  description: string
  /** التصنيف — فارغ إذا لم يُحدد */
  category: AttachmentCategory | ''
  uploaded_by: UserBrief | null
  /** الحجم بالبايت */
  size: number
  created_at: string
}

export interface Tag {
  id: number
  name: string
}

/** حدث في سجل النشاطات: من فعل ماذا وفي أي مشروع ومتى */
export interface ActivityEntry {
  id: number
  project: number
  project_title: string
  project_color: string
  actor: UserBrief | null
  message: string
  created_at: string
}

/** إشعار داخل التطبيق — يُعرض في جرس الشريط الجانبي وكإشعار متصفح مع صوت */
export interface AppNotification {
  id: number
  kind:
    | 'TASK_ASSIGNED'
    | 'TASK_STATUS'
    | 'TASK_SUGGESTED'
    | 'NEW_COMMENT'
    | 'MENTION'
    | 'DUE_SOON'
    | 'DETAILS_PROPOSED'
    | 'PROJECT_UPDATE'
  message: string
  actor: UserBrief | null
  task: number | null
  project: number | null
  is_read: boolean
  created_at: string
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  SUGGESTED: 'مقترحة',
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'قيد الإنجاز',
  ON_HOLD: 'قيد الانتظار',
  REVIEW: 'قيد المراجعة',
  DONE: 'منجزة',
}

export const TASK_STATUSES = Object.keys(STATUS_LABELS) as TaskStatus[]

/** آلة حالات الموظف: التنقل بالاتجاهين حصراً بين هذه الحالات الأربع —
 *  «مقترحة» يعتمدها المدير و«منجزة» يغلقها المدير (القيود مفروضة على الخادم أيضاً) */
export const EMPLOYEE_STATUS_FLOW: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'REVIEW']

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  HIGH: 'عالية',
  MEDIUM: 'متوسطة',
  LOW: 'منخفضة',
}

/** ألوان علم الأولوية */
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#94a3b8',
}

export const TASK_PRIORITIES = Object.keys(PRIORITY_LABELS) as TaskPriority[]

/** ترتيب الأولوية للفرز — الأعلى أولاً */
export const PRIORITY_RANK: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }

export const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  NONE: 'بلا تكرار',
  DAILY: 'يومياً',
  WEEKLY: 'أسبوعياً',
  MONTHLY: 'شهرياً',
}

export const TASK_RECURRENCES = Object.keys(RECURRENCE_LABELS) as TaskRecurrence[]

/** المهمة متأخرة: لها استحقاق مضى ولم تُنجز (مقارنة نصية لصيغة ISO تكفي) */
export const isTaskOverdue = (task: Task): boolean =>
  !!task.due_date &&
  task.status !== 'DONE' &&
  task.due_date < new Date().toISOString().slice(0, 10)

export const displayName = (user: UserBrief) => user.first_name || user.username

/** لوحة الألوان الجاهزة للمشاريع والمهام */
export const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
]

/** الأيقونات الجاهزة للموظفين — يُخزَّن المفتاح في حقل avatar */
export interface AvatarOption {
  key: string
  emoji: string
  bg: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { key: 'builder', emoji: '👷', bg: '#f59e0b' },
  { key: 'tech', emoji: '🧑‍🔧', bg: '#3b82f6' },
  { key: 'tech-f', emoji: '👩‍🔧', bg: '#14b8a6' },
  { key: 'dev', emoji: '🧑‍💻', bg: '#8b5cf6' },
  { key: 'dev-f', emoji: '👩‍💻', bg: '#ec4899' },
  { key: 'office', emoji: '🧑‍💼', bg: '#0ea5e9' },
  { key: 'office-f', emoji: '👩‍💼', bg: '#f43f5e' },
  { key: 'factory', emoji: '🧑‍🏭', bg: '#f97316' },
  { key: 'scientist', emoji: '🧑‍🔬', bg: '#22c55e' },
  { key: 'artist', emoji: '🧑‍🎨', bg: '#a855f7' },
]

export const AVATAR_MAP: Record<string, AvatarOption> = Object.fromEntries(
  AVATAR_OPTIONS.map((option) => [option.key, option]),
)
