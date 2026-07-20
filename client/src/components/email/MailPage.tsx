import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Inbox, Mail, RefreshCw, Search, Send, Settings, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProjects } from '../../hooks/useProjects'
import { api } from '../../lib/api'
import { cn, formatDate } from '../../lib/utils'
import type { EmailMessage, Project } from '../../types'
import { Modal } from '../ui/Modal'

type Folder = 'received' | 'sent'

/** يستخرج رسالة الخطأ العربية من نص خطأ الـ API (API 4xx: {"detail": "..."}) */
function errorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/"detail"\s*:\s*"([^"]+)"/)
  return match ? match[1] : 'تعذر جلب الرسائل — تحقق من إعدادات البريد.'
}

/** صفحة «البريد»: صندوق كل مستخدم المخزَّن في قاعدة البيانات — قراءة فورية،
 *  تبديل الوارد/الصادر، فرز حسب المشروع، وبحث في الموضوع والنص والمرسِل.
 *  «تحديث» يزامن الجديد من خادم البريد تزايدياً. */
export function MailPage() {
  const { data: projects = [] } = useProjects()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [folder, setFolder] = useState<Folder>('received')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  // رسالة مفتوحة في نافذة القراءة (من النقر أو من رابط البحث الشامل ?open=)
  const [openId, setOpenId] = useState<number | null>(() => {
    const raw = searchParams.get('open')
    return raw ? Number(raw) : null
  })

  // تأخير البحث قليلاً — الاستعلام يجري على الخادم فوق قاعدة البيانات
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const taggedProjects = useMemo(
    () => projects.filter((p) => p.email_tag.trim()),
    [projects],
  )

  const { data: messages = [], isFetching } = useQuery({
    queryKey: ['mailbox', folder, projectId, debounced],
    queryFn: () => api.email.mailbox({ folder, project: projectId, q: debounced }),
    staleTime: 30_000,
  })

  // المزامنة من خادم البريد — عند فتح الصفحة (مرة) وعند ضغط «تحديث»
  const sync = useMutation({
    mutationFn: (f?: Folder) => api.email.sync(f),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mailbox'] }),
  })
  useEffect(() => {
    sync.mutate(undefined)
    // مرة واحدة عند التحميل — المزامنة تزايدية (رخيصة بعد أول مرة)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const closeMessage = () => {
    setOpenId(null)
    if (searchParams.has('open')) {
      searchParams.delete('open')
      setSearchParams(searchParams, { replace: true })
    }
  }

  // شارة المشروع: من الخادم إن وُجدت، وإلا مطابقة محلية بالوسم (لوسوم عُيّنت لاحقاً)
  const projectOf = (m: EmailMessage): Project | undefined => {
    if (m.project) {
      const found = projects.find((p) => p.id === m.project)
      if (found) return found
    }
    const lower = m.subject.toLowerCase()
    return taggedProjects.find((p) => lower.includes(p.email_tag.trim().toLowerCase()))
  }

  const syncing = sync.isPending
  const syncFailed = sync.isError

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* الترويسة */}
      <div className="mb-4 flex items-center gap-2">
        <Mail size={20} className="text-blue-600" />
        <h1 className="text-xl font-bold text-slate-900">البريد</h1>
        {!isFetching && <span className="text-sm text-slate-400">({messages.length})</span>}
        <button
          onClick={() => sync.mutate(folder)}
          disabled={syncing}
          title="مزامنة الجديد من خادم البريد"
          className="ms-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
          {syncing ? 'جارٍ المزامنة…' : 'تحديث'}
        </button>
      </div>

      {/* أدوات التحكم: وارد/صادر + فرز بالمشروع + بحث */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <FolderTab active={folder === 'received'} onClick={() => setFolder('received')} icon={<Inbox size={15} />}>
            الوارد
          </FolderTab>
          <FolderTab active={folder === 'sent'} onClick={() => setFolder('sent')} icon={<Send size={15} />}>
            الصادر
          </FolderTab>
        </div>

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

        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الموضوع والنص والمرسِل…"
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

      {/* بانر خطأ المزامنة (كعدم ربط البريد) — لا يمنع عرض المخزَّن */}
      {syncFailed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{errorDetail(sync.error)}</span>
          <Link
            to="/email-settings"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-amber-300 hover:bg-amber-100"
          >
            <Settings size={13} />
            إعدادات البريد
          </Link>
        </div>
      )}

      {/* لا رسائل */}
      {messages.length === 0 && !isFetching && (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          {debounced
            ? 'لا رسائل مطابقة للبحث.'
            : projectId
              ? 'لا رسائل يحمل موضوعها وسم هذا المشروع في هذا المجلد.'
              : syncing
                ? 'جارٍ جلب الرسائل من خادم البريد…'
                : `لا رسائل مخزَّنة في ${folder === 'received' ? 'الوارد' : 'الصادر'} بعد.`}
        </p>
      )}

      {/* القائمة */}
      <div className="space-y-2">
        {messages.map((message) => (
          <MailRow
            key={message.id}
            message={message}
            folder={folder}
            project={projectOf(message)}
            onOpen={() => setOpenId(message.id)}
          />
        ))}
      </div>

      {openId != null && <MailMessageModal id={openId} onClose={closeMessage} />}
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

/** بطاقة رسالة قابلة للنقر لفتح نصّها الكامل */
function MailRow({
  message, folder, project, onOpen,
}: { message: EmailMessage; folder: Folder; project?: Project; onOpen: () => void }) {
  const party = folder === 'sent' ? message.to : message.sender
  return (
    <button
      onClick={onOpen}
      className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-start shadow-sm hover:border-blue-300 hover:bg-blue-50/30"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-800" dir="auto">
          {message.subject || '(بلا موضوع)'}
        </p>
        {project && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500"
            title={`المشروع: ${project.title}`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
            {project.title}
          </span>
        )}
      </div>
      {message.preview && (
        <p className="mt-0.5 truncate text-xs text-slate-400" dir="auto">{message.preview}</p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
        <span>{folder === 'sent' ? 'إلى' : 'من'}</span>
        <span dir="ltr" className="truncate text-slate-500">{party || '—'}</span>
        {message.date && <span className="ms-auto">{formatDate(message.date)}</span>}
      </div>
    </button>
  )
}

/** نافذة قراءة الرسالة — تجلب النص الكامل عند الفتح */
function MailMessageModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mailbox', 'message', id],
    queryFn: () => api.email.message(id),
    staleTime: 5 * 60_000,
  })

  return (
    <Modal title={data?.subject || 'رسالة'} onClose={onClose}>
      {isLoading && <p className="py-6 text-center text-sm text-slate-400">جارٍ فتح الرسالة…</p>}
      {isError && <p className="py-6 text-center text-sm text-red-500">تعذر فتح الرسالة.</p>}
      {data && (
        <div>
          <div className="mb-3 space-y-1 border-b border-slate-100 pb-3 text-xs text-slate-500">
            <div className="flex gap-2">
              <span className="shrink-0 text-slate-400">من:</span>
              <span dir="ltr" className="break-all">{data.sender || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 text-slate-400">إلى:</span>
              <span dir="ltr" className="break-all">{data.to || '—'}</span>
            </div>
            {data.date && (
              <div className="flex gap-2">
                <span className="shrink-0 text-slate-400">التاريخ:</span>
                <span>{formatDate(data.date)}</span>
              </div>
            )}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700" dir="auto">
            {data.body?.trim() || '(لا نص)'}
          </p>
        </div>
      )}
    </Modal>
  )
}
