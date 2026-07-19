import { useQueryClient } from '@tanstack/react-query'
import { FileText, Paperclip, Send, X } from 'lucide-react'
import {
  useEffect, useRef, useState, type ChangeEvent, type FormEvent,
  type KeyboardEvent, type ReactNode,
} from 'react'
import { useCommentMutations, useTaskComments } from '../../hooks/useTasks'
import { useMentionableUsers } from '../../hooks/useUsers'
import { api } from '../../lib/api'
import { cn, formatDate, formatFileSize, isImageFile } from '../../lib/utils'
import { displayName, type Task, type UpdateAttachment, type UserBrief } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Lightbox } from '../ui/Lightbox'
import { Modal } from '../ui/Modal'

const ATTACH_ACCEPT = 'image/*,.pdf,.txt,.md,.csv'

/** تمييز المنشن (@username) بالأزرق داخل نص التعليق */
function renderBody(text: string): ReactNode[] {
  return text.split(/(@[\w.@+-]+)/g).map((part, index) =>
    part.startsWith('@') ? (
      <span key={index} className="font-medium text-blue-600">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

export function TaskCommentsModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data: comments = [], isLoading, isFetching } = useTaskComments(task.id)
  const { data: mentionable = [] } = useMentionableUsers()
  const { create } = useCommentMutations(task.id)
  const [body, setBody] = useState('')
  const queryClient = useQueryClient()

  // مرفقات المهمة — حالة محلية للعرض الفوري بعد الرفع/الحذف
  const [attachments, setAttachments] = useState<UpdateAttachment[]>(task.attachments)
  const [uploading, setUploading] = useState(false)
  const attachInputRef = useRef<HTMLInputElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const refreshTasks = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })

  const uploadAttachment = async (file: File) => {
    setUploading(true)
    try {
      const created = await api.attachments.create(task.project, file, '', '', {
        taskId: task.id,
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
      refreshTasks()
      queryClient.invalidateQueries({ queryKey: ['attachments'] })
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
      refreshTasks()
      queryClient.invalidateQueries({ queryKey: ['attachments'] })
    } catch {
      window.alert('تعذر حذف المرفق.')
    }
  }

  // إكمال المنشن: mentionQuery = ما كُتب بعد @ قبل المؤشر (null = مغلق)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [activeSuggestion, setActiveSuggestion] = useState(0)

  const suggestions =
    mentionQuery === null
      ? []
      : mentionable
          .filter((u) => {
            const q = mentionQuery.toLowerCase()
            return (
              u.username.toLowerCase().includes(q) ||
              displayName(u).toLowerCase().includes(q)
            )
          })
          .slice(0, 5)
  const mentionOpen = suggestions.length > 0

  const updateMentionQuery = (value: string, caret: number) => {
    const beforeCaret = value.slice(0, caret)
    const match = /(?:^|\s)@([\w.@+-]*)$/.exec(beforeCaret)
    setMentionQuery(match ? match[1] : null)
    setActiveSuggestion(0)
  }

  const handleBodyChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)
    updateMentionQuery(e.target.value, e.target.selectionStart)
  }

  const insertMention = (user: UserBrief) => {
    const el = textareaRef.current
    const caret = el?.selectionStart ?? body.length
    const beforeCaret = body.slice(0, caret).replace(/@[\w.@+-]*$/, `@${user.username} `)
    setBody(beforeCaret + body.slice(caret))
    setMentionQuery(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(beforeCaret.length, beforeCaret.length)
    })
  }

  const handleBodyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertMention(suggestions[activeSuggestion])
    } else if (e.key === 'Escape') {
      // أغلق قائمة المنشن فقط — لا النافذة كلها
      e.stopPropagation()
      setMentionQuery(null)
    }
  }

  // بعد جلب التعليقات يكون الخادم قد حدّث «آخر اطلاع» — حدّث قائمة المهام
  // (نقطة أيقونة التعليقات) وقائمة المشاريع (النقطة الحمراء في الشريط الجانبي)
  useEffect(() => {
    if (!isFetching) {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
  }, [isFetching, queryClient])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || create.isPending) return
    create.mutate(text, { onSuccess: () => setBody('') })
  }

  return (
    <Modal title="التعليقات" onClose={onClose}>
      <p className="mb-3 truncate text-sm text-slate-500">المهمة: {task.title}</p>

      {/* مرفقات المهمة — عرض ورفع وحذف */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
        {attachments.map((att) => (
          <span key={att.id} className="relative">
            {isImageFile(att.file_name) ? (
              <button type="button" onClick={() => setLightbox(att.file)} title={att.file_name}>
                <img
                  src={att.thumbnail ?? att.file}
                  alt={att.file_name}
                  loading="lazy"
                  className="h-16 w-16 cursor-zoom-in rounded-lg object-cover ring-1 ring-slate-200"
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
                <span dir="ltr" className="max-w-32 truncate">{att.file_name}</span>
                <span className="text-slate-400">({formatFileSize(att.size)})</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => removeAttachment(att)}
              title="حذف المرفق"
              className="absolute -end-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white shadow hover:bg-red-700"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => attachInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
        >
          <Paperclip size={13} />
          {uploading ? 'جارٍ الرفع…' : 'إرفاق ملف'}
        </button>
        <input
          ref={attachInputRef}
          type="file"
          accept={ATTACH_ACCEPT}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void uploadAttachment(file)
          }}
          className="hidden"
        />
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto">
        {isLoading && <p className="py-4 text-center text-sm text-slate-400">جارٍ التحميل…</p>}
        {!isLoading && comments.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">لا توجد تعليقات بعد</p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-2">
            {comment.author ? (
              <Avatar user={comment.author} size={28} />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
                ؟
              </span>
            )}
            <div
              className={cn(
                'min-w-0 flex-1 rounded-lg px-3 py-2',
                // تعليق لم يقرأه المستخدم بعد — خلفية صفراء فاتحة
                comment.is_unread ? 'bg-yellow-50' : 'bg-slate-50',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-400">
                  {comment.author ? displayName(comment.author) : 'مستخدم محذوف'}
                </span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {formatDate(comment.created_at)}
                </span>
              </div>
              <p
                className={cn(
                  'mt-0.5 whitespace-pre-wrap text-sm text-slate-700',
                  comment.is_unread && 'font-bold',
                )}
              >
                {renderBody(comment.body)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={handleBodyKeyDown}
            rows={2}
            placeholder="اكتب تعليقاً… استخدم @ للإشارة إلى زميل"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          {/* قائمة إكمال المنشن — تظهر فوق حقل الكتابة */}
          {mentionOpen && (
            <div className="absolute bottom-full start-0 z-20 mb-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              {suggestions.map((user, index) => (
                <button
                  key={user.id}
                  type="button"
                  // mousedown كي لا يفقد الحقل التركيز قبل الإدراج
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertMention(user)
                  }}
                  onMouseMove={() => setActiveSuggestion(index)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm',
                    index === activeSuggestion ? 'bg-blue-50' : 'hover:bg-slate-50',
                  )}
                >
                  <Avatar user={user} size={22} />
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {displayName(user)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400" dir="ltr">
                    @{user.username}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!body.trim() || create.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={14} />
          إرسال
        </button>
      </form>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </Modal>
  )
}
