import {
  ArrowDownWideNarrow, ArrowUpNarrowWide, CalendarDays, FilterX, LayoutGrid,
  List, Plus, Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { useAllUpdates, useProjects } from '../../hooks/useProjects'
import { useMarkTasksSeen, useTags, useTaskMutations, useTasks } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { cn, formatDate } from '../../lib/utils'
import {
  displayName, isTaskOverdue, PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_RANK,
  STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES,
  type ProjectUpdate, type Task, type TaskPriority, type TaskStatus,
} from '../../types'
import { Avatar } from '../ui/Avatar'
import { CalendarView } from './CalendarView'
import { KanbanBoard } from './KanbanBoard'
import { StatusIcon } from './StatusIcon'
import { TaskCard } from './TaskCard'
import { TaskCommentsModal } from './TaskCommentsModal'
import { TaskFormModal } from './TaskFormModal'

type ViewMode = 'both' | 'tasks' | 'updates'
/** أوضاع عرض المهام: قائمة، لوحة كانبان، أو تقويم حسب الاستحقاق */
type LayoutMode = 'list' | 'board' | 'calendar'
type SortField = 'created_at' | 'updated_at' | 'due_date' | 'priority'
type SortDirection = 'asc' | 'desc'

interface Filters {
  project: number | 'all'
  status: TaskStatus | 'all'
  priority: TaskPriority | 'all'
  /** المهام المتأخرة عن استحقاقها فقط */
  overdueOnly: boolean
  assignee: number | 'all'
  tags: string[]
  query: string
}

const INITIAL_FILTERS: Filters = {
  project: 'all',
  status: 'all',
  priority: 'all',
  overdueOnly: false,
  assignee: 'all',
  tags: [],
  query: '',
}

/** عنصر في الخلاصة الموحدة: مهمة أو تحديث مشروع */
type FeedItem =
  | { kind: 'task'; task: Task }
  | { kind: 'update'; update: ProjectUpdate }

export function AllTasksPage() {
  const { data: me } = useMe()
  const isManager = !!me?.is_manager

  const { data: tasks = [], isLoading, isError } = useTasks()
  const { data: updates = [] } = useAllUpdates()
  const { data: projects = [] } = useProjects()
  const { data: allTags = [] } = useTags()
  const { data: users = [] } = useUsers(isManager) // endpoint خاص بالمدير

  const taskMutations = useTaskMutations()

  const [view, setView] = useState<ViewMode>('both')
  // عرض المهام: قائمة/لوحة/تقويم — يُحفظ الاختيار محلياً بين الجلسات
  const [layout, setLayout] = useState<LayoutMode>(() => {
    const stored = localStorage.getItem('pm-tasks-layout')
    return stored === 'board' || stored === 'calendar' ? stored : 'list'
  })
  const switchLayout = (next: LayoutMode) => {
    setLayout(next)
    localStorage.setItem('pm-tasks-layout', next)
  }
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  // الافتراضي: الأحدث أولاً حسب تاريخ التحديث
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [editingTask, setEditingTask] = useState<Task | 'new' | null>(null)
  const [commentsTask, setCommentsTask] = useState<Task | null>(null)

  const hasActiveFilters =
    filters.project !== 'all' ||
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.overdueOnly ||
    filters.assignee !== 'all' ||
    filters.tags.length > 0 ||
    filters.query.trim() !== ''

  /** فلاتر المهام: مشروع + حالة + موظف + وسوم + نص */
  const visibleTasks = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    return tasks
      .filter((t) => !t.project_archived) // مهام المشاريع المؤرشفة خارج القوائم اليومية
      .filter((t) => filters.project === 'all' || t.project === filters.project)
      .filter((t) => filters.status === 'all' || t.status === filters.status)
      .filter((t) => filters.priority === 'all' || t.priority === filters.priority)
      .filter((t) => !filters.overdueOnly || isTaskOverdue(t))
      .filter(
        (t) =>
          filters.assignee === 'all' ||
          t.assignees.some((a) => a.id === filters.assignee),
      )
      // منطق AND: المهمة يجب أن تحمل كل الوسوم المحددة
      .filter((t) => filters.tags.every((tag) => t.tags.includes(tag)))
      .filter((t) => !query || t.title.toLowerCase().includes(query))
  }, [tasks, filters])

  // المهام المعروضة أمام المستخدم تُعلَّم مقروءةً (تُميَّز صفراء حتى المغادرة)
  useMarkTasksSeen(visibleTasks)

  /** فلاتر التحديثات: المشروع والبحث النصي فقط (الحالة/الوسوم/الموظف تخص المهام) */
  const visibleUpdates = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    return updates
      .filter((u) => !u.project_archived) // تحديثات المشاريع المؤرشفة خارج الخلاصة
      .filter((u) => filters.project === 'all' || u.project === filters.project)
      .filter((u) => !query || u.body.toLowerCase().includes(query))
  }, [updates, filters.project, filters.query])

  /** الخلاصة الموحدة مرتبة حسب الحقل والاتجاه المختارين.
   *  عند الفرز بالاستحقاق أو الأولوية: ما لا قيمة له (تحديثات المشاريع،
   *  ومهام بلا استحقاق) يوضع آخر القائمة دائماً. */
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []
    if (view !== 'updates') for (const task of visibleTasks) items.push({ kind: 'task', task })
    if (view !== 'tasks')
      for (const update of visibleUpdates) items.push({ kind: 'update', update })

    const rank = (item: FeedItem): number | null => {
      if (sortField === 'due_date') {
        return item.kind === 'task' && item.task.due_date
          ? new Date(item.task.due_date).getTime()
          : null
      }
      if (sortField === 'priority') {
        return item.kind === 'task' ? PRIORITY_RANK[item.task.priority] : null
      }
      const source = item.kind === 'task' ? item.task : item.update
      return new Date(source[sortField]).getTime()
    }

    return items.sort((a, b) => {
      const rankA = rank(a)
      const rankB = rank(b)
      if (rankA === null && rankB === null) return 0
      if (rankA === null) return 1
      if (rankB === null) return -1
      return sortDirection === 'asc' ? rankA - rankB : rankB - rankA
    })
  }, [view, visibleTasks, visibleUpdates, sortField, sortDirection])

  /** مهام لوحة كانبان بنفس الفرز المختار — مستقلة عن مبدّل «المحتوى» */
  const boardTasks = useMemo(() => {
    const rank = (task: Task): number | null => {
      if (sortField === 'due_date')
        return task.due_date ? new Date(task.due_date).getTime() : null
      if (sortField === 'priority') return PRIORITY_RANK[task.priority]
      return new Date(task[sortField]).getTime()
    }
    return [...visibleTasks].sort((a, b) => {
      const rankA = rank(a)
      const rankB = rank(b)
      if (rankA === null && rankB === null) return 0
      if (rankA === null) return 1
      if (rankB === null) return -1
      return sortDirection === 'asc' ? rankA - rankB : rankB - rankA
    })
  }, [visibleTasks, sortField, sortDirection])

  const toggleTag = (tag: string) => {
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))
  }

  const handleDelete = (task: Task) => {
    if (!confirm(`نقل مهمة «${task.title}» إلى المحذوفات؟ يمكنك استعادتها أو حذفها نهائياً من هناك.`))
      return
    taskMutations.remove.mutate(task.id)
  }

  if (isLoading) return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>
  if (isError)
    return (
      <p className="p-10 text-center text-red-600">
        تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000
      </p>
    )

  return (
    <div>
      {/* شريط الفلاتر والأدوات */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">
            {isManager ? 'جميع المهام' : 'مهامي'}{' '}
            <span className="text-sm font-normal text-slate-400">
              ({layout === 'list' ? feed.length : boardTasks.length})
            </span>
          </h1>
          <button
            onClick={() => setEditingTask('new')}
            title={isManager ? undefined : 'اقتراح مهمة تُعرض على المدير للاعتماد'}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={15} />
            {isManager ? 'مهمة جديدة' : 'اقتراح مهمة'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* تبديل العرض: قائمة / لوحة كانبان */}
          <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
            <button
              onClick={() => switchLayout('list')}
              title="عرض القائمة"
              className={cn(
                'rounded-md p-1.5 transition-colors',
                layout === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => switchLayout('board')}
              title="لوحة كانبان — اسحب المهام بين الأعمدة لتغيير حالتها"
              className={cn(
                'rounded-md p-1.5 transition-colors',
                layout === 'board' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => switchLayout('calendar')}
              title="تقويم شهري حسب تاريخ الاستحقاق"
              className={cn(
                'rounded-md p-1.5 transition-colors',
                layout === 'calendar' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <CalendarDays size={16} />
            </button>
          </div>

          {/* اختيار المحتوى: مهام / تحديثات / كلاهما — للقائمة فقط (اللوحة مهام دائماً) */}
          {layout === 'list' && (
            <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
              {(
                [
                  ['both', 'الكل'],
                  ['tasks', `المهام (${visibleTasks.length})`],
                  ['updates', `التحديثات (${visibleUpdates.length})`],
                ] as [ViewMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    view === mode ? 'bg-blue-600 font-medium text-white' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* بحث نصي سريع */}
          <div className="relative min-w-[160px] flex-1">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="بحث…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pe-3 ps-9 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
            />
          </div>

          {/* فلتر المشروع */}
          <select
            value={filters.project}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                project: e.target.value === 'all' ? 'all' : Number(e.target.value),
              }))
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

          {/* الترتيب الزمني */}
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            <option value="updated_at">تاريخ التحديث</option>
            <option value="created_at">تاريخ الإنشاء</option>
            <option value="due_date">تاريخ الاستحقاق</option>
            <option value="priority">الأولوية</option>
          </select>
          <button
            onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={sortDirection === 'asc' ? 'تصاعدي (الأقدم أولاً)' : 'تنازلي (الأحدث أولاً)'}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:border-blue-400 hover:text-blue-600"
          >
            {sortDirection === 'asc' ? (
              <ArrowUpNarrowWide size={17} />
            ) : (
              <ArrowDownWideNarrow size={17} />
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={() => setFilters(INITIAL_FILTERS)}
              className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-100"
              title="مسح الفلاتر"
            >
              <FilterX size={15} />
              مسح
            </button>
          )}
        </div>

        {/* فلاتر المهام: الحالة (chips) + الأولوية + الموظف */}
        {(layout === 'board' || view !== 'updates') && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">الحالة:</span>
              <button
                onClick={() => setFilters((f) => ({ ...f, status: 'all' }))}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs transition-colors',
                  filters.status === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-blue-300',
                )}
              >
                الكل
              </button>
              {TASK_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    setFilters((f) => ({ ...f, status: f.status === s ? 'all' : s }))
                  }
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
                    filters.status === s
                      ? 'bg-blue-50 font-medium text-blue-700 ring-1 ring-blue-400'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-blue-300',
                  )}
                >
                  <StatusIcon status={s} size={13} />
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {/* فلتر الأولوية + المتأخرة */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">الأولوية:</span>
              {TASK_PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    setFilters((f) => ({ ...f, priority: f.priority === p ? 'all' : p }))
                  }
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
                    filters.priority === p
                      ? 'bg-blue-50 font-medium text-blue-700 ring-1 ring-blue-400'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-blue-300',
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLORS[p] }}
                  />
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
              <button
                onClick={() => setFilters((f) => ({ ...f, overdueOnly: !f.overdueOnly }))}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs transition-colors',
                  filters.overdueOnly
                    ? 'bg-red-50 font-medium text-red-700 ring-1 ring-red-400'
                    : 'bg-white text-red-500 ring-1 ring-slate-200 hover:ring-red-300',
                )}
              >
                المتأخرة فقط
              </button>
            </div>

            {isManager && users.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">الموظف:</span>
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        assignee: f.assignee === user.id ? 'all' : user.id,
                      }))
                    }
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors',
                      filters.assignee === user.id
                        ? 'border-blue-600 bg-blue-50 font-medium text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                    )}
                  >
                    <Avatar user={user} size={18} />
                    {displayName(user)}
                  </button>
                ))}
              </div>
            )}

            {/* فلتر الوسوم (اختيار متعدد) */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">الوسوم:</span>
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.name)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs transition-colors',
                      filters.tags.includes(tag.name)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-blue-300',
                    )}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* تقويم شهري: المهام على أيام استحقاقها */}
      {layout === 'calendar' && (
        <div className="px-4 sm:px-6 py-6">
          <CalendarView
            tasks={visibleTasks}
            onOpen={(task) => (isManager ? setEditingTask(task) : setCommentsTask(task))}
          />
        </div>
      )}

      {/* لوحة كانبان: عمود لكل حالة مع سحب وإفلات */}
      {layout === 'board' && (
        <div className="px-4 sm:px-6 py-6">
          <KanbanBoard
            tasks={boardTasks}
            canManage={isManager}
            // نقر البطاقة: تعديل للمدير — وتعليقات للموظف
            onOpen={(task) => (isManager ? setEditingTask(task) : setCommentsTask(task))}
            onEdit={(task) => setEditingTask(task)}
            onDelete={handleDelete}
            onOpenComments={(task) => setCommentsTask(task)}
            onStatusChange={(task, status) =>
              taskMutations.update.mutate({ id: task.id, data: { status } })
            }
          />
        </div>
      )}

      {/* الخلاصة الموحدة: مهام وتحديثات */}
      {layout === 'list' && (
      <div className="mx-auto max-w-6xl space-y-2 px-4 sm:px-6 py-6">
        {feed.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            {hasActiveFilters ? 'لا توجد عناصر مطابقة للفلاتر' : 'لا توجد عناصر بعد'}
          </p>
        )}
        {feed.map((item) =>
          item.kind === 'task' ? (
            <TaskCard
              key={`task-${item.task.id}`}
              task={item.task}
              showProject
              canManage={isManager}
              // نقر البطاقة: تعديل للمدير — وتعليقات للموظف (لا صلاحية تعديل له)
              onOpen={() =>
                isManager ? setEditingTask(item.task) : setCommentsTask(item.task)
              }
              onEdit={() => setEditingTask(item.task)}
              onDelete={() => handleDelete(item.task)}
              onOpenComments={() => setCommentsTask(item.task)}
              onStatusChange={(status) =>
                taskMutations.update.mutate({ id: item.task.id, data: { status } })
              }
            />
          ) : (
            <UpdateFeedCard key={`update-${item.update.id}`} update={item.update} />
          ),
        )}
      </div>
      )}

      {editingTask && (
        <TaskFormModal
          task={editingTask === 'new' ? null : editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
      {commentsTask && (
        <TaskCommentsModal task={commentsTask} onClose={() => setCommentsTask(null)} />
      )}
    </div>
  )
}

/** بطاقة تحديث مشروع داخل الخلاصة الموحدة (للعرض — التحرير من صفحة المشروع) */
function UpdateFeedCard({ update }: { update: ProjectUpdate }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-slate-200 border-s-4 px-4 py-3 shadow-sm',
        // غير مقروء — يصبح مقروءاً عند فتح صفحة المشروع
        update.is_unread ? 'bg-yellow-50' : 'bg-white',
      )}
      style={{ borderInlineStartColor: update.project_color }}
    >
      {update.author ? (
        <Avatar user={update.author} size={30} />
      ) : (
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
          ؟
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-600">
            تحديث
          </span>
          {update.author && (
            <span className="text-slate-500">{displayName(update.author)}</span>
          )}
          <Link
            to={`/projects/${update.project}`}
            className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-100"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: update.project_color }}
            />
            {update.project_title}
          </Link>
          <span>{formatDate(update.created_at)}</span>
        </div>
        <p
          className={cn(
            'mt-1 whitespace-pre-wrap text-sm text-slate-700',
            update.is_unread && 'font-bold',
          )}
        >
          {update.body}
        </p>
      </div>
    </div>
  )
}
