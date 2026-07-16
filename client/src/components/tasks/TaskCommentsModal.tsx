import { useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useCommentMutations, useTaskComments } from '../../hooks/useTasks'
import { cn, formatDate } from '../../lib/utils'
import { displayName, type Task } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Modal } from '../ui/Modal'

export function TaskCommentsModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data: comments = [], isLoading, isFetching } = useTaskComments(task.id)
  const { create } = useCommentMutations(task.id)
  const [body, setBody] = useState('')
  const queryClient = useQueryClient()

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
      <p className="mb-4 truncate text-sm text-slate-500">المهمة: {task.title}</p>

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
                {comment.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="اكتب تعليقاً…"
          className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <button
          type="submit"
          disabled={!body.trim() || create.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={14} />
          إرسال
        </button>
      </form>
    </Modal>
  )
}
