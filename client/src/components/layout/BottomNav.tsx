import { FolderKanban, LayoutDashboard, ListTodo, Search } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'

/** شريط التنقل السفلي — للجوال فقط (يختفي على الشاشات الكبيرة).
 *  عائم دائري الحواف، ويصبح شبه شفاف أثناء تمرير الصفحة (dimmed)
 *  ليكشف المحتوى خلفه، ثم يعود معتماً عند توقف التمرير.
 *  الرئيسية → لوحة الإحصائيات (توجَّه للمهام تلقائياً لغير المدير)،
 *  والبحث يفتح نافذة البحث الشامل فوراً. */
export function BottomNav({
  onOpenSearch,
  dimmed = false,
}: {
  onOpenSearch: () => void
  /** أثناء التمرير: شفافية جزئية */
  dimmed?: boolean
}) {
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
      isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200',
    )

  return (
    <nav
      className={cn(
        'fixed inset-x-4 z-30 grid grid-cols-4 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-lg shadow-slate-900/30 backdrop-blur transition-opacity duration-300 lg:hidden',
        'bottom-[max(1rem,env(safe-area-inset-bottom))]',
        dimmed && 'opacity-40',
      )}
      aria-label="التنقل السفلي"
    >
      <NavLink to="/dashboard" className={itemClass}>
        <LayoutDashboard size={20} />
        الرئيسية
      </NavLink>
      <NavLink to="/projects" end className={itemClass}>
        <FolderKanban size={20} />
        المشاريع
      </NavLink>
      <NavLink to="/tasks" className={itemClass}>
        <ListTodo size={20} />
        المهام
      </NavLink>
      <button
        onClick={onOpenSearch}
        className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-200"
      >
        <Search size={20} />
        البحث
      </button>
    </nav>
  )
}
