import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Forward, Inbox, Mail, RefreshCw, Reply, ReplyAll, Search, Send, Settings, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
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

type ComposeMode = 'reply' | 'replyAll' | 'forward'

/** نافذة قراءة الرسالة — لوح كبير يغطي منطقة المحتوى (بعرض القوائم خلفه وبكامل
 *  الارتفاع)، مع تفاصيل ثابتة إنجليزية (From/To/Subject) وشريط رد أسفله. */
function MailMessageModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mailbox', 'message', id],
    queryFn: () => api.email.message(id),
    staleTime: 5 * 60_000,
  })
  const [mode, setMode] = useState<ComposeMode | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    // خلفية معتمة تغطي منطقة المحتوى (بعد الشريط الجانبي على الحاسوب)،
    // واللوح بداخلها بعرض الكروت (max-w-4xl) وبكامل الارتفاع
    <div
      className="fixed inset-0 z-50 flex justify-center bg-slate-900/40 lg:start-72"
      onMouseDown={onClose}
    >
    <div
      className="flex h-full w-full max-w-4xl flex-col bg-white text-slate-800 shadow-2xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* الترويسة */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="إغلاق"
        >
          <X size={20} />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-800" dir="auto">
          {data?.subject || 'Message'}
        </h2>
      </div>

      {/* التفاصيل + النص (متمرر) — يُخفى أثناء كتابة الرد ليأخذ المحرر
          كامل ارتفاع اللوح (النص الأصلي مقتبس داخل المحرر أصلاً) */}
      {!mode && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {isLoading && <p className="py-10 text-center text-sm text-slate-400">جارٍ فتح الرسالة…</p>}
          {isError && <p className="py-10 text-center text-sm text-red-500">تعذر فتح الرسالة.</p>}
          {data && (
            <div>
              <div className="mb-4 space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-xs">
                <MetaField label="From" value={data.sender} />
                <MetaField label="To" value={data.to} />
                <MetaField label="Subject" value={data.subject} />
                {data.date && <MetaField label="Date" value={formatDate(data.date)} />}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700" dir="auto">
                {data.body?.trim() || '(no content)'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* محرر الرد بكامل الارتفاع — أو شريط أزرار الرد أسفل الرسالة */}
      {data && mode && (
        <div className="min-h-0 flex-1 border-t border-slate-200 bg-slate-50">
          <ReplyComposer
            message={data}
            mode={mode}
            onCancel={() => setMode(null)}
            onSent={() => setMode(null)}
          />
        </div>
      )}
      {data && !mode && (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50">
          <div className="flex flex-wrap gap-2 px-4 py-3 sm:px-6">
            <ComposeButton icon={<Reply size={15} />} onClick={() => setMode('reply')}>Reply</ComposeButton>
            <ComposeButton icon={<ReplyAll size={15} />} onClick={() => setMode('replyAll')}>Reply All</ComposeButton>
            <ComposeButton icon={<Forward size={15} />} onClick={() => setMode('forward')}>Forward</ComposeButton>
          </div>
        </div>
      )}
    </div>
    </div>,
    document.body,
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 font-semibold text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 break-words text-slate-600" dir="auto">{value || '—'}</span>
    </div>
  )
}

function ComposeButton({
  icon, onClick, children,
}: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600"
    >
      {icon}
      {children}
    </button>
  )
}

/** عناوين الرسالة كمصفوفة عناوين (من داخل <> أو المفصولة بفواصل) */
function addressesFrom(text: string): string[] {
  if (!text) return []
  const angled: string[] = []
  const re = /<([^>]+)>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) angled.push(m[1].trim())
  if (angled.length) return angled
  return text.split(',').map((s) => s.trim()).filter((s) => s.includes('@'))
}

function initialTo(m: EmailMessage, mode: ComposeMode): string {
  if (mode === 'forward') return ''
  if (mode === 'reply') return addressesFrom(m.sender)[0] ?? m.sender
  return [...new Set([...addressesFrom(m.sender), ...addressesFrom(m.to)])].join(', ')
}

function initialSubject(m: EmailMessage, mode: ComposeMode): string {
  const s = m.subject || ''
  if (mode === 'forward') return /^fwd:/i.test(s) ? s : `Fwd: ${s}`
  return /^re:/i.test(s) ? s : `Re: ${s}`
}

function initialBody(m: EmailMessage, mode: ComposeMode): string {
  const kind = mode === 'forward' ? 'Forwarded message' : 'Original message'
  return (
    `\n\n---------- ${kind} ----------\n` +
    `From: ${m.sender}\n` +
    `Date: ${m.date ? formatDate(m.date) : ''}\n` +
    `Subject: ${m.subject}\n\n` +
    `${m.body ?? ''}`
  )
}

/** محرّر الرد/الإرسال أسفل النافذة — حقول قابلة للتعديل مع زر إرسال */
function ReplyComposer({
  message, mode, onCancel, onSent,
}: { message: EmailMessage; mode: ComposeMode; onCancel: () => void; onSent: () => void }) {
  const [to, setTo] = useState(() => initialTo(message, mode))
  const [subject, setSubject] = useState(() => initialSubject(message, mode))
  const [body, setBody] = useState(() => initialBody(message, mode))
  const [sent, setSent] = useState(false)

  const send = useMutation({
    mutationFn: () => api.email.send({ to, subject, body, in_reply_to: message.message_id }),
    onSuccess: () => {
      setSent(true)
      setTimeout(onSent, 900)
    },
  })

  return (
    // عمود بكامل ارتفاع المنطقة: الحقلان والأزرار ثابتة، وحقل النص يتمدد بينها
    <div className="flex h-full flex-col gap-2 px-4 py-3 sm:px-6">
      <div className="flex shrink-0 items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-semibold text-slate-400">To</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          dir="ltr"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-semibold text-slate-400">Subject</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          dir="auto"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
        />
      </div>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        dir="auto"
        className="min-h-0 w-full flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          onClick={() => send.mutate()}
          disabled={send.isPending || !to.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={15} />
          {send.isPending ? 'جارٍ الإرسال…' : sent ? 'تم الإرسال ✓' : 'إرسال'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          إلغاء
        </button>
        {send.isError && (
          <span className="text-xs text-red-500">{errorDetail(send.error)}</span>
        )}
      </div>
    </div>
  )
}
