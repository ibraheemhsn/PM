import { FileText, Paperclip, Pencil, Trash2, Upload, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { useMe } from '../../hooks/useAuth'
import { useAttachmentMutations, useAttachments } from '../../hooks/useProjects'
import { formatDate, formatFileSize, isImageFile } from '../../lib/utils'
import { displayName, type Attachment } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Lightbox } from '../ui/Lightbox'

const ACCEPTED_TYPES = 'image/*,.pdf,.txt,.md,.csv'

/** مرفقات المشروع: صور وPDF وملفات نصية، مع وصف واسم الرافع وتاريخ الرفع.
 *  الكل يرفع؛ وكل رافع يعدّل وصف مرفقاته أو يحذفها — والمدير يدير الجميع. */
export function AttachmentsSection({ projectId }: { projectId: number }) {
  const { data: me } = useMe()
  const isManager = !!me?.is_manager

  const { data: attachments = [], isLoading } = useAttachments(projectId)
  const { create, update, remove } = useAttachmentMutations(projectId)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  const canModify = (attachment: Attachment) =>
    isManager || attachment.uploaded_by?.id === me?.id

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (file) {
      setPendingFile(file)
      setDescription('')
      setError('')
    }
  }

  const submitUpload = () => {
    if (!pendingFile || create.isPending) return
    setError('')
    create.mutate(
      { file: pendingFile, description: description.trim() },
      {
        onSuccess: () => {
          setPendingFile(null)
          setDescription('')
        },
        onError: (err) =>
          setError(
            err.message.includes('API 400')
              ? 'نوع الملف غير مدعوم — يُسمح بالصور وملفات PDF والملفات النصية'
              : 'تعذر الرفع — تحقق من الاتصال بالخادم',
          ),
      },
    )
  }

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

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-slate-700">
          المرفقات{' '}
          <span className="text-sm font-normal text-slate-400">({attachments.length})</span>
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Upload size={15} />
          رفع مرفق
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFilePick}
          className="hidden"
        />
      </div>

      {/* نموذج إكمال الرفع: وصف الملف المختار */}
      {pendingFile && (
        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-700">
            <Paperclip size={15} className="shrink-0 text-blue-600" />
            <span className="truncate font-medium" dir="ltr">
              {pendingFile.name}
            </span>
            <span className="shrink-0 text-xs text-slate-400">
              ({formatFileSize(pendingFile.size)})
            </span>
            <button
              onClick={() => setPendingFile(null)}
              className="ms-auto rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600"
              title="إلغاء"
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitUpload()}
              placeholder="وصف المرفق… مثال: نسخة العقد الموقعة"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <button
              onClick={submitUpload}
              disabled={create.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {create.isPending ? 'جارٍ الرفع…' : 'رفع'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {isLoading && <p className="py-2 text-sm text-slate-400">جارٍ التحميل…</p>}
        {!isLoading && attachments.length === 0 && !pendingFile && (
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-8 text-slate-400">
            <Paperclip size={24} />
            <p className="text-sm">لا توجد مرفقات بعد — ارفع صوراً أو ملفات PDF أو ملفات نصية</p>
          </div>
        )}

        {attachments.map((attachment) => (
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
              <div className="flex flex-wrap items-center gap-x-2">
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
    </section>
  )
}
