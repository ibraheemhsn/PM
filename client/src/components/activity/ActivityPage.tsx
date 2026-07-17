import { ArrowDownWideNarrow, ArrowUpNarrowWide, FilterX, History, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAllActivity, useProjects } from '../../hooks/useProjects'
import { cn, formatDate } from '../../lib/utils'
import { displayName, type UserBrief } from '../../types'
import { Avatar } from '../ui/Avatar'

type SortDirection = 'desc' | 'asc'

/** سجل النشاطات الموحد: آخر 300 حدث عبر كل المشاريع (الموظف: مشاريعه فقط)
 *  مع بحث نصي وفلترة بالمشروع والمستخدم وفرز زمني. */
export function ActivityPage() {
  const { data: activities = [], isLoading, isError } = useAllActivity()
  const { data: projects = [] } = useProjects()

  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<number | 'all'>('all')
  const [actorFilter, setActorFilter] = useState<number | 'all'>('all')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const hasActiveFilters =
    query.trim() !== '' || projectFilter !== 'all' || actorFilter !== 'all'

  // قائمة الفاعلين تُشتق من السجل نفسه (لا تحتاج endpoint الموظفين الخاص بالمدير)
  const actors = useMemo(() => {
    const map = new Map<number, UserBrief>()
    for (const entry of activities) {
      if (entry.actor && !map.has(entry.actor.id)) map.set(entry.actor.id, entry.actor)
    }
    return [...map.values()]
  }, [activities])

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase()
    const filtered = activities
      .filter((a) => projectFilter === 'all' || a.project === projectFilter)
      .filter((a) => actorFilter === 'all' || a.actor?.id === actorFilter)
      .filter(
        (a) =>
          !text ||
          a.message.toLowerCase().includes(text) ||
          a.project_title.toLowerCase().includes(text) ||
          (a.actor ? displayName(a.actor).toLowerCase().includes(text) : false),
      )
    // تصل من الخادم الأحدث أولاً — نعكس فقط عند طلب الأقدم أولاً
    return sortDirection === 'desc' ? filtered : [...filtered].reverse()
  }, [activities, query, projectFilter, actorFilter, sortDirection])

  if (isLoading) return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>
  if (isError)
    return (
      <p className="p-10 text-center text-red-600">
        تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000
      </p>
    )

  return (
    <div>
      {/* شريط البحث والفلاتر */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="mb-3 flex items-center gap-2">
          <History size={20} className="text-slate-400" />
          <h1 className="text-xl font-bold text-slate-900">
            سجل النشاطات{' '}
            <span className="text-sm font-normal text-slate-400">({visible.length})</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* بحث: نص الحدث أو اسم المشروع أو الفاعل */}
          <div className="relative min-w-[160px] flex-1">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث في النشاطات…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pe-3 ps-9 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
            />
          </div>

          {/* فلتر المشروع */}
          <select
            value={projectFilter}
            onChange={(e) =>
              setProjectFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            <option value="all">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {/* الفرز الزمني */}
          <button
            onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
            title={sortDirection === 'desc' ? 'الأحدث أولاً' : 'الأقدم أولاً'}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:border-blue-400 hover:text-blue-600"
          >
            {sortDirection === 'desc' ? (
              <ArrowDownWideNarrow size={17} />
            ) : (
              <ArrowUpNarrowWide size={17} />
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setQuery('')
                setProjectFilter('all')
                setActorFilter('all')
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-100"
              title="مسح الفلاتر"
            >
              <FilterX size={15} />
              مسح
            </button>
          )}
        </div>

        {/* فلتر الفاعل (دوائر الصور) */}
        {actors.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400">المستخدم:</span>
            {actors.map((actor) => (
              <button
                key={actor.id}
                onClick={() => setActorFilter((f) => (f === actor.id ? 'all' : actor.id))}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors',
                  actorFilter === actor.id
                    ? 'border-blue-600 bg-blue-50 font-medium text-blue-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                )}
              >
                <Avatar user={actor} size={18} />
                {displayName(actor)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* القائمة */}
      <div className="mx-auto max-w-6xl space-y-2 px-6 py-6">
        {visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            {hasActiveFilters ? 'لا نشاطات مطابقة للفلاتر' : 'لا نشاط مسجل بعد'}
          </p>
        )}

        {visible.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            {entry.actor ? (
              <Avatar user={entry.actor} size={30} />
            ) : (
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
                ؟
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                <Link
                  to={`/projects/${entry.project}`}
                  className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-100"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.project_color }}
                  />
                  {entry.project_title}
                </Link>
                <span>{formatDate(entry.created_at)}</span>
              </div>
              <p className="mt-1 text-sm leading-snug text-slate-700">
                <span className="text-slate-400">
                  {entry.actor ? displayName(entry.actor) : 'مستخدم محذوف'}
                </span>{' '}
                {entry.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
