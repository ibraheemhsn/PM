import { useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays, FileText, Flag, FolderKanban, Paperclip, Repeat,
  SlidersHorizontal, Tag, Trash2, X,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import { useTags, useTaskMutations } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { api } from '../../lib/api'
import { cn, formatFileSize, isImageFile } from '../../lib/utils'
import {
  displayName, PRIORITY_COLORS, PRIORITY_LABELS, RECURRENCE_LABELS,
  STATUS_LABELS, TASK_PRIORITIES, TASK_RECURRENCES, TASK_STATUSES,
  type Task, type TaskPriority, type TaskRecurrence, type TaskStatus,
  type UpdateAttachment,
} from '../../types'
import { Avatar } from '../ui/Avatar'
import { ColorPicker } from '../ui/ColorPicker'
import { Lightbox } from '../ui/Lightbox'
import { Modal } from '../ui/Modal'
import { enterClass, useModalPullNav } from './modalPullNav'
import { StatusIcon } from './StatusIcon'
import { TaskComments } from './TaskComments'

const ATTACH_ACCEPT = 'image/*,.pdf,.txt,.md,.csv'

interface TaskFormModalProps {
  /** null → إنشاء مهمة جديدة */
  task: Task | null
  /** المشروع الافتراضي عند الإنشاء من صفحة مشروع */
  defaultProjectId?: number
  onClose: () => void
  /** التنقل بين المهام بالسحب العمودي (الجوال) — أعلى الصفحة+سحب لأسفل = السابقة */
  onPrev?: () => void
  onNext?: () => void
  /** اتجاه دخول النافذة بعد التنقل — لأنيميشن الانزلاق */
  enterDir?: 'prev' | 'next'
}

export function TaskFormModal({
  task, defaultProjectId, onClose, onPrev, onNext, enterDir,
}: TaskFormModalProps) {
  const { data: me } = useMe()
  // الموظف يقترح مهمة: الحالة «مقترحة» إجبارياً وبلا إسناد (تُسند إليه تلقائياً)
  const isManager = !!me?.is_manager

  const { data: projects = [] } = useProjects()
  const { data: allTags = [] } = useTags()
  const { data: employees = [] } = useUsers(isManager) // endpoint خاص بالمدير
  const { create, update, remove } = useTaskMutations()

  const [title, setTitle] = useState(task?.title ?? '')
  // عند التعديل: العنوان للقراءة فقط حتى يُنقر عليه — يمنع التعديل غير المقصود.
  // عند الإنشاء: الحقل قابل للكتابة فوراً.
  const [titleEditable, setTitleEditable] = useState(!task)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // لحظة تفعيل التحرير: ركّز الحقل وضع مؤشر الكتابة في نهاية العنوان
  useEffect(() => {
    const el = titleRef.current
    if (titleEditable && el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [titleEditable])
  const [projectId, setProjectId] = useState<number>(task?.project ?? defaultProjectId ?? 0)
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'OPEN')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [recurrence, setRecurrence] = useState<TaskRecurrence>(task?.recurrence ?? 'NONE')
  const [color, setColor] = useState(task?.color ?? '')
  const [tags, setTags] = useState<string[]>(task?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [assignees, setAssignees] = useState<number[]>(task?.assignees.map((a) => a.id) ?? [])
  // نافذة مركّزة: عند التعديل تُطوى الحقول خلف «خيارات متقدمة»؛ عند الإنشاء مفتوحة
  const [advancedOpen, setAdvancedOpen] = useState(!task)

  // السحب العمودي داخل النافذة للتنقل بين المهام (الجوال) — كصفحة المشاريع
  const { bodyRef, hints } = useModalPullNav({ onPrev, onNext })

  // مشتقات لسطر الملخّص
  const selectedProject = projects.find((p) => p.id === projectId)
  const assignedUsers = employees.filter((e) => assignees.includes(e.id))

  const saving = create.isPending || update.isPending

  const queryClient = useQueryClient()
  // مرفقات المهمة القائمة (تُرفع فوراً)، وملفات معلّقة للمهمة الجديدة (تُرفع بعد الحفظ)
  const [attachments, setAttachments] = useState<UpdateAttachment[]>(task?.attachments ?? [])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadingAttach, setUploadingAttach] = useState(false)
  const attachInputRef = useRef<HTMLInputElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const invalidateAttachments = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['attachments'] })
  }

  /** رفع ملف إلى مهمة موجودة (بمعرّفها ومشروعها) */
  const uploadToTask = async (taskId: number, projId: number, file: File) => {
    const created = await api.attachments.create(projId, file, '', '', { taskId })
    return {
      id: created.id,
      file: created.file,
      file_name: created.file_name,
      thumbnail: created.thumbnail,
      size: created.size,
    } satisfies UpdateAttachment
  }

  const handlePickFile = async (file: File) => {
    if (task) {
      // مهمة قائمة: ارفع فوراً
      setUploadingAttach(true)
      try {
        const att = await uploadToTask(task.id, task.project, file)
        setAttachments((prev) => [...prev, att])
        invalidateAttachments()
      } catch {
        window.alert('تعذر رفع المرفق — يُسمح بالصور وملفات PDF والملفات النصية.')
      } finally {
        setUploadingAttach(false)
      }
    } else {
      // مهمة جديدة: علّق الملف ليُرفع بعد الحفظ
      setPendingFiles((prev) => [...prev, file])
    }
  }

  const removeAttachment = async (att: UpdateAttachment) => {
    if (!confirm(`حذف مرفق «${att.file_name}»؟`)) return
    try {
      await api.attachments.remove(att.id)
      setAttachments((prev) => prev.filter((a) => a.id !== att.id))
      invalidateAttachments()
    } catch {
      window.alert('تعذر حذف المرفق.')
    }
  }

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

  // حذف المهمة من داخل النافذة — بديل أيقونة الحذف المخفية على الجوال
  const handleDeleteTask = () => {
    if (!task) return
    if (!confirm(`نقل مهمة «${task.title}» إلى المحذوفات؟ يمكنك استعادتها أو حذفها نهائياً من هناك.`))
      return
    remove.mutate(task.id, { onSuccess: onClose })
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
      // بعد إنشاء المهمة: ارفع الملفات المعلّقة (إن وُجدت) ثم أغلق النافذة
      create.mutate(data, {
        onSuccess: async (created) => {
          if (pendingFiles.length > 0) {
            setUploadingAttach(true)
            try {
              for (const file of pendingFiles) {
                await uploadToTask(created.id, created.project, file)
              }
              invalidateAttachments()
            } catch {
              window.alert('أُنشئت المهمة، لكن تعذّر رفع بعض المرفقات.')
            } finally {
              setUploadingAttach(false)
            }
          }
          onClose()
        },
      })
    }
  }

  return (
    <Modal
      title={task ? 'تعديل المهمة' : isManager ? 'مهمة جديدة' : 'اقتراح مهمة'}
      onClose={onClose}
      bodyRef={bodyRef}
    >
      {/* مؤشرا السحب العمودي للتنقل بين المهام (الجوال) */}
      {hints}
      {/* غلاف يحمل أنيميشن دخول الانزلاق عند التنقل بين المهام (~نصف ثانية) */}
      <div className={enterClass(enterDir)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-slate-600">عنوان المهمة</label>
            {/* رابط مباشر لصفحة المشروع (الجوال) — الوصول يميّز المهمة بوميض ثلاثي
                كما عند القدوم من إشعار */}
            {task && selectedProject && (
              <Link
                to={`/projects/${selectedProject.id}?focus=task-${task.id}`}
                onClick={onClose}
                className="flex shrink-0 items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 lg:hidden"
              >
                <FolderKanban size={14} />
                الانتقال إلى المشروع
              </Link>
            )}
          </div>
          {/* متعدد الأسطر للعناوين الطويلة — Enter يحفظ، وShift+Enter لا يضيف سطراً
              لأن العنوان نص واحد يلتف تلقائياً */}
          {titleEditable ? (
            <textarea
              ref={titleRef}
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
          ) : (
            /* عرض للقراءة — النقر يحوّله لحقل كتابة بمؤشر في نهاية العنوان */
            <button
              type="button"
              onClick={() => setTitleEditable(true)}
              title="انقر لتعديل العنوان"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-start text-sm leading-relaxed text-slate-800 hover:border-blue-300 hover:bg-white"
            >
              {title}
            </button>
          )}
        </div>

        {/* سطر ملخّص: أيقونات البارامترات غير الافتراضية — النقر على السطر
            كله يفتح/يخفي الخيارات المتقدمة (مؤشر يد + خلفية عند التحويم) */}
        <div
          onClick={() => setAdvancedOpen((v) => !v)}
          title={advancedOpen ? 'إخفاء الخيارات المتقدمة' : 'إظهار الخيارات المتقدمة'}
          className="-mx-2 flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100"
        >
          {/* الحالة */}
          <span className="flex items-center gap-1" title="الحالة">
            <StatusIcon status={status} size={14} />
            {STATUS_LABELS[status]}
          </span>
          {/* المشروع */}
          {selectedProject && (
            <span className="flex items-center gap-1" title="المشروع">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: selectedProject.color }}
              />
              {selectedProject.title}
            </span>
          )}
          {/* المسندون (غير الافتراضي: يوجد إسناد) */}
          {assignedUsers.length > 0 && (
            <span className="flex items-center gap-1" title="الإسناد">
              {assignedUsers.slice(0, 3).map((u) => (
                <Avatar key={u.id} user={u} size={16} className="ring-1 ring-white" />
              ))}
              {assignedUsers.length > 3 && <span>+{assignedUsers.length - 3}</span>}
            </span>
          )}
          {/* الأولوية (غير المتوسطة) */}
          {priority !== 'MEDIUM' && (
            <span
              className="flex items-center gap-1"
              title="الأولوية"
              style={{ color: PRIORITY_COLORS[priority] }}
            >
              <Flag size={12} fill="currentColor" />
              {PRIORITY_LABELS[priority]}
            </span>
          )}
          {/* تاريخ الاستحقاق */}
          {dueDate && (
            <span className="flex items-center gap-1" title="يُنجز قبل">
              <CalendarDays size={13} />
              {dueDate}
            </span>
          )}
          {/* التكرار (غير بلا تكرار) */}
          {recurrence !== 'NONE' && (
            <span className="flex items-center gap-1 text-sky-600" title="التكرار">
              <Repeat size={12} />
              {RECURRENCE_LABELS[recurrence]}
            </span>
          )}
          {/* اللون */}
          {color && (
            <span
              className="h-3.5 w-3.5 rounded-full ring-1 ring-slate-200"
              title="اللون"
              style={{ backgroundColor: color }}
            />
          )}
          {/* الوسوم */}
          {tags.length > 0 && (
            <span className="flex items-center gap-1 text-blue-600" title="الوسوم">
              <Tag size={12} />
              {tags.length}
            </span>
          )}
          {/* المرفقات */}
          {attachments.length > 0 && (
            <span className="flex items-center gap-1" title="المرفقات">
              <Paperclip size={12} />
              {attachments.length}
            </span>
          )}

          {/* نص إرشادي — النقر يُعالَج على مستوى السطر كله */}
          <span className="ms-auto flex items-center gap-1 font-medium text-blue-600">
            <SlidersHorizontal size={13} />
            {advancedOpen ? 'إخفاء الخيارات' : 'خيارات متقدمة'}
          </span>
        </div>


        {/* الحقول الكاملة — تظهر عند «خيارات متقدمة» */}
        {advancedOpen && (
        <>
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

        <div className={cn('grid gap-3', isManager && 'sm:grid-cols-2')}>
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

        {/* عمود واحد على الجوال (كي لا تتداخل الأولوية والتاريخ)، عمودان على الأوسع */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        {/* المرفقات — تعمل عند الإنشاء (تُرفع بعد الحفظ) وعند التعديل (تُرفع فوراً) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">المرفقات</label>
          <div className="flex flex-wrap items-center gap-2">
            {/* المرفقات المحفوظة (مهمة قائمة) */}
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

            {/* الملفات المعلّقة للمهمة الجديدة — تُرفع بعد الحفظ */}
            {pendingFiles.map((file, index) => (
              <span
                key={`pending-${index}`}
                className="relative flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1.5 text-xs text-blue-700 ring-1 ring-blue-200"
              >
                <Paperclip size={13} />
                <span dir="ltr" className="max-w-32 truncate">{file.name}</span>
                <span className="text-blue-400">({formatFileSize(file.size)})</span>
                <button
                  type="button"
                  onClick={() =>
                    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
                  }
                  title="إزالة"
                  className="rounded-full p-0.5 hover:bg-blue-100"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            <button
              type="button"
              onClick={() => attachInputRef.current?.click()}
              disabled={uploadingAttach}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
            >
              <Paperclip size={13} />
              {uploadingAttach ? 'جارٍ الرفع…' : 'إرفاق ملف'}
            </button>
            <input
              ref={attachInputRef}
              type="file"
              accept={ATTACH_ACCEPT}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void handlePickFile(file)
              }}
              className="hidden"
            />
          </div>
          {!task && pendingFiles.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              تُرفع المرفقات تلقائياً بعد حفظ المهمة.
            </p>
          )}
        </div>
        </>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {/* حذف المهمة (للمدير، عند التعديل) — بديل أيقونة الحذف المخفية على الجوال */}
          {task && isManager ? (
            <button
              type="button"
              onClick={handleDeleteTask}
              disabled={remove.isPending}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={15} />
              {remove.isPending ? 'جارٍ الحذف…' : 'حذف المهمة'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !projectId || saving || uploadingAttach}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving || uploadingAttach
                ? 'جارٍ الحفظ…'
                : task
                  ? 'حفظ التعديلات'
                  : isManager
                    ? 'إضافة المهمة'
                    : 'إرسال الاقتراح (تُعرض على المدير للاعتماد)'}
            </button>
          </div>
        </div>
      </form>

      {/* التعليقات — للمهمة القائمة فقط (تحت حقول التعديل) */}
      {task && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="mb-2 text-sm font-medium text-slate-600">التعليقات</h3>
          <TaskComments task={task} />
        </div>
      )}
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </Modal>
  )
}
