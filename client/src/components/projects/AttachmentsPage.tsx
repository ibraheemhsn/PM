import { FileText, FilterX, Paperclip, Pencil, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { useAllAttachments, useAttachmentMutations, useProjects } from '../../hooks/useProjects'
import { cn, formatDate, formatFileSize, isImageFile } from '../../lib/utils'
import {
  ATTACHMENT_CATEGORIES, ATTACHMENT_CATEGORY_LABELS, displayName,
  type Attachment, type AttachmentCategory,
} from '../../types'
import { Avatar } from '../ui/Avatar'
import { Lightbox } from '../ui/Lightbox'

/** نوع الملف للفلترة: صورة أو PDF أو ملف نصي */
type FileKind = 'image' | 'pdf' | 'text'

const KIND_LABELS: Record<FileKind, string> = {
  image: 'صور',
  pdf: 'PDF',
  text: 'ملفات نصية',
}

const fileKind = (name: string): FileKind =>
  isImageFile(name) ? 'image' : name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text'

/** كل المرفقات عبر جميع المشاريع، مع بحث (اسم/وصف/رافع) وفلترة
 *  بالمشروع ونوع الملف. الرفع نفسه يبقى من صفحة كل مشروع. */
export function AttachmentsPage() {
  const { data: me } = useMe()
  const isManager = !!me?.is_manager

  const { data: attachments = [], isLoading, isError } = useAllAttachments()
  const { data: projects = [] } = useProjects()
  const { update, remove } = useAttachmentMutations()

  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<number | 'all'>('all')
  const [kindFilter, setKindFilter] = useState<FileKind | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<AttachmentCategory | 'all'>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  const hasActiveFilters =
    query.trim() !== '' ||
    projectFilter !== 'all' ||
    kindFilter !== 'all' ||
    categoryFilter !== 'all'

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase()
    return attachments
      .filter((a) => projectFilter === 'all' || a.project === projectFilter)
      .filter((a) => kindFilter === 'all' || fileKind(a.file_name) === kindFilter)
      .filter((a) => categoryFilter === 'all' || a.category === categoryFilter)
      .filter(
        (a) =>
          !text ||
          a.file_name.toLowerCase().includes(text) ||
          a.description.toLowerCase().includes(text) ||
          (a.uploaded_by ? displayName(a.uploaded_by).toLowerCase().includes(text) : false),
      )
  }, [attachments, query, projectFilter, kindFilter, categoryFilter])

  const canModify = (attachment: Attachment) =>
    isManager || attachment.uploaded_by?.id === me?.id

  const startEdit = (attachment: Attachment) => {
    setEditingId(attachment.id)
    setEditDescription(attachment.description)
  }

  const saveEdit = () => {
    if (editingId === null || update.isPending) return
    update.mutate(
      { id: editingId, description: editDescription.trim() },
      { onSuccess: () => setEditingId(null) },
    )
  }

  const handleDelete = (attachment: Attachment) => {
    if (!confirm(`حذف مرفق «${attachment.file_name}»؟ سيُحذف الملف نهائياً.`)) return
    remove.mutate(attachment.id)
  }

  if (isLoading) return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>
  if (isError)
    return (
      <p className="p-10 text-center text-red-600">
        تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000
      </p>
    )

  return (
    <div>
      {/* شريط البحث والفلاتر */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-6 py-4 backdrop-blur">
        <h1 className="mb-3 text-xl font-bold text-slate-900">
          كل المرفقات{' '}
          <span className="text-sm font-normal text-slate-400">({visible.length})</span>
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* بحث: اسم الملف أو الوصف أو الرافع */}
          <div className="relative min-w-[160px] flex-1">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث في الاسم أو الوصف أو الرافع…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pe-3 ps-9 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
            />
          </div>

          {/* فلتر المشروع */}
          <select
            value={projectFilter}
            onChange={(e) =>
              setProjectFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            <option value="all">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {/* فلتر نوع الملف */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setKindFilter('all')}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs transition-colors',
                kindFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-blue-300',
              )}
            >
              الكل
            </button>
            {(Object.keys(KIND_LABELS) as FileKind[]).map((kind) => (
              <button
                key={kind}
                onClick={() => setKindFilter((k) => (k === kind ? 'all' : kind))}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs transition-colors',
                  kindFilter === kind
                    ? 'bg-blue-50 font-medium text-blue-700 ring-1 ring-blue-400'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-blue-300',
                )}
              >
                {KIND_LABELS[kind]}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setQuery('')
                setProjectFilter('all')
                setKindFilter('all')
                setCategoryFilter('all')
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-100"
              title="مسح الفلاتر"
            >
              <FilterX size={15} />
              مسح
            </button>
          )}
        </div>

        {/* الفلترة السريعة حسب التصنيف */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400">التصنيف:</span>
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs transition-colors',
              categoryFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-blue-300',
            )}
          >
            الكل
          </button>
          {ATTACHMENT_CATEGORIES.map((value) => (
            <button
              key={value}
              onClick={() => setCategoryFilter((f) => (f === value ? 'all' : value))}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs transition-colors',
                categoryFilter === value
                  ? 'bg-blue-50 font-medium text-blue-700 ring-1 ring-blue-400'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-blue-300',
              )}
            >
              {ATTACHMENT_CATEGORY_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {/* قائمة المرفقات */}
      <div className="mx-auto max-w-6xl space-y-2 px-6 py-6">
        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-10 text-slate-400">
            <Paperclip size={24} />
            <p className="text-sm">
              {hasActiveFilters
                ? 'لا توجد مرفقات مطابقة للفلاتر'
                : 'لا توجد مرفقات بعد — تُرفع المرفقات من صفحة كل مشروع'}
            </p>
          </div>
        )}

        {visible.map((attachment) => (
          <div
            key={attachment.id}
            className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            {/* معاينة الصورة أو أيقونة الملف */}
            {isImageFile(attachment.file_name) ? (
              <button
                onClick={() => setLightbox(attachment.file)}
                title="تكبير الصورة"
                className="shrink-0"
              >
                <img
                  src={attachment.file}
                  alt={attachment.file_name}
                  className="h-11 w-11 cursor-zoom-in rounded-lg object-cover ring-1 ring-slate-200"
                />
              </button>
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 ring-1 ring-slate-200">
                <FileText size={20} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <a
                  href={attachment.file}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="truncate text-sm font-medium text-slate-800 hover:text-blue-600 hover:underline"
                >
                  {attachment.file_name}
                </a>
                <span className="text-xs text-slate-400">{formatFileSize(attachment.size)}</span>
                {attachment.category && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                    {ATTACHMENT_CATEGORY_LABELS[attachment.category]}
                  </span>
                )}
                {/* شارة المشروع — تنقل لصفحته */}
                <Link
                  to={`/projects/${attachment.project}`}
                  className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: attachment.project_color }}
                  />
                  {attachment.project_title}
                </Link>
              </div>

              {editingId === attachment.id ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    autoFocus
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={update.isPending}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    حفظ
                  </button>
                </div>
              ) : (
                attachment.description && (
                  <p className="mt-0.5 text-sm text-slate-500">{attachment.description}</p>
                )
              )}

              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                {attachment.uploaded_by && (
                  <>
                    <Avatar user={attachment.uploaded_by} size={16} />
                    <span>{displayName(attachment.uploaded_by)}</span>
                    <span>·</span>
                  </>
                )}
                <span>{formatDate(attachment.created_at)}</span>
              </div>
            </div>

            {canModify(attachment) && editingId !== attachment.id && (
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => startEdit(attachment)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                  title="تعديل الوصف"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(attachment)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  title="حذف المرفق"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
