import { CalendarDays, Flag, MessageCircle, Pencil, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn, formatDay } from '../../lib/utils'
import {
  isTaskOverdue, PRIORITY_COLORS, PRIORITY_LABELS, RECURRENCE_LABELS,
  STATUS_LABELS, TASK_STATUSES, type Task, type TaskStatus,
} from '../../types'
import { Avatar } from '../ui/Avatar'
import { StatusIcon } from './StatusIcon'

interface KanbanBoardProps {
  tasks: Task[]
  /** المدير: سحب لأي عمود + تعديل/حذف؛ الموظف: «قيد الإنجاز» و«قيد المراجعة» فقط */
  canManage: boolean
  /** النقر على جسم البطاقة (خارج الأزرار الداخلية) */
  onOpen: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onOpenComments: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
}

/** لوحة كانبان: عمود لكل حالة، والسحب والإفلات بينها يغيّر حالة المهمة.
 *  نفس قيود الصلاحيات المفروضة على الخادم تنعكس على أهداف الإفلات. */
export function KanbanBoard({
  tasks, canManage, onOpen, onEdit, onDelete, onOpenComments, onStatusChange,
}: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)

  const dragged = tasks.find((t) => t.id === draggedId) ?? null
  const allowedTargets: readonly TaskStatus[] = canManage
    ? TASK_STATUSES
    : ['IN_PROGRESS', 'REVIEW']

  const endDrag = () => {
    setDraggedId(null)
    setDragOverColumn(null)
  }

  return (
    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-5">
      {TASK_STATUSES.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status)
        const canDrop =
          dragged !== null &&
          dragged.status !== status &&
          allowedTargets.includes(status) &&
          // المهمة المقترحة لا يحركها إلا المدير (اعتمادها بسحبها إلى عمود آخر)
          (canManage || dragged.status !== 'SUGGESTED')

        return (
          <div
            key={status}
            onDragOver={(e) => {
              if (canDrop) {
                e.preventDefault() // يسمح بالإفلات
                setDragOverColumn(status)
              }
            }}
            onDragLeave={() => setDragOverColumn((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              if (dragged && canDrop) onStatusChange(dragged, status)
              endDrag()
            }}
            className={cn(
              'min-h-[220px] rounded-xl border border-slate-200/70 bg-slate-100/60 p-2.5 transition-colors',
              dragOverColumn === status && 'border-blue-400 bg-blue-50/70 ring-1 ring-blue-300',
              // أثناء السحب: عتّم الأعمدة غير المسموح الإفلات فيها
              dragged && !canDrop && dragged.status !== status && 'opacity-50',
            )}
          >
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <StatusIcon status={status} size={15} />
              <h3 className="text-sm font-bold text-slate-700">{STATUS_LABELS[status]}</h3>
              <span className="ms-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">
                {columnTasks.length}
              </span>
            </div>

            <div className="space-y-2">
              {columnTasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                  {dragOverColumn === status ? 'أفلت هنا' : 'لا مهام'}
                </p>
              )}
              {columnTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isDragging={draggedId === task.id}
                  canManage={canManage}
                  onDragStart={() => setDraggedId(task.id)}
                  onDragEnd={endDrag}
                  onOpen={() => onOpen(task)}
                  onEdit={() => onEdit(task)}
                  onDelete={() => onDelete(task)}
                  onOpenComments={() => onOpenComments(task)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({
  task, isDragging, canManage, onDragStart, onDragEnd, onOpen, onEdit, onDelete, onOpenComments,
}: {
  task: Task
  isDragging: boolean
  canManage: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenComments: () => void
}) {
  const overdue = isTaskOverdue(task)
  const isDone = task.status === 'DONE'
  // المقترحة لا يحركها إلا المدير — سحبها هو طريقة اعتمادها
  const draggable = canManage || task.status !== 'SUGGESTED'

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      // النقر (بلا سحب) يفتح البوب اب — السحب الفعلي لا يطلق حدث النقر
      onClick={onOpen}
      className={cn(
        'group rounded-lg border border-slate-200 border-s-4 p-2.5 shadow-sm transition',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        task.is_unread ? 'bg-yellow-50' : 'bg-white',
        isDone && 'opacity-70',
        isDragging && 'opacity-40 ring-2 ring-blue-300',
      )}
      style={{ borderInlineStartColor: task.color || '#e2e8f0' }}
    >
      <p
        className={cn(
          'line-clamp-2 text-sm leading-snug text-slate-800',
          task.is_unread ? 'font-bold' : 'font-medium',
          isDone && 'text-slate-400 line-through',
        )}
      >
        {task.title}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
        {task.priority !== 'MEDIUM' && (
          <span
            className="flex items-center gap-0.5"
            title={`الأولوية: ${PRIORITY_LABELS[task.priority]}`}
            style={{ color: PRIORITY_COLORS[task.priority] }}
          >
            <Flag size={11} fill="currentColor" />
            {PRIORITY_LABELS[task.priority]}
          </span>
        )}
        {task.recurrence !== 'NONE' && (
          <span
            className="flex items-center gap-0.5 text-sky-600"
            title={`مهمة متكررة ${RECURRENCE_LABELS[task.recurrence]}`}
          >
            <Repeat size={11} />
          </span>
        )}
        {task.due_date && (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
              overdue ? 'bg-red-50 font-bold text-red-600' : 'bg-slate-50 text-slate-500',
            )}
          >
            <CalendarDays size={11} />
            {formatDay(task.due_date)}
          </span>
        )}
        <Link
          to={`/projects/${task.project}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 rounded-full bg-slate-50 px-1.5 py-0.5 font-medium text-slate-500 hover:bg-slate-100"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.project_color }} />
          {task.project_title}
        </Link>
      </div>

      <div className="mt-1.5 flex items-center gap-1">
        {task.assignees.length > 0 && (
          <span className="flex items-center">
            {task.assignees.slice(0, 3).map((assignee) => (
              <Avatar key={assignee.id} user={assignee} size={16} className="-ms-1 ring-1 ring-white" />
            ))}
            {task.assignees.length > 3 && (
              <span className="ms-1 text-[10px] text-slate-400">+{task.assignees.length - 3}</span>
            )}
          </span>
        )}
        <span className="flex-1" />
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenComments()
          }}
          className="relative flex items-center gap-0.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          title={task.has_unread_comments ? 'تعليقات غير مقروءة' : 'التعليقات'}
        >
          <MessageCircle size={13} />
          {task.comments_count > 0 && <span className="text-[10px]">{task.comments_count}</span>}
          {task.has_unread_comments && (
            <span className="absolute -end-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          )}
        </button>
        {canManage && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-blue-600 group-hover:opacity-100"
              title="تعديل المهمة"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100"
              title="حذف المهمة"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
