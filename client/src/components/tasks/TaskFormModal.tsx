import { X } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMe } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import { useTags, useTaskMutations } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { cn } from '../../lib/utils'
import {
  displayName, PRIORITY_COLORS, PRIORITY_LABELS, RECURRENCE_LABELS,
  STATUS_LABELS, TASK_PRIORITIES, TASK_RECURRENCES, TASK_STATUSES,
  type Task, type TaskPriority, type TaskRecurrence, type TaskStatus,
} from '../../types'
import { Avatar } from '../ui/Avatar'
import { ColorPicker } from '../ui/ColorPicker'
import { Modal } from '../ui/Modal'

interface TaskFormModalProps {
  /** null → إنشاء مهمة جديدة */
  task: Task | null
  /** المشروع الافتراضي عند الإنشاء من صفحة مشروع */
  defaultProjectId?: number
  onClose: () => void
}

export function TaskFormModal({ task, defaultProjectId, onClose }: TaskFormModalProps) {
  const { data: me } = useMe()
  // الموظف يقترح مهمة: الحالة «مقترحة» إجبارياً وبلا إسناد (تُسند إليه تلقائياً)
  const isManager = !!me?.is_manager

  const { data: projects = [] } = useProjects()
  const { data: allTags = [] } = useTags()
  const { data: employees = [] } = useUsers(isManager) // endpoint خاص بالمدير
  const { create, update } = useTaskMutations()

  const [title, setTitle] = useState(task?.title ?? '')
  const [projectId, setProjectId] = useState<number>(task?.project ?? defaultProjectId ?? 0)
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'OPEN')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [recurrence, setRecurrence] = useState<TaskRecurrence>(task?.recurrence ?? 'NONE')
  const [color, setColor] = useState(task?.color ?? '')
  const [tags, setTags] = useState<string[]>(task?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [assignees, setAssignees] = useState<number[]>(task?.assignees.map((a) => a.id) ?? [])

  const saving = create.isPending || update.isPending

  const addTag = (raw: string) => {
    const name = raw.trim().replace(/^#/, '')
    if (name && !tags.includes(name)) setTags([...tags, name])
    setTagInput('')
  }

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    }
  }

  const toggleAssignee = (id: number) => {
    setAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || !projectId || saving) return

    // لا تضيّع وسماً كتبه المستخدم دون ضغط Enter
    const finalTags = tagInput.trim()
      ? [...tags, tagInput.trim().replace(/^#/, '')].filter((t, i, arr) => arr.indexOf(t) === i)
      : tags

    const data = {
      project: projectId,
      title: trimmed,
      // الموظف: «مقترحة» إجبارياً والإسناد له تلقائياً (يفرضهما الخادم أيضاً)
      status: isManager ? status : ('SUGGESTED' as TaskStatus),
      priority,
      due_date: dueDate || null,
      recurrence,
      color,
      tags: finalTags,
      assignees: isManager ? assignees : [],
    }
    if (task) {
      update.mutate({ id: task.id, data }, { onSuccess: onClose })
    } else {
      create.mutate(data, { onSuccess: onClose })
    }
  }

  return (
    <Modal
      title={task ? 'تعديل المهمة' : isManager ? 'مهمة جديدة' : 'اقتراح مهمة'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">عنوان المهمة</label>
          {/* متعدد الأسطر للعناوين الطويلة — Enter يحفظ، وShift+Enter لا يضيف سطراً
              لأن العنوان نص واحد يلتف تلقائياً */}
          <textarea
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            rows={3}
            placeholder="مثال: مراجعة مخططات التمديدات الكهربائية"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-400"
          />
        </div>

        {/* إسناد المهمة لموظف واحد أو أكثر — للمدير فقط */}
        {isManager && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">إسناد إلى</label>
          <div className="flex flex-wrap gap-1.5">
            {employees.length === 0 && (
              <p className="text-xs text-slate-400">
                لا يوجد موظفون بعد — أضفهم من صفحة «الموظفون»
              </p>
            )}
            {employees.map((employee) => (
              <button
                type="button"
                key={employee.id}
                onClick={() => toggleAssignee(employee.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors',
                  assignees.includes(employee.id)
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300',
                )}
              >
                <Avatar user={employee} size={18} />
                {displayName(employee)}
              </button>
            ))}
          </div>
        </div>
        )}

        <div className={cn('grid gap-3', isManager && 'grid-cols-2')}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">المشروع</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
            >
              <option value={0} disabled>
                اختر مشروعاً
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          {isManager && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">الأولوية</label>
            <div className="flex gap-1.5">
              {TASK_PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors',
                    priority === p
                      ? 'border-blue-600 bg-blue-50 font-medium text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300',
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLORS[p] }}
                  />
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              يُنجز قبل <span className="text-xs font-normal text-slate-400">(اختياري)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">التكرار</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
            >
              {TASK_RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABELS[r]}
                </option>
              ))}
            </select>
            {recurrence !== 'NONE' && (
              <p className="mt-1 text-[11px] text-slate-400">
                عند إنجازها تُنشأ الدورة التالية تلقائياً باستحقاق مُرحَّل.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">لون المهمة</label>
          <ColorPicker value={color} onChange={setColor} allowNone />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">الوسوم</label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 p-2 focus-within:border-blue-400">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  className="hover:text-blue-900"
                  aria-label={`إزالة وسم ${tag}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              list="tag-suggestions"
              placeholder={tags.length === 0 ? 'أضف وسماً واضغط Enter' : ''}
              className="min-w-[120px] flex-1 text-sm outline-none placeholder:text-slate-400"
            />
            <datalist id="tag-suggestions">
              {allTags
                .filter((t) => !tags.includes(t.name))
                .map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
            </datalist>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !projectId || saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? 'جارٍ الحفظ…'
              : task
                ? 'حفظ التعديلات'
                : isManager
                  ? 'إضافة المهمة'
                  : 'إرسال الاقتراح (تُعرض على المدير للاعتماد)'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
