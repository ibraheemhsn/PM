/** عميل HTTP مركزي وموحَّد الأنواع لواجهة Django REST.
 *  - مسارات Django تنتهي بشرطة مائلة إلزامية.
 *  - المصادقة عبر جلسات Django: نرفق ترويسة X-CSRFToken من الكعكة
 *    (تُزرع عند نداء /auth/me/ أول مرة) مع كل طلب غير GET. */
import type {
  ActivityEntry, AppNotification, Attachment, EmailMessage, EmailSettings,
  GlobalSearchResults, Project, ProjectUpdate, Tag, Task, TaskComment,
  TaskPriority, TaskRecurrence, TaskStatus, User, UserBrief,
} from '../types'

export interface ProjectInput {
  title: string
  color: string
  details?: string
  /** رابط مشاركة ملفات المشروع */
  share_link?: string
  /** ملف Google Docs للكتب الصادرة */
  outgoing_link?: string
  /** ملف Google Sheets لحسابات المشروع والأسعار */
  accounts_link?: string
  /** مجلد Google Drive لصور الكتب الواردة */
  incoming_link?: string
  /** محادثة الذكاء الاصطناعي الخاصة بالمشروع */
  ai_link?: string
  /** وسم المشروع — يُدرج في موضوع الإيميلات المرتبطة */
  email_tag?: string
}

/** إعدادات البريد المرسلة للحفظ — كلمة المرور اختيارية عند التعديل،
 *  وطريقة الربط يحددها الخادم (الحفظ اليدوي = PASSWORD دائماً) */
export interface EmailSettingsInput extends Omit<EmailSettings, 'updated_at' | 'auth_method'> {
  password?: string
}

export interface TaskInput {
  project: number
  title: string
  status: TaskStatus
  priority: TaskPriority
  /** null لمسح تاريخ الاستحقاق */
  due_date: string | null
  recurrence: TaskRecurrence
  color: string
  tags: string[]
  assignees: number[]
}

export interface Credentials {
  username: string
  password: string
}

export interface UserInput {
  username: string
  first_name: string
  /** الدور: مدير (true) أو موظف (false) */
  is_manager?: boolean
  /** اختيارية عند التعديل — تبقى الحالية إن لم تُرسل */
  password?: string
  /** مفتاح أيقونة جاهزة من AVATAR_OPTIONS */
  avatar: string
  /** null لمسح الصورة المرفوعة عند اختيار أيقونة — الرفع نفسه يتم عبر FormData */
  photo?: null
}

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if ((options.method ?? 'GET') !== 'GET') headers['X-CSRFToken'] = getCookie('pm_csrftoken')
  // مع FormData يضبط المتصفح الترويسة (مع boundary) بنفسه
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`/api${path}`, { ...options, headers })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  auth: {
    me: () => request<{ user: User | null }>('/auth/me/'),
    login: (credentials: Credentials) =>
      request<{ user: User }>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    logout: () => request<void>('/auth/logout/', { method: 'POST' }),
    /** حفظ ترتيب المشاريع المخصص للمستخدم الحالي */
    saveProjectOrder: (order: number[]) =>
      request<{ project_order: number[] }>('/me/project_order/', {
        method: 'PUT',
        body: JSON.stringify({ order }),
      }),
  },
  users: {
    list: () => request<User[]>('/users/'),
    /** كل المستخدمين النشطين — لإكمال المنشن (@) في التعليقات، متاحة للجميع */
    mentionable: () => request<UserBrief[]>('/users/mentionable/'),
    // FormData عند رفع صورة، وJSON عند اختيار أيقونة جاهزة
    create: (data: UserInput | FormData) =>
      request<User>('/users/', {
        method: 'POST',
        body: data instanceof FormData ? data : JSON.stringify(data),
      }),
    update: (id: number, data: Partial<UserInput> | FormData) =>
      request<User>(`/users/${id}/`, {
        method: 'PATCH',
        body: data instanceof FormData ? data : JSON.stringify(data),
      }),
    remove: (id: number) => request<void>(`/users/${id}/`, { method: 'DELETE' }),
  },
  projects: {
    list: () => request<Project[]>('/projects/'),
    create: (data: ProjectInput) =>
      request<Project>('/projects/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ProjectInput>) =>
      request<Project>(`/projects/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    /** حذف ناعم — ينقل المشروع إلى سلة المحذوفات */
    remove: (id: number) => request<void>(`/projects/${id}/`, { method: 'DELETE' }),
    trashList: () => request<Project[]>('/projects/?trashed=1'),
    restore: (id: number) => request<Project>(`/projects/${id}/restore/`, { method: 'POST' }),
    /** الأرشيف: مشاريع منتهية خارج القوائم اليومية مع بقاء سجلها */
    archivedList: () => request<Project[]>('/projects/?archived=1'),
    archive: (id: number) => request<Project>(`/projects/${id}/archive/`, { method: 'POST' }),
    unarchive: (id: number) =>
      request<Project>(`/projects/${id}/unarchive/`, { method: 'POST' }),
    /** حذف نهائي لا رجعة فيه */
    purge: (id: number) => request<void>(`/projects/${id}/purge/`, { method: 'DELETE' }),
    // سير مراجعة التفاصيل الفنية: اقتراح (موظف) ← اعتماد أو تراجع (مدير)
    proposeDetails: (id: number, details: string) =>
      request<Project>(`/projects/${id}/propose_details/`, {
        method: 'POST',
        body: JSON.stringify({ details }),
      }),
    approveDetails: (id: number) =>
      request<Project>(`/projects/${id}/approve_details/`, { method: 'POST' }),
    rejectDetails: (id: number) =>
      request<Project>(`/projects/${id}/reject_details/`, { method: 'POST' }),
  },
  tasks: {
    list: () => request<Task[]>('/tasks/'),
    create: (data: TaskInput) =>
      request<Task>('/tasks/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<TaskInput>) =>
      request<Task>(`/tasks/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    /** حذف ناعم — ينقل المهمة إلى سلة المحذوفات */
    remove: (id: number) => request<void>(`/tasks/${id}/`, { method: 'DELETE' }),
    trashList: () => request<Task[]>('/tasks/?trashed=1'),
    restore: (id: number) => request<Task>(`/tasks/${id}/restore/`, { method: 'POST' }),
    /** حذف نهائي لا رجعة فيه */
    purge: (id: number) => request<void>(`/tasks/${id}/purge/`, { method: 'DELETE' }),
    /** تعليم مهام كمقروءة بعد عرضها أمام المستخدم */
    markSeen: (ids: number[]) =>
      request<void>('/tasks/mark_seen/', { method: 'POST', body: JSON.stringify({ ids }) }),
    comments: (taskId: number) => request<TaskComment[]>(`/tasks/${taskId}/comments/`),
    addComment: (taskId: number, body: string) =>
      request<TaskComment>(`/tasks/${taskId}/comments/`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    /** حذف تعليق — للمدير فقط */
    deleteComment: (taskId: number, commentId: number) =>
      request<void>(`/tasks/${taskId}/comments/${commentId}/`, { method: 'DELETE' }),
  },
  attachments: {
    /** كل المرفقات عبر جميع المشاريع — لصفحة «كل المرفقات» */
    listAll: () => request<Attachment[]>('/attachments/'),
    list: (projectId: number) => request<Attachment[]>(`/attachments/?project=${projectId}`),
    create: (
      projectId: number,
      file: File,
      description: string,
      category: string,
      /** ربط اختياري بتحديث أو مهمة — يظهر تحتهما وفي قسم المرفقات معاً */
      link?: { updateId?: number; taskId?: number },
    ) => {
      const data = new FormData()
      data.append('project', String(projectId))
      data.append('file', file)
      data.append('description', description)
      data.append('category', category)
      if (link?.updateId) data.append('update', String(link.updateId))
      if (link?.taskId) data.append('task', String(link.taskId))
      return request<Attachment>('/attachments/', { method: 'POST', body: data })
    },
    update: (id: number, data: { description?: string; category?: string }) =>
      request<Attachment>(`/attachments/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: number) => request<void>(`/attachments/${id}/`, { method: 'DELETE' }),
  },
  uploads: {
    /** رفع صورة تُدرج داخل محرر التفاصيل الفنية */
    image: (file: File) => {
      const data = new FormData()
      data.append('image', file)
      return request<{ url: string }>('/uploads/images/', { method: 'POST', body: data })
    },
  },
  updates: {
    /** كل التحديثات عبر جميع المشاريع — للخلاصة الموحدة */
    listAll: () => request<ProjectUpdate[]>('/updates/'),
    list: (projectId: number) => request<ProjectUpdate[]>(`/updates/?project=${projectId}`),
    create: (data: { project: number; body: string }) =>
      request<ProjectUpdate>('/updates/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, body: string) =>
      request<ProjectUpdate>(`/updates/${id}/`, { method: 'PATCH', body: JSON.stringify({ body }) }),
    /** حذف ناعم — ينقل التحديث إلى سلة المحذوفات */
    remove: (id: number) => request<void>(`/updates/${id}/`, { method: 'DELETE' }),
    trashList: () => request<ProjectUpdate[]>('/updates/?trashed=1'),
    restore: (id: number) =>
      request<ProjectUpdate>(`/updates/${id}/restore/`, { method: 'POST' }),
    /** حذف نهائي لا رجعة فيه */
    purge: (id: number) => request<void>(`/updates/${id}/purge/`, { method: 'DELETE' }),
  },
  tags: {
    list: () => request<Tag[]>('/tags/'),
  },
  search: {
    /** البحث الشامل من الخادم — المستخدَم منه في اللوحة: التعليقات والتحديثات
     *  (نصوصها غير مخزّنة محلياً)، والباقي يُبحث محلياً فورياً */
    global: (query: string) =>
      request<GlobalSearchResults>(`/search/?q=${encodeURIComponent(query)}`),
  },
  activity: {
    /** سجل النشاطات عبر كل المشاريع: آخر 300 حدث، الأحدث أولاً */
    listAll: () => request<ActivityEntry[]>('/activity/?limit=300'),
  },
  push: {
    /** المفتاح العام (VAPID) للاشتراك في خدمة الدفع */
    key: () => request<{ public_key: string }>('/push/key/'),
    subscribe: (subscription: unknown) =>
      request<void>('/push/subscribe/', {
        method: 'POST',
        body: JSON.stringify(subscription),
      }),
  },
  email: {
    /** إعدادات بريد المستخدم الحالي — كلمة المرور لا تُعاد أبداً */
    settings: () =>
      request<{
        configured: boolean
        /** «تسجيل الدخول عبر Google» مفعّل على الخادم؟ */
        google_available: boolean
        settings: EmailSettings | null
      }>('/email/settings/'),
    saveSettings: (data: EmailSettingsInput) =>
      request<{ configured: boolean; settings: EmailSettings }>('/email/settings/', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    /** فصل الحساب المرتبط (يلغي توكن Google ويحذف الإعدادات) */
    disconnect: () =>
      request<void>('/email/oauth/disconnect/', { method: 'POST', body: '{}' }),
    /** اختبار المصادقة على IMAP وSMTP بالإعدادات المحفوظة */
    test: () =>
      request<{ imap_ok: boolean; imap_error: string; smtp_ok: boolean; smtp_error: string }>(
        '/email/test/',
        { method: 'POST', body: '{}' },
      ),
    /** رسائل الوارد التي يحمل موضوعها وسم المشروع */
    forProject: (projectId: number) =>
      request<{ tag: string; messages: EmailMessage[] }>(`/emails/?project=${projectId}`),
    /** صندوق البريد الموحّد لصفحة «البريد»: الوارد/الصادر مع ترشيح
     *  اختياري بمشروع (وسمه) وبحث نصي على الخادم */
    mailbox: (params: { folder: 'received' | 'sent'; project?: number | null; q?: string }) => {
      const qs = new URLSearchParams({ folder: params.folder })
      if (params.project) qs.set('project', String(params.project))
      if (params.q?.trim()) qs.set('q', params.q.trim())
      return request<{ folder: string; tag: string; messages: EmailMessage[] }>(`/mailbox/?${qs}`)
    },
  },
  notifications: {
    /** بدون limit: آخر 30 (فحص الجرس الدوري)؛ ومع limit: لصفحة الإشعارات الكاملة */
    list: (limit?: number) =>
      request<AppNotification[]>(`/notifications/${limit ? `?limit=${limit}` : ''}`),
    /** بدون ids: يعلّم الكل كمقروء */
    markRead: (ids?: number[]) =>
      request<void>('/notifications/mark_read/', {
        method: 'POST',
        body: JSON.stringify(ids ? { ids } : {}),
      }),
  },
}
