import { useQueryClient } from '@tanstack/react-query'
import { FileText, Paperclip, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMe } from '../../hooks/useAuth'
import { useProjectUpdateMutations, useProjectUpdates } from '../../hooks/useProjects'
import { api } from '../../lib/api'
import { cn, formatDate, formatFileSize, isImageFile } from '../../lib/utils'
import { displayName, type ProjectUpdate, type UpdateAttachment } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Lightbox } from '../ui/Lightbox'
import { Modal } from '../ui/Modal'

const ATTACH_ACCEPT = 'image/*,.pdf,.txt,.md,.csv'

/** سجل تحديثات المشروع: أحداث وإجراءات (توقيع عقد، إرسال كتاب، تنصيب محطة…).
 *  قسم فرعي داخل «التفاصيل الفنية» يظهر بعد «عرض المزيد» — لذا تُعرض
 *  كل التحديثات مباشرة دون طي إضافي.
 *  الكل يضيف؛ وكل كاتب يعدّل/يحذف تحديثاته فقط، والمدير يدير الجميع. */
export function UpdatesSection({ projectId }: { projectId: number }) {
  const { data: me } = useMe()
  const isManager = !!me?.is_manager

  const { data: updates = [], isLoading } = useProjectUpdates(projectId)
  const { create, update, remove } = useProjectUpdateMutations(projectId)
  const queryClient = useQueryClient()

  // جلب تحديثات المشروع يعلّمها مقروءةً على الخادم — حدّث النقطة الحمراء
  // في الشريط الجانبي، ويبقى التمييز الأصفر ظاهراً حتى مغادرة الصفحة
  const hasUnread = updates.some((u) => u.is_unread)
  useEffect(() => {
    if (hasUnread) queryClient.invalidateQueries({ queryKey: ['projects'] })
  }, [hasUnread, queryClient])

  const [adding, setAdding] = useState(false)
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBody, setEditBody] = useState('')

  // مرفق اختياري للتحديث — يُرفع بعد إنشاء التحديث ويظهر في قسم المرفقات أيضاً
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [uploadingAttach, setUploadingAttach] = useState(false)
  const attachInputRef = useRef<HTMLInputElement>(null)
  const editAttachInputRef = useRef<HTMLInputElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const invalidateAttachments = () => {
    queryClient.invalidateQueries({ queryKey: ['updates'] })
    queryClient.invalidateQueries({ queryKey: ['attachments'] })
  }

  const uploadForUpdate = async (updateId: number, file: File) => {
    setUploadingAttach(true)
    try {
      await api.attachments.create(projectId, file, '', '', { updateId })
      invalidateAttachments()
    } catch {
      window.alert('تعذر رفع المرفق — يُسمح بالصور وملفات PDF والملفات النصية.')
    } finally {
      setUploadingAttach(false)
    }
  }

  const deleteAttachment = async (attachment: UpdateAttachment) => {
    if (!confirm(`حذف مرفق «${attachment.file_name}»؟ سيُحذف من قسم المرفقات أيضاً.`)) return
    try {
      await api.attachments.remove(attachment.id)
      invalidateAttachments()
    } catch {
      window.alert('تعذر حذف المرفق.')
    }
  }

  const canModify = (item: ProjectUpdate) => isManager || item.author?.id === me?.id
  const wasEdited = (item: ProjectUpdate) =>
    new Date(item.updated_at).getTime() - new Date(item.created_at).getTime() > 60_000

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || create.isPending || uploadingAttach) return
    create.mutate(text, {
      onSuccess: async (created) => {
        if (attachFile) await uploadForUpdate(created.id, attachFile)
        setBody('')
        setAttachFile(null)
        setAdding(false)
      },
    })
  }

  const startEdit = (item: ProjectUpdate) => {
    setEditingId(item.id)
    setEditBody(item.body)
  }

  const saveEdit = () => {
    const text = editBody.trim()
    if (!text || editingId === null || update.isPending) return
    update.mutate({ id: editingId, body: text }, { onSuccess: () => setEditingId(null) })
  }

  const handleDelete = (item: ProjectUpdate) => {
    if (!confirm('نقل هذا التحديث إلى المحذوفات؟ يستطيع المدير استعادته أو حذفه نهائياً من هناك.'))
      return
    remove.mutate(item.id)
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-slate-700">
          التحديثات <span className="text-sm font-normal text-slate-400">({updates.length})</span>
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={15} />
          إضافة تحديث
        </button>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="py-2 text-sm text-slate-400">جارٍ التحميل…</p>}
        {!isLoading && updates.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
            لا توجد تحديثات بعد — سجّل أول حدث للمشروع
          </p>
        )}

        {updates.map((item) => (
          <div key={item.id} className="group flex gap-2">
            {item.author ? (
              <Avatar user={item.author} size={30} />
            ) : (
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
                ؟
              </span>
            )}

            <div
              className={cn(
                'min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2',
                // تحديث لم يقرأه المستخدم بعد — خلفية صفراء فاتحة
                item.is_unread ? 'bg-yellow-50' : 'bg-white',
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {/* اسم الكاتب خفيف — المهم فحوى التحديث لا كاتبه */}
                <span className="text-xs text-slate-400">
                  {item.author ? displayName(item.author) : 'مستخدم محذوف'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatDate(item.created_at)}
                  {wasEdited(item) && ' · (معدَّل)'}
                </span>
                {canModify(item) && editingId !== item.id && (
                  <span className="ms-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(item)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                      title="تعديل التحديث"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      title="حذف التحديث"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>

              {editingId === item.id ? (
                <div className="mt-1.5">
                  <textarea
                    autoFocus
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    onKeyDown={(e) => {
                      // Ctrl+Enter يحفظ التعديل مباشرة
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        saveEdit()
                      }
                    }}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                  />
                  <div className="mt-1 flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={!editBody.trim() || update.isPending}
                      className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {update.isPending ? 'جارٍ الحفظ…' : 'حفظ'}
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className={cn(
                    'mt-0.5 whitespace-pre-wrap text-sm text-slate-700',
                    item.is_unread && 'font-bold',
                  )}
                >
                  {item.body}
                </p>
              )}

              {/* مرفقات التحديث: صور مصغرة أو روابط ملفات — وفي وضع التعديل
                  زر حذف على كل مرفق وزر إرفاق إن لم يوجد */}
              {(item.attachments.length > 0 || editingId === item.id) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.attachments.map((att) => (
                    <span key={att.id} className="relative">
                      {isImageFile(att.file_name) ? (
                        <button
                          type="button"
                          onClick={() => setLightbox(att.file)}
                          title={att.file_name}
                        >
                          <img
                            src={att.thumbnail ?? att.file}
                            alt={att.file_name}
                            loading="lazy"
                            decoding="async"
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
                      {editingId === item.id && (
                        <button
                          type="button"
                          onClick={() => deleteAttachment(att)}
                          title="حذف المرفق (يُحذف من قسم المرفقات أيضاً)"
                          className="absolute -end-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white shadow hover:bg-red-700"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </span>
                  ))}
                  {editingId === item.id && item.attachments.length === 0 && (
                    <button
                      type="button"
                      onClick={() => editAttachInputRef.current?.click()}
                      disabled={uploadingAttach}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
                    >
                      <Paperclip size={13} />
                      {uploadingAttach ? 'جارٍ الرفع…' : 'إرفاق ملف'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* منتقي مرفق وضع التعديل — يرفع فوراً للتحديث الجاري تعديله */}
      <input
        ref={editAttachInputRef}
        type="file"
        accept={ATTACH_ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file && editingId !== null) void uploadForUpdate(editingId, file)
        }}
        className="hidden"
      />

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* إضافة تحديث جديد — نافذة منبثقة تُفتح من زر الترويسة */}
      {adding && (
        <Modal
          title="إضافة تحديث"
          onClose={() => {
            setAdding(false)
            setAttachFile(null)
          }}
        >
          <form onSubmit={handleCreate}>
            <textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl+Enter (أو Cmd+Enter على ماك) يرسل كما لو نُقر زر الإضافة
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              rows={4}
              placeholder="سجّل حدثاً أو إجراءً… مثال: تم توقيع العقد مع المقاول"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            {/* مرفق اختياري يُرفع مع التحديث ويظهر في قسم المرفقات أيضاً */}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600"
              >
                <Paperclip size={13} />
                {attachFile ? 'تغيير المرفق' : 'إرفاق ملف (اختياري)'}
              </button>
              {attachFile && (
                <span className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
                  <span dir="ltr" className="max-w-44 truncate">{attachFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachFile(null)}
                    className="rounded p-0.5 hover:bg-slate-100"
                    title="إزالة المرفق"
                  >
                    <X size={13} />
                  </button>
                </span>
              )}
              <input
                ref={attachInputRef}
                type="file"
                accept={ATTACH_ACCEPT}
                onChange={(e) => {
                  setAttachFile(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
                className="hidden"
              />
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setAttachFile(null)
                }}
                disabled={create.isPending || uploadingAttach}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!body.trim() || create.isPending || uploadingAttach}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send size={14} />
                {create.isPending || uploadingAttach ? 'جارٍ الإضافة…' : 'إضافة التحديث'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
