import { RotateCcw, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useProjectMutations, useProjectUpdateMutations, useTrashedProjects, useTrashedUpdates } from '../../hooks/useProjects'
import { useTaskMutations, useTrashedTasks } from '../../hooks/useTasks'
import { formatDate } from '../../lib/utils'
import { displayName, type Project, type ProjectUpdate, type Task } from '../../types'
import { StatusIcon } from '../tasks/StatusIcon'

/** سلة المحذوفات (للمدير): المشاريع والمهام والتحديثات المحذوفة ناعماً —
 *  استعادة أو حذف نهائي لكل عنصر. */
export function TrashPage() {
  const projectsQuery = useTrashedProjects()
  const tasksQuery = useTrashedTasks()
  const updatesQuery = useTrashedUpdates()

  const projectMutations = useProjectMutations()
  const taskMutations = useTaskMutations()
  const updateMutations = useProjectUpdateMutations()

  const projects = projectsQuery.data ?? []
  const tasks = tasksQuery.data ?? []
  const updates = updatesQuery.data ?? []
  const total = projects.length + tasks.length + updates.length

  const handlePurgeProject = (project: Project) => {
    if (
      !confirm(
        `حذف نهائي لمشروع «${project.title}»؟\nسيُحذف المشروع بكل مهامه وتحديثاته ولا يمكن التراجع.`,
      )
    )
      return
    projectMutations.purge.mutate(project.id)
  }

  const handlePurgeTask = (task: Task) => {
    if (!confirm(`حذف نهائي لمهمة «${task.title}»؟\nستُحذف بتعليقاتها ولا يمكن التراجع.`)) return
    taskMutations.purge.mutate(task.id)
  }

  const handlePurgeUpdate = (update: ProjectUpdate) => {
    if (!confirm('حذف نهائي لهذا التحديث؟ لا يمكن التراجع.')) return
    updateMutations.purge.mutate(update.id)
  }

  if (projectsQuery.isLoading || tasksQuery.isLoading || updatesQuery.isLoading)
    return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>
  if (projectsQuery.isError || tasksQuery.isError || updatesQuery.isError)
    return (
      <p className="p-10 text-center text-red-600">
        تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000
      </p>
    )

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-2 flex items-center gap-2">
        <Trash2 size={20} className="text-slate-400" />
        <h1 className="text-xl font-bold text-slate-900">
          المحذوفات <span className="text-sm font-normal text-slate-400">({total})</span>
        </h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        المشاريع والمهام والتحديثات هنا لا تظهر في اللوحة — يمكنك استعادتها أو حذفها نهائياً.
      </p>

      {total === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          سلة المحذوفات فارغة
        </p>
      )}

      {/* المشاريع */}
      {projects.length > 0 && (
        <TrashSection title="المشاريع" count={projects.length}>
          {projects.map((project) => (
            <TrashRow
              key={`project-${project.id}`}
              icon={
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
              }
              title={project.title}
              subtitle={`${project.tasks_count} مهمة${
                project.deleted_at ? ` · حُذف في ${formatDate(project.deleted_at)}` : ''
              }`}
              restorePending={projectMutations.restore.isPending}
              purgePending={projectMutations.purge.isPending}
              onRestore={() => projectMutations.restore.mutate(project.id)}
              onPurge={() => handlePurgeProject(project)}
            />
          ))}
        </TrashSection>
      )}

      {/* المهام */}
      {tasks.length > 0 && (
        <TrashSection title="المهام" count={tasks.length}>
          {tasks.map((task) => (
            <TrashRow
              key={`task-${task.id}`}
              icon={<StatusIcon status={task.status} size={17} />}
              title={task.title}
              subtitle={`مشروع «${task.project_title}»${
                task.deleted_at ? ` · حُذفت في ${formatDate(task.deleted_at)}` : ''
              }`}
              restorePending={taskMutations.restore.isPending}
              purgePending={taskMutations.purge.isPending}
              onRestore={() => taskMutations.restore.mutate(task.id)}
              onPurge={() => handlePurgeTask(task)}
            />
          ))}
        </TrashSection>
      )}

      {/* التحديثات */}
      {updates.length > 0 && (
        <TrashSection title="التحديثات" count={updates.length}>
          {updates.map((update) => (
            <TrashRow
              key={`update-${update.id}`}
              icon={
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: update.project_color }}
                />
              }
              title={update.body}
              subtitle={`مشروع «${update.project_title}»${
                update.author ? ` · كتبه ${displayName(update.author)}` : ''
              }${update.deleted_at ? ` · حُذف في ${formatDate(update.deleted_at)}` : ''}`}
              restorePending={updateMutations.restore.isPending}
              purgePending={updateMutations.purge.isPending}
              onRestore={() => updateMutations.restore.mutate(update.id)}
              onPurge={() => handlePurgeUpdate(update)}
            />
          ))}
        </TrashSection>
      )}
    </div>
  )
}

function TrashSection({
  title, count, children,
}: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-bold text-slate-500">
        {title} <span className="font-normal text-slate-400">({count})</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function TrashRow({
  icon, title, subtitle, restorePending, purgePending, onRestore, onPurge,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  restorePending: boolean
  purgePending: boolean
  onRestore: () => void
  onPurge: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{title}</p>
        <p className="truncate text-xs text-slate-400">{subtitle}</p>
      </div>
      <button
        onClick={onRestore}
        disabled={restorePending}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
      >
        <RotateCcw size={14} />
        استعادة
      </button>
      <button
        onClick={onPurge}
        disabled={purgePending}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        <Trash2 size={14} />
        حذف نهائي
      </button>
    </div>
  )
}
