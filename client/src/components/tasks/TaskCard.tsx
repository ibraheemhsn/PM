import { CalendarDays, Flag, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn, formatDate, formatDay } from '../../lib/utils'
import {
  isTaskOverdue, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS,
  type Task, type TaskStatus,
} from '../../types'
import { Avatar } from '../ui/Avatar'
import { StatusIcon } from './StatusIcon'

/** المدير يدوّر الحالة عبر الدورة الكاملة، والموظف بين «قيد الإنجاز» و«قيد المراجعة» فقط
 *  (القيود مفروضة على الخادم أيضاً). */
const MANAGER_NEXT: Record<TaskStatus, TaskStatus> = {
  SUGGESTED: 'OPEN', // اعتماد المهمة المقترحة
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'REVIEW',
  REVIEW: 'DONE',
  DONE: 'OPEN',
}
const EMPLOYEE_NEXT: Partial<Record<TaskStatus, TaskStatus>> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'REVIEW',
  REVIEW: 'IN_PROGRESS',
}

interface TaskCardProps {
  task: Task
  /** إظهار شارة المشروع — يُفعَّل في صفحة «جميع المهام» */
  showProject?: boolean
  /** المدير: تعديل/حذف + دورة الحالة الكاملة */
  canManage: boolean
  /** النقر على جسم البطاقة (خارج الأزرار الداخلية) */
  onOpen?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onOpenComments: () => void
  onStatusChange: (status: TaskStatus) => void
}

export function TaskCard({
  task, showProject, canManage, onOpen, onEdit, onDelete, onOpenComments, onStatusChange,
}: TaskCardProps) {
  const next = canManage ? MANAGER_NEXT[task.status] : EMPLOYEE_NEXT[task.status]
  const isDone = task.status === 'DONE'
  const overdue = isTaskOverdue(task)

  // اكتشاف تجاوز العنوان لسطرين — عندها فقط تُعرض المنبثقة بالعنوان الكامل
  const titleRef = useRef<HTMLParagraphElement>(null)
  const [titleClamped, setTitleClamped] = useState(false)
  useEffect(() => {
    const el = titleRef.current
    if (el) setTitleClamped(el.scrollHeight > el.clientHeight + 1)
  }, [task.title])

  return (
    <div
      onClick={onOpen}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-slate-200 border-s-4 px-4 py-3 shadow-sm transition hover:shadow',
        onOpen && 'cursor-pointer',
        // مهمة لم يطّلع عليها المستخدم بعد — خلفية صفراء فاتحة تميزها
        task.is_unread ? 'bg-yellow-50' : isDone ? 'bg-slate-50' : 'bg-white',
        // المهمة المنجزة باهتة كي لا تشد الانتباه — وتتضح عند التحويم
        isDone && 'opacity-60 hover:opacity-100',
      )}
      style={{ borderInlineStartColor: isDone ? '#e2e8f0' : task.color || '#e2e8f0' }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation() // لا يفتح نافذة التعديل — هذا زر دورة الحالة
          if (next) onStatusChange(next)
        }}
        disabled={!next}
        title={
          next
            ? `${STATUS_LABELS[task.status]} — انقر للنقل إلى «${STATUS_LABELS[next]}»`
            : STATUS_LABELS[task.status]
        }
        className="shrink-0 transition-transform enabled:hover:scale-110"
      >
        <StatusIcon status={task.status} />
      </button>

      <div className="min-w-0 flex-1">
        {/* العنوان على سطرين كحد أقصى — وما زاد يظهر كاملاً في منبثقة عند التحويم */}
        <div className="group/title relative">
          <p
            ref={titleRef}
            className={cn(
              'line-clamp-2 text-sm leading-snug text-slate-800',
              task.is_unread ? 'font-bold' : 'font-medium',
              task.status === 'DONE' && 'text-slate-400 line-through',
            )}
          >
            {task.title}
          </p>
          {titleClamped && (
            <div className="absolute start-0 top-full z-20 mt-1 hidden w-max max-w-xl rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 shadow-xl group-hover/title:block">
              {task.title}
            </div>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          {/* علم الأولوية — لغير المتوسطة (الافتراضية) لتقليل الضجيج */}
          {task.priority !== 'MEDIUM' && (
            <span
              className="flex items-center gap-0.5"
              title={`الأولوية: ${PRIORITY_LABELS[task.priority]}`}
              style={{ color: PRIORITY_COLORS[task.priority] }}
            >
              <Flag size={12} fill="currentColor" />
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {/* شارة الاستحقاق — حمراء عند التأخر */}
          {task.due_date && (
            <span
              title={overdue ? 'متأخرة عن تاريخ الاستحقاق' : 'تاريخ الاستحقاق'}
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5',
                overdue
                  ? 'bg-red-50 font-bold text-red-600'
                  : isDone
                    ? 'bg-slate-50 text-slate-400'
                    : 'bg-slate-50 text-slate-500',
              )}
            >
              <CalendarDays size={12} />
              {formatDay(task.due_date)}
              {overdue && ' — متأخرة'}
            </span>
          )}
          {showProject && (
            <Link
              to={`/projects/${task.project}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-100"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: task.project_color }}
              />
              {task.project_title}
            </Link>
          )}
          {task.assignees.length > 0 && (
            <span className="flex items-center ps-1">
              {task.assignees.slice(0, 3).map((assignee) => (
                <Avatar key={assignee.id} user={assignee} size={18} className="-ms-1 ring-1 ring-white" />
              ))}
              {task.assignees.length > 3 && (
                <span className="ms-1 text-[10px]">+{task.assignees.length - 3}</span>
              )}
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">
              #{tag}
            </span>
          ))}
          <span>{formatDate(task.created_at)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenComments()
          }}
          className="relative flex items-center gap-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          title={task.has_unread_comments ? 'تعليقات غير مقروءة' : 'التعليقات'}
        >
          <MessageCircle size={15} />
          {task.comments_count > 0 && <span className="text-xs">{task.comments_count}</span>}
          {/* نقطة حمراء عند وجود تعليقات من الآخرين لم تُقرأ بعد */}
          {task.has_unread_comments && (
            <span className="absolute end-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
        {canManage && onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-blue-600 group-hover:opacity-100"
            title="تعديل المهمة"
          >
            <Pencil size={15} />
          </button>
        )}
        {canManage && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100"
            title="حذف المهمة"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
