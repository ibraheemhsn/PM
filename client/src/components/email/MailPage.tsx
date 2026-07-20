import { useQuery } from '@tanstack/react-query'
import {
  Inbox, Mail, RefreshCw, Search, Send, Settings, X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjects } from '../../hooks/useProjects'
import { api } from '../../lib/api'
import { cn, formatDate } from '../../lib/utils'
import type { EmailMessage, Project } from '../../types'

type Folder = 'received' | 'sent'

/** يستخرج رسالة الخطأ العربية من نص خطأ الـ API (API 4xx: {"detail": "..."}) */
function errorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/"detail"\s*:\s*"([^"]+)"/)
  return match ? match[1] : 'تعذر جلب الرسائل — تحقق من إعدادات البريد.'
}

/** صفحة «البريد»: صندوق موحّد لرسائل المستخدم — تبديل الوارد/الصادر،
 *  فرز حسب المشروع (وسمه في الموضوع)، وبحث فوري في الموضوع والمرسِل/المستلِم.
 *  كل رسالة يحمل موضوعها وسم مشروع تظهر عليها شارة ذلك المشروع. */
export function MailPage() {
  const { data: projects = [] } = useProjects()
  const [folder, setFolder] = useState<Folder>('received')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  // المشاريع القابلة للفرز = التي عُيّن لها وسم بريد
  const taggedProjects = useMemo(
    () => projects.filter((p) => p.email_tag.trim()),
    [projects],
  )

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['mailbox', folder, projectId],
    queryFn: () => api.email.mailbox({ folder, project: projectId }),
    staleTime: 60_000,
    retry: false, // فشل الاتصال بخادم البريد لا يستفيد من الإعادة التلقائية
  })

  const messages = data?.messages ?? []

  // البحث الفوري محلياً على الرسائل المحمَّلة — بلا طلب شبكة لكل حرف
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return messages
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.sender.toLowerCase().includes(q) ||
        (m.to ?? '').toLowerCase().includes(q),
    )
  }, [messages, search])

  // ربط كل رسالة بمشروعها عبر وجود وسمه في الموضوع
  const projectOfSubject = (subject: string): Project | undefined => {
    const lower = subject.toLowerCase()
    return taggedProjects.find((p) => lower.includes(p.email_tag.trim().toLowerCase()))
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* الترويسة */}
      <div className="mb-4 flex items-center gap-2">
        <Mail size={20} className="text-blue-600" />
        <h1 className="text-xl font-bold text-slate-900">البريد</h1>
        {data && <span className="text-sm text-slate-400">({visible.length})</span>}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="تحديث من خادم البريد"
          className="ms-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />
          تحديث
        </button>
      </div>

      {/* أدوات التحكم: وارد/صادر + فرز بالمشروع + بحث */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* تبديل المجلد */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <FolderTab active={folder === 'received'} onClick={() => setFolder('received')} icon={<Inbox size={15} />}>
            الوارد
          </FolderTab>
          <FolderTab active={folder === 'sent'} onClick={() => setFolder('sent')} icon={<Send size={15} />}>
            الصادر
          </FolderTab>
        </div>

        {/* فرز حسب المشروع */}
        <select
          value={projectId ?? ''}
          onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
        >
          <option value="">كل المشاريع</option>
          {taggedProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        {/* بحث فوري */}
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الموضوع والمرسِل…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pe-9 ps-9 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 end-2 my-auto rounded p-0.5 text-slate-400 hover:text-slate-600"
              aria-label="مسح البحث"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* الحالات */}
      {isFetching && !data && (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          جارٍ جلب الرسائل من خادم البريد…
        </p>
      )}

      {isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{errorDetail(error)}</span>
          <Link
            to="/email-settings"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-amber-300 hover:bg-amber-100"
          >
            <Settings size={13} />
            إعدادات البريد
          </Link>
        </div>
      )}

      {data && visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          {search.trim()
            ? 'لا رسائل مطابقة للبحث.'
            : projectId
              ? 'لا رسائل يحمل موضوعها وسم هذا المشروع في هذا المجلد.'
              : `لا رسائل في ${folder === 'received' ? 'الوارد' : 'الصادر'}.`}
        </p>
      )}

      {/* قائمة الرسائل */}
      <div className="space-y-2">
        {visible.map((message) => (
          <MailRow
            key={`${message.folder ?? folder}-${message.id}`}
            message={message}
            folder={folder}
            project={projectOfSubject(message.subject)}
          />
        ))}
      </div>
    </div>
  )
}

function FolderTab({
  active, onClick, icon, children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

/** بطاقة رسالة — الموضوع، والطرف الآخر (المرسِل في الوارد/المستلِم في الصادر)،
 *  والتاريخ، وشارة المشروع إن حمل الموضوع وسمه */
function MailRow({
  message, folder, project,
}: { message: EmailMessage; folder: Folder; project?: Project }) {
  const party = folder === 'sent' ? message.to : message.sender
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-800" dir="auto">
          {message.subject || '(بلا موضوع)'}
        </p>
        {project && (
          <Link
            to={`/projects/${project.id}`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-blue-50 hover:text-blue-600"
            title={`المشروع: ${project.title}`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
            {project.title}
          </Link>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
        <span className="text-slate-400">{folder === 'sent' ? 'إلى' : 'من'}</span>
        <span dir="ltr" className="truncate text-slate-500">{party || '—'}</span>
        {message.date && <span className="ms-auto">{formatDate(message.date)}</span>}
      </div>
    </div>
  )
}
