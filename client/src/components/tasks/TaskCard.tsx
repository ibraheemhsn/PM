import {
  CalendarDays, Check, CheckCheck, Flag, MessageCircle, Pencil, Repeat, Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn, formatDate, formatDay } from '../../lib/utils'
import {
  EMPLOYEE_STATUS_FLOW, isTaskOverdue, PRIORITY_COLORS, PRIORITY_LABELS,
  RECURRENCE_LABELS, STATUS_LABELS, TASK_STATUSES, type Task, type TaskStatus,
} from '../../types'
import { Avatar } from '../ui/Avatar'
import { StatusIcon } from './StatusIcon'

/** الحالات المسموح الانتقال إليها حسب الدور — القيود مفروضة على الخادم أيضاً:
 *  المدير: كل الحالات؛ الموظف: بالاتجاهين بين حالاته الأربع فقط،
 *  ولا يلمس «مقترحة» (بانتظار الاعتماد) ولا «منجزة» (مغلقة). */
function allowedTargets(task: Task, canManage: boolean): TaskStatus[] {
  if (canManage) return TASK_STATUSES.filter((s) => s !== task.status)
  if (!EMPLOYEE_STATUS_FLOW.includes(task.status)) return []
  return EMPLOYEE_STATUS_FLOW.filter((s) => s !== task.status)
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
  const targets = allowedTargets(task, canManage)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const isDone = task.status === 'DONE'
  const overdue = isTaskOverdue(task)

  const changeStatus = (status: TaskStatus) => {
    setStatusMenuOpen(false)
    onStatusChange(status)
  }

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
      {/* أيقونة الحالة تفتح قائمة منسدلة بالحالات المسموحة حسب الدور */}
      <div className="relative shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation() // لا يفتح نافذة التعديل — هذا زر تغيير الحالة
            if (targets.length) setStatusMenuOpen((v) => !v)
          }}
          disabled={targets.length === 0}
          title={
            targets.length
              ? `${STATUS_LABELS[task.status]} — انقر لتغيير الحالة`
              : STATUS_LABELS[task.status]
          }
          className="transition-transform enabled:hover:scale-110"
        >
          <StatusIcon status={task.status} />
        </button>
        {statusMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={(e) => {
                e.stopPropagation()
                setStatusMenuOpen(false)
              }}
            />
            <div
              className="absolute start-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {targets.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <StatusIcon status={s} size={15} />
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

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
          {/* مهمة متكررة — إنجازها ينشئ الدورة التالية */}
          {task.recurrence !== 'NONE' && (
            <span
              className="flex items-center gap-0.5 text-sky-600"
              title={`مهمة متكررة ${RECURRENCE_LABELS[task.recurrence]} — إنجازها ينشئ الدورة التالية`}
            >
              <Repeat size={12} />
              {RECURRENCE_LABELS[task.recurrence]}
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
            /* على الجوال: الشارة غير قابلة للنقر — النقرة تمر لجسم البطاقة
               فتفتح نافذة المهمة (تجنباً للنقر الخاطئ على العناصر الصغيرة) */
            <Link
              // focus يمرّر صفحة المشروع إلى المهمة ويميّزها بوميض ثلاثي
              to={`/projects/${task.project}?focus=task-${task.id}`}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-none flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-100 lg:pointer-events-auto"
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
        {/* أزرار المدير المخصصة: اعتماد المقترحة وإغلاق التي بانتظار المراجعة
            — مخفية على الجوال (الإجراء من داخل نافذة المهمة) */}
        {canManage && task.status === 'SUGGESTED' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              changeStatus('OPEN')
            }}
            className="hidden items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 lg:flex"
            title="اعتماد المهمة المقترحة — تصبح «مفتوحة»"
          >
            <Check size={13} />
            اعتماد المهمة
          </button>
        )}
        {canManage && task.status === 'REVIEW' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              changeStatus('DONE')
            }}
            className="hidden items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 lg:flex"
            title="إغلاق المهمة نهائياً — تصبح «منجزة»"
          >
            <CheckCheck size={13} />
            إغلاق المهمة
          </button>
        )}
        {/* أيقونة التعليقات: على الجوال تختفي إن لم توجد تعليقات، والنقرة
            تمر لجسم البطاقة (النافذة تعرض التعليقات داخلها) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenComments()
          }}
          className={cn(
            'pointer-events-none relative flex items-center gap-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 lg:pointer-events-auto',
            task.comments_count === 0 && 'hidden lg:flex',
          )}
          title={task.has_unread_comments ? 'تعليقات غير مقروءة' : 'التعليقات'}
        >
          <MessageCircle size={15} />
          {task.comments_count > 0 && <span className="text-xs">{task.comments_count}</span>}
          {/* نقطة حمراء عند وجود تعليقات من الآخرين لم تُقرأ بعد */}
          {task.has_unread_comments && (
            <span className="absolute end-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
        {/* التعديل والحذف: مخفيان دائماً على الجوال — الحذف من داخل النافذة */}
        {canManage && onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="hidden rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-blue-600 group-hover:opacity-100 lg:block"
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
            className="hidden rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 lg:block"
            title="حذف المهمة"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
