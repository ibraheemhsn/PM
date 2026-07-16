import { ListTodo, LogOut, Paperclip, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useMatch, useNavigate } from 'react-router-dom'
import { useAuthMutations, useMe } from '../../hooks/useAuth'
import { useProjectMutations, useProjects } from '../../hooks/useProjects'
import { cn } from '../../lib/utils'
import { displayName, type Project } from '../../types'
import { ProjectFormModal } from '../projects/ProjectFormModal'
import { Avatar } from '../ui/Avatar'
import { NotificationsBell } from './NotificationsBell'

interface SidebarProps {
  onOpenSearch: () => void
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
    isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800',
  )

export function Sidebar({ onOpenSearch }: SidebarProps) {
  const { data: me } = useMe()
  const { logout } = useAuthMutations()
  const { data: projects = [], isLoading } = useProjects()
  const { remove } = useProjectMutations()
  const navigate = useNavigate()
  const currentProject = useMatch('/projects/:projectId')

  // null = مغلق، 'new' = إنشاء، وإلا فهو المشروع الجاري تعديله
  const [editing, setEditing] = useState<Project | 'new' | null>(null)

  if (!me) return null
  const isManager = me.is_manager

  const handleDelete = (project: Project) => {
    if (!confirm(`نقل مشروع «${project.title}» إلى المحذوفات؟ يمكنك استعادته أو حذفه نهائياً من هناك.`))
      return
    remove.mutate(project.id, {
      onSuccess: () => {
        if (currentProject?.params.projectId === String(project.id)) navigate('/tasks')
      },
    })
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-e border-slate-800 bg-slate-900 text-slate-100">
      {/* الترويسة + أيقونة البحث الشامل */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
        <div>
          <h1 className="text-lg font-bold text-white">شركة الفخار</h1>
          <p className="text-xs text-slate-400">لوحة إدارة المشاريع والمهام</p>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <button
            onClick={onOpenSearch}
            title="بحث شامل (K أو Ctrl+K)"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Search size={18} />
          </button>
        </div>
      </div>

      {/* التنقل الرئيسي */}
      <nav className="space-y-0.5 px-3 pt-3">
        <NavLink to="/tasks" className={navLinkClass}>
          <ListTodo size={17} />
          {isManager ? 'جميع المهام' : 'مهامي'}
        </NavLink>
      </nav>

      {/* المشاريع: المدير يرى الكل ويدير؛ الموظف يرى مشاريعه (التي له فيها مهام) */}
      <div className="mt-4 flex items-center justify-between px-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {isManager ? 'المشاريع' : 'مشاريعي'}
        </h2>
        {isManager && (
          <button
            onClick={() => setEditing('new')}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-blue-400"
            title="مشروع جديد"
          >
            <Plus size={17} />
          </button>
        )}
      </div>

      <ul className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {isLoading && <li className="px-3 py-2 text-sm text-slate-500">جارٍ التحميل…</li>}
        {!isLoading && projects.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-500">
            {isManager ? 'لا توجد مشاريع بعد — أضف أول مشروع' : 'لا مشاريع مسندة إليك بعد'}
          </li>
        )}
        {projects.map((project) => (
          <li key={project.id} className="group relative">
            <NavLink
              to={`/projects/${project.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                  isActive
                    ? 'bg-slate-800 font-medium text-white'
                    : 'text-slate-300 hover:bg-slate-800/60',
                )
              }
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="flex-1 truncate">{project.title}</span>
              {/* نقطة حمراء: يوجد جديد غير مقروء (مهمة/تعليق/تحديث) */}
              {project.has_unread && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                  title="يوجد جديد غير مقروء"
                />
              )}
              <span
                className={cn(
                  'text-xs text-slate-500',
                  isManager && 'group-hover:hidden',
                )}
              >
                {project.tasks_count}
              </span>
            </NavLink>
            {/* أزرار التعديل والحذف (للمدير) تظهر عند التحويم */}
            {isManager && (
              <div className="absolute end-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                <button
                  onClick={() => setEditing(project)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-blue-400"
                  title="تعديل"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(project)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-red-400"
                  title="حذف"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* كل المرفقات + سلة المحذوفات (للمدير فقط) */}
      {isManager && (
        <nav className="space-y-0.5 border-t border-slate-800 px-3 py-2">
          <NavLink
            to="/attachments"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800',
              )
            }
          >
            <Paperclip size={16} />
            كل المرفقات
          </NavLink>
          <NavLink
            to="/trash"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800',
              )
            }
          >
            <Trash2 size={16} />
            المحذوفات
          </NavLink>
        </nav>
      )}

      {/* المستخدم الحالي + إدارة الموظفين + تسجيل الخروج */}
      <div className="flex items-center gap-2.5 border-t border-slate-800 px-4 py-3">
        <Avatar user={me} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{displayName(me)}</p>
          <p className="text-[11px] text-slate-500">{isManager ? 'مدير' : 'موظف'}</p>
        </div>
        {isManager && (
          <NavLink
            to="/employees"
            title="الموظفون"
            className={({ isActive }) =>
              cn(
                'rounded-lg p-1.5',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-blue-400',
              )
            }
          >
            <Users size={16} />
          </NavLink>
        )}
        <button
          onClick={() => logout.mutate()}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
          title="تسجيل الخروج"
        >
          <LogOut size={16} />
        </button>
      </div>

      {editing && (
        <ProjectFormModal
          project={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </aside>
  )
}
