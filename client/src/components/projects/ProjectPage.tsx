import {
  Check, ChevronDown, ChevronUp, Eye, Pencil, Plus, Save, Trash2, Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { useProjectMutations, useProjects } from '../../hooks/useProjects'
import { useTaskMutations, useTasks } from '../../hooks/useTasks'
import { cn, formatDate, stripHtml } from '../../lib/utils'
import { displayName, type Project, type Task } from '../../types'
import { RichTextEditor } from '../editor/RichTextEditor'
import { TaskCard } from '../tasks/TaskCard'
import { TaskCommentsModal } from '../tasks/TaskCommentsModal'
import { TaskFormModal } from '../tasks/TaskFormModal'
import { Lightbox } from '../ui/Lightbox'
import { AttachmentsSection } from './AttachmentsSection'
import { ProjectFormModal } from './ProjectFormModal'
import { UpdatesSection } from './UpdatesSection'

export function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const { data: me } = useMe()
  const isManager = !!me?.is_manager

  const { data: projects = [], isLoading, isError } = useProjects()
  const { data: tasks = [] } = useTasks()
  const projectMutations = useProjectMutations()
  const taskMutations = useTaskMutations()

  const [editingProject, setEditingProject] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | 'new' | null>(null)
  const [commentsTask, setCommentsTask] = useState<Task | null>(null)

  const project = projects.find((p) => p.id === Number(projectId))
  const projectTasks = tasks.filter((t) => t.project === Number(projectId))

  if (isLoading) return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>
  if (isError)
    return (
      <p className="p-10 text-center text-red-600">
        تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000
      </p>
    )
  if (!project) return <p className="p-10 text-center text-slate-400">المشروع غير موجود.</p>

  const handleDeleteProject = () => {
    if (!confirm(`نقل مشروع «${project.title}» إلى المحذوفات؟ يمكنك استعادته أو حذفه نهائياً من هناك.`))
      return
    projectMutations.remove.mutate(project.id, { onSuccess: () => navigate('/tasks') })
  }

  const handleDeleteTask = (task: Task) => {
    if (!confirm(`حذف مهمة «${task.title}»؟`)) return
    taskMutations.remove.mutate(task.id)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      {/* ترويسة المشروع */}
      <header>
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className="flex-1 truncate text-2xl font-bold text-slate-900">{project.title}</h1>
          {isManager && (
            <>
              <button
                onClick={() => setEditingProject(true)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                title="تعديل المشروع"
              >
                <Pencil size={17} />
              </button>
              <button
                onClick={handleDeleteProject}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                title="حذف المشروع"
              >
                <Trash2 size={17} />
              </button>
            </>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          أُنشئ في {formatDate(project.created_at)} · آخر تحديث {formatDate(project.updated_at)}
        </p>
      </header>

      {/* التفاصيل الفنية — key يعيد ضبط وضع التحرير عند تبديل المشروع */}
      <DetailsSection key={project.id} project={project} canManage={isManager} />

      {/* التحديثات: سجل أحداث وإجراءات المشروع */}
      <UpdatesSection projectId={project.id} />

      {/* المهام */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-700">
            المهام <span className="text-sm font-normal text-slate-400">({projectTasks.length})</span>
          </h2>
          {isManager && (
            <button
              onClick={() => setEditingTask('new')}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={15} />
              مهمة جديدة
            </button>
          )}
        </div>
        <div className="space-y-2">
          {projectTasks.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              لا توجد مهام في هذا المشروع بعد
            </p>
          )}
          {projectTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canManage={isManager}
              onEdit={() => setEditingTask(task)}
              onDelete={() => handleDeleteTask(task)}
              onOpenComments={() => setCommentsTask(task)}
              onStatusChange={(status) =>
                taskMutations.update.mutate({ id: task.id, data: { status } })
              }
            />
          ))}
        </div>
      </section>

      {/* المرفقات: صور وPDF وملفات نصية */}
      <AttachmentsSection projectId={project.id} />

      {editingProject && (
        <ProjectFormModal project={project} onClose={() => setEditingProject(false)} />
      )}
      {editingTask && (
        <TaskFormModal
          task={editingTask === 'new' ? null : editingTask}
          defaultProjectId={project.id}
          onClose={() => setEditingTask(null)}
        />
      )}
      {commentsTask && (
        <TaskCommentsModal task={commentsTask} onClose={() => setCommentsTask(null)} />
      )}
    </div>
  )
}

/** التفاصيل الفنية: عرض للقراءة (بخلفية شفافة، 6 أسطر + «عرض المزيد») افتراضياً.
 *  المدير يحرر ويحفظ مباشرة؛ الموظف يحرر ويُحفظ تعديله «للمراجعة»،
 *  ثم يعتمده المدير أو يتراجع لآخر نسخة معتمدة. */
function DetailsSection({ project, canManage }: { project: Project; canManage: boolean }) {
  const { update, proposeDetails, approveDetails, rejectDetails } = useProjectMutations()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const [viewingPending, setViewingPending] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const hasPending = project.has_pending_details
  const showPending = viewingPending && hasPending
  const shownHtml = showPending ? project.pending_details : project.details
  const isEmpty = stripHtml(shownHtml) === ''
  const saving = update.isPending || proposeDetails.isPending

  // عند حسم الاقتراح (اعتماد/تراجع) عُد تلقائياً لعرض النسخة المعتمدة
  useEffect(() => {
    if (!hasPending) setViewingPending(false)
  }, [hasPending])

  // اكتشف ما إذا كان المحتوى أطول من 6 أسطر — عندها فقط يظهر زر «عرض المزيد»
  useEffect(() => {
    if (editing || expanded) return
    const el = contentRef.current
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1)
  }, [shownHtml, editing, expanded])

  const startEditing = () => {
    // الموظف يكمل من آخر اقتراح معلق إن وُجد؛ المدير يحرر النسخة المعتمدة مباشرة
    setDraft(canManage ? project.details : hasPending ? project.pending_details : project.details)
    setEditing(true)
  }

  const save = () => {
    if (canManage) {
      update.mutate(
        { id: project.id, data: { details: draft } },
        { onSuccess: () => setEditing(false) },
      )
    } else {
      proposeDetails.mutate(
        { id: project.id, details: draft },
        {
          onSuccess: () => {
            setEditing(false)
            setViewingPending(true)
          },
        },
      )
    }
  }

  const approve = () => {
    if (!confirm('اعتماد التعديل المقترح ليحل محل النسخة الحالية؟')) return
    approveDetails.mutate(project.id)
  }

  const revert = () => {
    if (!confirm('تجاهل التعديل المقترح والتراجع لآخر نسخة معتمدة؟')) return
    rejectDetails.mutate(project.id)
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold text-slate-700">التفاصيل الفنية</h2>
        {!editing && (
          <button
            onClick={startEditing}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
            title={canManage ? 'تحرير التفاصيل' : 'اقتراح تعديل (يُرسل لمراجعة المدير)'}
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {/* شريط المراجعة عند وجود تعديل مقترح معلق */}
      {hasPending && !editing && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Eye size={14} className="shrink-0" />
          <span className="min-w-0 flex-1">
            تعديل مقترح
            {project.pending_details_by && ` من ${displayName(project.pending_details_by)}`}
            {project.pending_details_at && ` · ${formatDate(project.pending_details_at)}`}
            {' '}— بانتظار مراجعة المدير
          </span>
          <button
            onClick={() => setViewingPending((v) => !v)}
            className="rounded-md border border-amber-300 px-2 py-1 font-medium hover:bg-amber-100"
          >
            {viewingPending ? 'عرض النسخة المعتمدة' : 'عرض التعديل المقترح'}
          </button>
          {canManage && (
            <>
              <button
                onClick={approve}
                disabled={approveDetails.isPending}
                className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check size={13} />
                اعتماد التعديل
              </button>
              <button
                onClick={revert}
                disabled={rejectDetails.isPending}
                className="flex items-center gap-1 rounded-md bg-white px-2 py-1 font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                <Undo2 size={13} />
                التراجع لآخر نسخة
              </button>
            </>
          )}
        </div>
      )}

      {editing ? (
        <>
          <RichTextEditor initialContent={draft} onChange={setDraft} />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'جارٍ الحفظ…' : canManage ? 'حفظ التفاصيل' : 'حفظ للمراجعة'}
            </button>
          </div>
        </>
      ) : isEmpty ? (
        <button
          onClick={startEditing}
          className="w-full rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500"
        >
          {canManage
            ? 'لا توجد تفاصيل بعد — انقر لإضافة المواصفات والروابط'
            : 'لا توجد تفاصيل بعد — انقر لاقتراح إضافة (تُعرض على المدير للمراجعة)'}
        </button>
      ) : (
        <>
          {/* وضع القراءة: خلفية شفافة بنفس تنسيقات المحرر (.rich-text)
              — وخلفية كهرمانية خفيفة عند عرض النسخة المقترحة.
              النقر على أي صورة داخل المحتوى يكبّرها */}
          <div
            ref={contentRef}
            onClick={(e) => {
              const target = e.target as HTMLElement
              if (target.tagName === 'IMG') setLightbox((target as HTMLImageElement).src)
            }}
            className={cn(
              'rich-text rich-text-view',
              !expanded && 'line-clamp-6',
              showPending && 'rounded-lg bg-amber-50/60 p-2',
            )}
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: shownHtml }}
          />
          {(clamped || expanded) && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {expanded ? (
                <>
                  <ChevronUp size={15} />
                  عرض أقل
                </>
              ) : (
                <>
                  <ChevronDown size={15} />
                  عرض المزيد
                </>
              )}
            </button>
          )}
        </>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  )
}
