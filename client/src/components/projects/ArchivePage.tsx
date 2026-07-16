import { Archive, ArchiveRestore } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useArchivedProjects, useProjectMutations } from '../../hooks/useProjects'
import { formatDate } from '../../lib/utils'

/** الأرشيف (للمدير): مشاريع منتهية خارج القوائم اليومية — سجلها كامل
 *  ويمكن فتح صفحتها أو إعادتها للقوائم النشطة. */
export function ArchivePage() {
  const { data: archived = [], isLoading, isError } = useArchivedProjects()
  const { unarchive } = useProjectMutations()

  if (isLoading) return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>
  if (isError)
    return (
      <p className="p-10 text-center text-red-600">
        تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000
      </p>
    )

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-2 flex items-center gap-2">
        <Archive size={20} className="text-slate-400" />
        <h1 className="text-xl font-bold text-slate-900">
          الأرشيف <span className="text-sm font-normal text-slate-400">({archived.length})</span>
        </h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        المشاريع المنتهية — لا تظهر في القوائم اليومية لكن سجلها كامل: افتح صفحة المشروع
        للاستعراض، أو أعده للقوائم النشطة.
      </p>

      {archived.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          الأرشيف فارغ — أرشف المشاريع المنتهية من صفحة المشروع
        </p>
      )}

      <div className="space-y-2">
        {archived.map((project) => (
          <div
            key={project.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <div className="min-w-0 flex-1">
              <Link
                to={`/projects/${project.id}`}
                className="truncate text-sm font-medium text-slate-800 hover:text-blue-600 hover:underline"
              >
                {project.title}
              </Link>
              <p className="text-xs text-slate-400">
                {project.tasks_count} مهمة
                {project.archived_at && ` · أُرشف في ${formatDate(project.archived_at)}`}
              </p>
            </div>
            <button
              onClick={() => unarchive.mutate(project.id)}
              disabled={unarchive.isPending}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
            >
              <ArchiveRestore size={14} />
              إعادة من الأرشيف
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
