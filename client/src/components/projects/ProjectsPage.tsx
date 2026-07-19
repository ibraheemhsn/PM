import { FolderKanban, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import { arabicToLatinKeys, latinToArabicKeys } from '../../lib/utils'
import { orderProjects } from '../../types'
import { ProjectFormModal } from './ProjectFormModal'

/** صفحة «المشاريع»: قائمة بكل المشاريع المتاحة — وجهة زر المشاريع في
 *  شريط التنقل السفلي على الجوال (وتعمل على الشاشات الكبيرة أيضاً).
 *  الترتيب يتبع ترتيب المستخدم المخصص نفسه المطبق في الشريط الجانبي. */
export function ProjectsPage() {
  const { data: me } = useMe()
  const { data: projects = [], isLoading } = useProjects()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')

  const isManager = !!me?.is_manager
  // بحث ذكي: يطابق العبارة كما كُتبت + تحويلها بين تخطيطي اللوحة العربي/اللاتيني
  // (كتابة «fdzm» تطابق «بيئة» دون تبديل لغة الكيبورد)
  const query = search.trim().toLowerCase()
  const variants = query ? [...new Set([query, latinToArabicKeys(query), arabicToLatinKeys(query)])] : []
  const ordered = orderProjects(projects, me?.project_order ?? []).filter(
    (p) => !query || variants.some((v) => p.title.toLowerCase().includes(v)),
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <FolderKanban size={22} className="text-blue-600" />
          المشاريع
          <span className="text-sm font-normal text-slate-400">({projects.length})</span>
        </h1>
        {isManager && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={15} />
            مشروع جديد
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="تصفية المشاريع…"
        className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />

      <div className="space-y-2">
        {isLoading && <p className="py-8 text-center text-sm text-slate-400">جارٍ التحميل…</p>}
        {!isLoading && ordered.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            {projects.length === 0 ? 'لا توجد مشاريع بعد' : 'لا نتائج مطابقة'}
          </p>
        )}
        {ordered.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="flex items-center gap-3 rounded-xl border border-slate-200 border-s-4 bg-white px-4 py-3.5 shadow-sm transition hover:shadow"
            style={{ borderInlineStartColor: project.color }}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-slate-800">{project.title}</span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {project.tasks_count} مهمة
              </span>
            </span>
            {/* يوجد جديد لم يقرأه المستخدم — نفس مؤشر الشريط الجانبي */}
            {project.has_unread && (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" title="يوجد جديد" />
            )}
          </Link>
        ))}
      </div>

      {creating && <ProjectFormModal project={null} onClose={() => setCreating(false)} />}
    </div>
  )
}
