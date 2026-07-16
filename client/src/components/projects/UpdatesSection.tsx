import { ChevronDown, ChevronUp, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useMe } from '../../hooks/useAuth'
import { useProjectUpdateMutations, useProjectUpdates } from '../../hooks/useProjects'
import { formatDate } from '../../lib/utils'
import { displayName, type ProjectUpdate } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Modal } from '../ui/Modal'

/** عدد التحديثات الظاهرة افتراضياً (الأحدث في الأسفل، والأقدم مخفية) */
const DEFAULT_VISIBLE = 2

/** سجل تحديثات المشروع: أحداث وإجراءات (توقيع عقد، إرسال كتاب، تنصيب محطة…).
 *  الكل يضيف؛ وكل كاتب يعدّل/يحذف تحديثاته فقط، والمدير يدير الجميع. */
export function UpdatesSection({ projectId }: { projectId: number }) {
  const { data: me } = useMe()
  const isManager = !!me?.is_manager

  const { data: updates = [], isLoading } = useProjectUpdates(projectId)
  const { create, update, remove } = useProjectUpdateMutations(projectId)

  const [showAll, setShowAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBody, setEditBody] = useState('')

  // القائمة تصل مرتبة من الأقدم إلى الأحدث — نعرض آخر اثنين افتراضياً
  const visible = showAll ? updates : updates.slice(-DEFAULT_VISIBLE)
  const hiddenCount = updates.length - visible.length

  const canModify = (item: ProjectUpdate) => isManager || item.author?.id === me?.id
  const wasEdited = (item: ProjectUpdate) =>
    new Date(item.updated_at).getTime() - new Date(item.created_at).getTime() > 60_000

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || create.isPending) return
    create.mutate(text, {
      onSuccess: () => {
        setBody('')
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
    if (!confirm('حذف هذا التحديث؟')) return
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

      {/* إظهار/إخفاء التحديثات القديمة */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="mb-2 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ChevronUp size={15} />
          عرض جميع التحديثات ({updates.length})
        </button>
      )}
      {showAll && updates.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setShowAll(false)}
          className="mb-2 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ChevronDown size={15} />
          إخفاء التحديثات القديمة
        </button>
      )}

      <div className="space-y-3">
        {isLoading && <p className="py-2 text-sm text-slate-400">جارٍ التحميل…</p>}
        {!isLoading && updates.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
            لا توجد تحديثات بعد — سجّل أول حدث للمشروع
          </p>
        )}

        {visible.map((item) => (
          <div key={item.id} className="group flex gap-2">
            {item.author ? (
              <Avatar user={item.author} size={30} />
            ) : (
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
                ؟
              </span>
            )}

            <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-xs font-bold text-slate-700">
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
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* إضافة تحديث جديد — نافذة منبثقة تُفتح من زر الترويسة */}
      {adding && (
        <Modal title="إضافة تحديث" onClose={() => setAdding(false)}>
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
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdding(false)}
                disabled={create.isPending}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!body.trim() || create.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send size={14} />
                {create.isPending ? 'جارٍ الإضافة…' : 'إضافة التحديث'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
