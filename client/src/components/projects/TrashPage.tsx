import { RotateCcw, Trash2 } from 'lucide-react'
import { useProjectMutations, useTrashedProjects } from '../../hooks/useProjects'
import { formatDate } from '../../lib/utils'
import type { Project } from '../../types'

/** سلة المحذوفات (للمدير): استعادة المشروع أو حذفه نهائياً. */
export function TrashPage() {
  const { data: trashed = [], isLoading, isError } = useTrashedProjects()
  const { restore, purge } = useProjectMutations()

  const handleRestore = (project: Project) => {
    restore.mutate(project.id)
  }

  const handlePurge = (project: Project) => {
    if (
      !confirm(
        `حذف نهائي لمشروع «${project.title}»؟\nسيُحذف المشروع بكل مهامه وتحديثاته ولا يمكن التراجع.`,
      )
    )
      return
    purge.mutate(project.id)
  }

  if (isLoading) return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>
  if (isError)
    return (
      <p className="p-10 text-center text-red-600">
        تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000
      </p>
    )

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-2 flex items-center gap-2">
        <Trash2 size={20} className="text-slate-400" />
        <h1 className="text-xl font-bold text-slate-900">
          المحذوفات <span className="text-sm font-normal text-slate-400">({trashed.length})</span>
        </h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        المشاريع هنا لا تظهر في اللوحة ولا تظهر مهامها — يمكنك استعادتها أو حذفها نهائياً.
      </p>

      {trashed.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          سلة المحذوفات فارغة
        </p>
      )}

      <div className="space-y-2">
        {trashed.map((project) => (
          <div
            key={project.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{project.title}</p>
              <p className="text-xs text-slate-400">
                {project.tasks_count} مهمة
                {project.deleted_at && ` · حُذف في ${formatDate(project.deleted_at)}`}
              </p>
            </div>
            <button
              onClick={() => handleRestore(project)}
              disabled={restore.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
            >
              <RotateCcw size={14} />
              استعادة
            </button>
            <button
              onClick={() => handlePurge(project)}
              disabled={purge.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={14} />
              حذف نهائي
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
