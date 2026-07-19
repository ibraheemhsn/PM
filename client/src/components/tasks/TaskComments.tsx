import { useQueryClient } from '@tanstack/react-query'
import { Send, Trash2 } from 'lucide-react'
import {
  useEffect, useRef, useState, type ChangeEvent, type FormEvent,
  type KeyboardEvent, type ReactNode,
} from 'react'
import { useMe } from '../../hooks/useAuth'
import { useCommentMutations, useTaskComments } from '../../hooks/useTasks'
import { useMentionableUsers } from '../../hooks/useUsers'
import { cn, formatDate } from '../../lib/utils'
import { displayName, type Task, type UserBrief } from '../../types'
import { Avatar } from '../ui/Avatar'

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

/** قسم تعليقات المهمة: عرض + إضافة مع إكمال منشن (@) + حذف للمدير.
 *  مكوّن مستقل يُستعمل داخل نافذة تعديل المهمة ونافذة التعليقات. */
export function TaskComments({ task }: { task: Task }) {
  const { data: me } = useMe()
  const isManager = !!me?.is_manager
  const { data: comments = [], isLoading, isFetching } = useTaskComments(task.id)
  const { data: mentionable = [] } = useMentionableUsers()
  const { create, remove } = useCommentMutations(task.id)
  const [body, setBody] = useState('')
  const queryClient = useQueryClient()

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
              u.username.toLowerCase().includes(q) || displayName(u).toLowerCase().includes(q)
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
      e.stopPropagation() // أغلق قائمة المنشن فقط لا النافذة
      setMentionQuery(null)
    }
  }

  // بعد جلب التعليقات يكون الخادم قد حدّث «آخر اطلاع» — حدّث المهام والمشاريع
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

  const handleDelete = (commentId: number) => {
    if (!confirm('حذف هذا التعليق نهائياً؟')) return
    remove.mutate(commentId)
  }

  return (
    <div>
      <div className="max-h-72 space-y-3 overflow-y-auto">
        {isLoading && <p className="py-4 text-center text-sm text-slate-400">جارٍ التحميل…</p>}
        {!isLoading && comments.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">لا توجد تعليقات بعد</p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="group flex gap-2">
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
                comment.is_unread ? 'bg-yellow-50' : 'bg-slate-50',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-400">
                  {comment.author ? displayName(comment.author) : 'مستخدم محذوف'}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-[10px] text-slate-400">
                    {formatDate(comment.created_at)}
                  </span>
                  {/* حذف التعليق — للمدير فقط */}
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      title="حذف التعليق"
                      className="rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
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
          {mentionOpen && (
            <div className="absolute bottom-full start-0 z-20 mb-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              {suggestions.map((user, index) => (
                <button
                  key={user.id}
                  type="button"
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
    </div>
  )
}
