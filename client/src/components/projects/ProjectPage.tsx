import {
  Archive, ArchiveRestore, Check, ChevronDown, ChevronUp, Eye, FileOutput,
  FileSpreadsheet, Folder, FolderDown, Pencil, Plus, Save, Trash2, Undo2,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { useArchivedProjects, useProjectMutations, useProjects } from '../../hooks/useProjects'
import { useMarkTasksSeen, useTaskMutations, useTasks } from '../../hooks/useTasks'
import { cn, externalHref, formatDate, stripHtml } from '../../lib/utils'
import { displayName, type Project, type Task } from '../../types'
import { RichTextEditor } from '../editor/RichTextEditor'
import { TaskCard } from '../tasks/TaskCard'
import { TaskCommentsModal } from '../tasks/TaskCommentsModal'
import { TaskFormModal } from '../tasks/TaskFormModal'
import { Lightbox } from '../ui/Lightbox'
import { Tooltip } from '../ui/Tooltip'
import { AttachmentsSection } from './AttachmentsSection'
import { ProjectFormModal } from './ProjectFormModal'
import { UpdatesSection } from './UpdatesSection'

export function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  // معامل focus من الإشعارات: "task-12" أو "details" أو "updates"
  const [searchParams, setSearchParams] = useSearchParams()
  const focus = searchParams.get('focus')

  const { data: me } = useMe()
  const isManager = !!me?.is_manager

  const { data: projects = [], isLoading, isError } = useProjects()
  // المشروع المؤرشف لا يرد في القائمة الافتراضية — يُبحث عنه في الأرشيف أيضاً
  // (endpoint الأرشيف للمدير فقط)
  const { data: archivedProjects = [] } = useArchivedProjects(isManager)
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const projectMutations = useProjectMutations()
  const taskMutations = useTaskMutations()

  const [editingProject, setEditingProject] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | 'new' | null>(null)
  const [commentsTask, setCommentsTask] = useState<Task | null>(null)

  const project =
    projects.find((p) => p.id === Number(projectId)) ??
    archivedProjects.find((p) => p.id === Number(projectId))
  const projectTasks = tasks.filter((t) => t.project === Number(projectId))

  // مهام المشروع المعروضة تُعلَّم مقروءةً (تُميَّز صفراء حتى المغادرة)
  useMarkTasksSeen(projectTasks)

  // التمرير إلى العنصر المستهدف القادم من إشعار، ثم تنظيف الرابط بعد انتهاء الوميض
  useEffect(() => {
    if (!focus || isLoading || tasksLoading) return
    const elementId =
      focus === 'details' ? 'project-details' : focus === 'updates' ? 'project-updates' : focus
    const scrollTimer = setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    const cleanTimer = setTimeout(() => setSearchParams({}, { replace: true }), 4000)
    return () => {
      clearTimeout(scrollTimer)
      clearTimeout(cleanTimer)
    }
  }, [focus, isLoading, tasksLoading, setSearchParams])

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

  const handleArchiveProject = () => {
    if (!confirm(`أرشفة مشروع «${project.title}»؟ يخرج من القوائم اليومية ويبقى سجله كاملاً في «الأرشيف».`))
      return
    projectMutations.archive.mutate(project.id)
  }

  const handleDeleteTask = (task: Task) => {
    if (!confirm(`نقل مهمة «${task.title}» إلى المحذوفات؟ يمكنك استعادتها أو حذفها نهائياً من هناك.`))
      return
    taskMutations.remove.mutate(task.id)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      {/* ترويسة المشروع */}
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className="min-w-0 truncate text-2xl font-bold text-slate-900">{project.title}</h1>
          {/* روابط المشروع السريعة — كل أيقونة تفتح رابطها في تبويب جديد */}
          {(
            [
              {
                link: project.share_link,
                label: 'فتح مجلد ملفات المشروع',
                icon: <Folder size={21} className="text-amber-600" />,
              },
              {
                link: project.outgoing_link,
                label: 'ملف الصادر (Google Docs)',
                icon: <FileOutput size={21} className="text-blue-600" />,
              },
              {
                link: project.accounts_link,
                label: 'ملف الحسابات (Google Sheets)',
                icon: <FileSpreadsheet size={21} className="text-emerald-600" />,
              },
              {
                link: project.incoming_link,
                label: 'مجلد الواردة (Google Drive)',
                icon: <FolderDown size={21} className="text-violet-600" />,
              },
            ] as const
          )
            .filter((item) => item.link)
            .map((item) => (
              <Tooltip
                key={item.label}
                className="shrink-0"
                label={
                  <>
                    <span className="block font-medium">{item.label}</span>
                    <span className="block break-all text-slate-300" dir="ltr">
                      {item.link}
                    </span>
                  </>
                }
              >
                <a
                  href={externalHref(item.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-1.5 transition-transform hover:scale-110 hover:bg-slate-100"
                >
                  {item.icon}
                </a>
              </Tooltip>
            ))}
          <div className="flex-1" />
          {isManager && (
            <>
              <button
                onClick={() => setEditingProject(true)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                title="تعديل المشروع"
              >
                <Pencil size={17} />
              </button>
              {!project.archived_at && (
                <button
                  onClick={handleArchiveProject}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                  title="أرشفة المشروع (منتهٍ — يخرج من القوائم اليومية)"
                >
                  <Archive size={17} />
                </button>
              )}
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

        {/* شريط الحالة عند كون المشروع مؤرشفاً */}
        {project.archived_at && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Archive size={14} className="shrink-0" />
            <span className="min-w-0 flex-1">
              مشروع مؤرشف منذ {formatDate(project.archived_at)} — لا يظهر في القوائم اليومية
              وسجله محفوظ كاملاً.
            </span>
            {isManager && (
              <button
                onClick={() => projectMutations.unarchive.mutate(project.id)}
                disabled={projectMutations.unarchive.isPending}
                className="flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 font-medium hover:bg-amber-100 disabled:opacity-50"
              >
                <ArchiveRestore size={13} />
                إعادة من الأرشيف
              </button>
            )}
          </div>
        )}
      </header>

      {/* التفاصيل الفنية — key يعيد ضبط وضع التحرير عند تبديل المشروع.
          التحديثات قسم فرعي داخلها يظهر عند النقر على «عرض المزيد» */}
      <DetailsSection key={project.id} project={project} canManage={isManager} focus={focus}>
        <UpdatesSection projectId={project.id} />
      </DetailsSection>

      {/* المهام */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-700">
            المهام <span className="text-sm font-normal text-slate-400">({projectTasks.length})</span>
          </h2>
          <button
            onClick={() => setEditingTask('new')}
            title={isManager ? undefined : 'اقتراح مهمة تُعرض على المدير للاعتماد'}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={15} />
            {isManager ? 'مهمة جديدة' : 'اقتراح مهمة'}
          </button>
        </div>
        <div className="space-y-2">
          {projectTasks.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              لا توجد مهام في هذا المشروع بعد
            </p>
          )}
          {projectTasks.map((task) => (
            // الغلاف يحمل مرساة التمرير ووميض الاستهداف القادمين من الإشعارات
            <div
              key={task.id}
              id={`task-${task.id}`}
              className={cn('rounded-xl', focus === `task-${task.id}` && 'focus-flash')}
            >
              <TaskCard
                task={task}
                canManage={isManager}
                // نقر البطاقة: تعديل للمدير — وتعليقات للموظف (لا صلاحية تعديل له)
                onOpen={() => (isManager ? setEditingTask(task) : setCommentsTask(task))}
                onEdit={() => setEditingTask(task)}
                onDelete={() => handleDeleteTask(task)}
                onOpenComments={() => setCommentsTask(task)}
                onStatusChange={(status) =>
                  taskMutations.update.mutate({ id: task.id, data: { status } })
                }
              />
            </div>
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

/** التفاصيل الفنية: عرض للقراءة (بخلفية شفافة، سطران + «عرض المزيد») افتراضياً.
 *  «عرض المزيد» يوسّع النص ويكشف قسم التحديثات الفرعي (children).
 *  المدير يحرر ويحفظ مباشرة؛ الموظف يحرر ويُحفظ تعديله «للمراجعة»،
 *  ثم يعتمده المدير أو يتراجع لآخر نسخة معتمدة. */
function DetailsSection({
  project, canManage, children, focus,
}: { project: Project; canManage: boolean; children?: ReactNode; focus?: string | null }) {
  const { update, proposeDetails, approveDetails, rejectDetails } = useProjectMutations()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  // الوصول من إشعار «تحديث مشروع» يفتح القسم تلقائياً ليظهر الهدف
  const [expanded, setExpanded] = useState(focus === 'updates')
  const [viewingPending, setViewingPending] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const hasPending = project.has_pending_details
  const showPending = viewingPending && hasPending
  const shownHtml = showPending ? project.pending_details : project.details
  const isEmpty = stripHtml(shownHtml) === ''
  const saving = update.isPending || proposeDetails.isPending

  // عند حسم الاقتراح (اعتماد/تراجع) عُد تلقائياً لعرض النسخة المعتمدة
  useEffect(() => {
    if (!hasPending) setViewingPending(false)
  }, [hasPending])

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
    // خلفية بيضاء (أفتح من خلفية الصفحة slate-50) وإطار ناعم يعزلان
    // التفاصيل الفنية عن بقية الأقسام. وهو مطويٌّ يتصرف الكرت كزر:
    // مؤشر يد + ظل عند التحويم + النقر في أي مكان يوسّعه
    <section
      id="project-details"
      onClick={() => {
        if (!expanded && !editing) setExpanded(true)
      }}
      className={cn(
        'rounded-xl border border-slate-200/70 bg-white p-4 transition-shadow duration-200',
        !expanded && !editing && 'cursor-pointer hover:shadow-lg hover:shadow-slate-200/80',
        // وميض الاستهداف عند الوصول من إشعار «تعديل مقترح»
        focus === 'details' && 'focus-flash',
      )}
    >
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
      ) : (
        <>
          {isEmpty ? (
            <button
              onClick={startEditing}
              className="w-full rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500"
            >
              {canManage
                ? 'لا توجد تفاصيل بعد — انقر لإضافة المواصفات والروابط'
                : 'لا توجد تفاصيل بعد — انقر لاقتراح إضافة (تُعرض على المدير للمراجعة)'}
            </button>
          ) : (
            /* وضع القراءة: سطران افتراضياً بخلفية شفافة بنفس تنسيقات المحرر
               (.rich-text) — وخلفية كهرمانية خفيفة عند عرض النسخة المقترحة.
               النقر على أي صورة داخل المحتوى يكبّرها */
            <div
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (target.tagName === 'IMG') setLightbox((target as HTMLImageElement).src)
              }}
              className={cn(
                'rich-text rich-text-view',
                !expanded && 'line-clamp-2',
                showPending && 'rounded-lg bg-amber-50/60 p-2',
              )}
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: shownHtml }}
            />
          )}

          {/* «عرض المزيد»: يوسّع النص ويكشف قسم التحديثات الفرعي */}
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <ChevronDown size={15} />
              عرض المزيد
            </button>
          )}

          {/* التحديثات — قسم فرعي يظهر فقط بعد «عرض المزيد» */}
          {expanded && children && (
            <div
              id="project-updates"
              className={cn(
                'mt-5 border-s-2 border-slate-200 ps-4',
                // وميض الاستهداف عند الوصول من إشعار «تحديث مشروع»
                focus === 'updates' && 'focus-flash',
              )}
            >
              {children}
            </div>
          )}

          {/* «عرض أقل» أسفل القسم كاملاً (بعد التحديثات) — يطوي كل شيء */}
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="mt-4 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <ChevronUp size={15} />
              عرض أقل
            </button>
          )}
        </>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  )
}
