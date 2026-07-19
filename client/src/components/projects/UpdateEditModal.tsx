import { useQueryClient } from '@tanstack/react-query'
import { FileText, Paperclip, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useProjectUpdateMutations } from '../../hooks/useProjects'
import { api } from '../../lib/api'
import { cn, formatFileSize, isImageFile } from '../../lib/utils'
import type { ProjectUpdate, UpdateAttachment } from '../../types'
import { Lightbox } from '../ui/Lightbox'
import { Modal } from '../ui/Modal'

const ATTACH_ACCEPT = 'image/*,.pdf,.txt,.md,.csv'

/** نافذة تعديل تحديث مشروع من الخلاصة الموحدة: تحرير النص + إدارة المرفقات
 *  + الحذف. الصلاحية للمدير أو كاتب التحديث (مفروضة على الخادم أيضاً). */
export function UpdateEditModal({
  update, canEdit, onClose,
}: { update: ProjectUpdate; canEdit: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { update: updateMut, remove } = useProjectUpdateMutations()

  const [body, setBody] = useState(update.body)
  // النص يُعرض للقراءة أولاً، ولا يدخل وضع التحرير إلا بالنقر عليه (كعنوان المهمة)
  const [editingBody, setEditingBody] = useState(false)
  const [attachments, setAttachments] = useState<UpdateAttachment[]>(update.attachments)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['updates'] })
    queryClient.invalidateQueries({ queryKey: ['attachments'] })
  }

  const save = () => {
    const text = body.trim()
    if (!text || updateMut.isPending) return
    updateMut.mutate({ id: update.id, body: text }, { onSuccess: onClose })
  }

  const handleDelete = () => {
    if (!confirm('نقل هذا التحديث إلى المحذوفات؟ يمكن للمدير استعادته أو حذفه نهائياً.')) return
    remove.mutate(update.id, { onSuccess: onClose })
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const created = await api.attachments.create(update.project, file, '', '', {
        updateId: update.id,
      })
      setAttachments((prev) => [
        ...prev,
        {
          id: created.id,
          file: created.file,
          file_name: created.file_name,
          thumbnail: created.thumbnail,
          size: created.size,
        },
      ])
      invalidate()
    } catch {
      window.alert('تعذر رفع المرفق — يُسمح بالصور وملفات PDF والملفات النصية.')
    } finally {
      setUploading(false)
    }
  }

  const removeAttachment = async (att: UpdateAttachment) => {
    if (!confirm(`حذف مرفق «${att.file_name}»؟`)) return
    try {
      await api.attachments.remove(att.id)
      setAttachments((prev) => prev.filter((a) => a.id !== att.id))
      invalidate()
    } catch {
      window.alert('تعذر حذف المرفق.')
    }
  }

  return (
    <Modal title={canEdit ? 'تعديل التحديث' : 'التحديث'} onClose={onClose}>
      {editingBody && canEdit ? (
        <textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => setEditingBody(false)}
          rows={4}
          placeholder="نص التحديث…"
          className="w-full resize-none rounded-lg border border-blue-400 px-3 py-2 text-sm outline-none"
        />
      ) : (
        // عرض للقراءة — النقر عليه (للمخوَّل) يفعّل التحرير
        <div
          onClick={() => canEdit && setEditingBody(true)}
          title={canEdit ? 'انقر للتحرير' : undefined}
          className={cn(
            'min-h-[3rem] whitespace-pre-wrap rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700',
            canEdit && 'cursor-text hover:border-slate-300',
            !body.trim() && 'text-slate-400',
          )}
        >
          {body.trim() || 'نص التحديث…'}
        </div>
      )}

      {/* المرفقات */}
      {(attachments.length > 0 || canEdit) && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-slate-500">المرفقات</p>
          <div className="flex flex-wrap items-center gap-2">
            {attachments.map((att) => (
              <span key={att.id} className="relative">
                {isImageFile(att.file_name) ? (
                  <button type="button" onClick={() => setLightbox(att.file)} title={att.file_name}>
                    <img
                      src={att.thumbnail ?? att.file}
                      alt={att.file_name}
                      loading="lazy"
                      className="h-20 w-20 cursor-zoom-in rounded-lg object-cover ring-1 ring-slate-200"
                    />
                  </button>
                ) : (
                  <a
                    href={att.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200 hover:text-blue-600"
                  >
                    <FileText size={14} />
                    <span dir="ltr" className="max-w-40 truncate">{att.file_name}</span>
                    <span className="text-slate-400">({formatFileSize(att.size)})</span>
                  </a>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeAttachment(att)}
                    title="حذف المرفق"
                    className="absolute -end-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white shadow hover:bg-red-700"
                  >
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
            {canEdit && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
              >
                <Paperclip size={13} />
                {uploading ? 'جارٍ الرفع…' : 'إرفاق ملف'}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACH_ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void uploadFile(file)
            }}
            className="hidden"
          />
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={handleDelete}
            disabled={remove.isPending}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={15} />
            حذف
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              onClick={save}
              disabled={!body.trim() || updateMut.isPending}
              className={cn(
                'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50',
              )}
            >
              {updateMut.isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
            </button>
          </div>
        </div>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </Modal>
  )
}
