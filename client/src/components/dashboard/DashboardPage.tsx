import {
  AlarmClock, Eye, FolderKanban, History, LayoutDashboard, ListTodo, Timer,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAllActivity, useProjects } from '../../hooks/useProjects'
import { useTasks } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { formatDate, formatDay } from '../../lib/utils'
import {
  displayName, isTaskOverdue, STATUS_LABELS, TASK_STATUSES,
  type Task, type TaskStatus, type UserBrief,
} from '../../types'
import { StatusIcon } from '../tasks/StatusIcon'
import { Avatar } from '../ui/Avatar'

/** ألوان الحالات — نفس ألوان StatusIcon المعتمدة في كل التطبيق */
const STATUS_COLORS: Record<TaskStatus, string> = {
  SUGGESTED: '#0ea5e9',
  OPEN: '#94a3b8',
  IN_PROGRESS: '#f59e0b',
  REVIEW: '#8b5cf6',
  DONE: '#10b981',
}

const STALE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

type StatusCounts = Record<TaskStatus, number>

const countByStatus = (tasks: Task[]): StatusCounts => {
  const counts: StatusCounts = { SUGGESTED: 0, OPEN: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 }
  for (const task of tasks) counts[task.status] += 1
  return counts
}

/** لوحة إحصائيات المدير: نظرة صباحية واحدة — المهام حسب الحالة لكل مشروع،
 *  حِمل الموظفين، ما يحتاج انتباهاً (مراجعة/راكدة)، وآخر النشاطات.
 *  تُحسب كلها من بيانات React Query المخزنة — بلا نقاط خادم إضافية. */
export function DashboardPage() {
  const { data: projects = [] } = useProjects()
  const { data: tasks = [] } = useTasks()
  const { data: users = [] } = useUsers()
  const { data: activities = [] } = useAllActivity()

  const stats = useMemo(() => {
    // مهام المشاريع المؤرشفة خارج الحسابات (المحذوفة مستبعدة من الخادم أصلاً)
    const active = tasks.filter((t) => !t.project_archived)
    const totals = countByStatus(active)

    const byProject = projects
      .map((project) => {
        const projectTasks = active.filter((t) => t.project === project.id)
        return { project, counts: countByStatus(projectTasks), total: projectTasks.length }
      })
      .sort((a, b) => b.total - a.total)

    // حِمل الموظف = مهامه غير المنجزة؛ يشمل المدراء فقط إن كان لديهم حِمل
    const loadOf = (user: UserBrief) =>
      active.filter(
        (t) => t.status !== 'DONE' && t.assignees.some((a) => a.id === user.id),
      ).length
    const workload = users
      .map((user) => ({ user, load: loadOf(user) }))
      .filter(({ user, load }) => !user.is_manager || load > 0)
      .sort((a, b) => b.load - a.load)
    const maxLoad = Math.max(1, ...workload.map((w) => w.load))

    const reviewTasks = active.filter((t) => t.status === 'REVIEW')
    const overdueTasks = active
      .filter(isTaskOverdue)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    const staleTasks = active
      .filter(
        (t) =>
          !isTaskOverdue(t) && // المتأخرة لها قسمها الخاص
          (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
          Date.now() - new Date(t.updated_at).getTime() > STALE_DAYS * DAY_MS,
      )
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())

    return { active, totals, byProject, workload, maxLoad, reviewTasks, overdueTasks, staleTasks }
  }, [tasks, projects, users])

  const notDone =
    stats.totals.SUGGESTED + stats.totals.OPEN + stats.totals.IN_PROGRESS + stats.totals.REVIEW

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-2">
        <LayoutDashboard size={20} className="text-slate-400" />
        <h1 className="text-xl font-bold text-slate-900">لوحة الإحصائيات</h1>
        <span className="ms-auto text-xs text-slate-400">
          {new Intl.DateTimeFormat('ar', { dateStyle: 'full' }).format(new Date())}
        </span>
      </div>

      {/* بطاقات الأرقام */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<FolderKanban size={17} />} label="مشاريع نشطة" value={projects.length} />
        <StatTile icon={<ListTodo size={17} />} label="مهام غير منجزة" value={notDone} />
        <StatTile
          icon={<Eye size={17} className="text-violet-500" />}
          label="بانتظار المراجعة"
          value={stats.totals.REVIEW}
          tone={stats.totals.REVIEW > 0 ? 'violet' : undefined}
        />
        <StatTile
          icon={<AlarmClock size={17} className="text-red-500" />}
          label="متأخرة"
          value={stats.overdueTasks.length}
          tone={stats.overdueTasks.length > 0 ? 'red' : undefined}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* المهام حسب الحالة لكل مشروع */}
        <section className="rounded-xl border border-slate-200/70 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-700">المهام حسب الحالة لكل مشروع</h2>
            {/* مفتاح الحالات: أيقونة + تسمية — الهوية ليست باللون وحده */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {TASK_STATUSES.map((s) => (
                <span key={s} className="flex items-center gap-1 text-[11px] text-slate-500">
                  <StatusIcon status={s} size={12} />
                  {STATUS_LABELS[s]}
                </span>
              ))}
            </div>
          </div>

          {stats.byProject.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">لا مشاريع نشطة بعد</p>
          )}
          <div className="space-y-3">
            {stats.byProject.map(({ project, counts, total }) => (
              <div key={project.id}>
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <Link
                    to={`/projects/${project.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 hover:text-blue-600"
                  >
                    {project.title}
                  </Link>
                  {/* الأعداد نصاً مع أيقونة الحالة — تقرأ بلا اعتماد على اللون */}
                  <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                    {TASK_STATUSES.filter((s) => counts[s] > 0).map((s) => (
                      <span key={s} className="flex items-center gap-0.5">
                        <StatusIcon status={s} size={12} />
                        {counts[s]}
                      </span>
                    ))}
                    {total === 0 && 'بلا مهام'}
                  </span>
                </div>
                {/* شريط مكدس رفيع بفواصل 2px */}
                <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100">
                  {total > 0 &&
                    TASK_STATUSES.filter((s) => counts[s] > 0).map((s) => (
                      <div
                        key={s}
                        title={`${STATUS_LABELS[s]}: ${counts[s]}`}
                        className="rounded-full"
                        style={{
                          width: `${(counts[s] / total) * 100}%`,
                          backgroundColor: STATUS_COLORS[s],
                        }}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* حِمل الموظفين */}
        <section className="rounded-xl border border-slate-200/70 bg-white p-4">
          <h2 className="mb-3 font-bold text-slate-700">
            حِمل الموظفين{' '}
            <span className="text-xs font-normal text-slate-400">(المهام غير المنجزة)</span>
          </h2>
          {stats.workload.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              لا يوجد موظفون بعد — أضفهم من صفحة «الموظفون»
            </p>
          )}
          <div className="space-y-3">
            {stats.workload.map(({ user, load }) => (
              <div key={user.id} className="flex items-center gap-2.5">
                <Avatar user={user} size={28} />
                <span className="w-28 truncate text-sm text-slate-700">{displayName(user)}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(load / stats.maxLoad) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-end text-sm font-bold text-slate-700">{load}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* بحاجة إلى انتباه */}
      <section className="mb-6 rounded-xl border border-slate-200/70 bg-white p-4">
        <h2 className="mb-3 font-bold text-slate-700">بحاجة إلى انتباه</h2>

        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
              <AlarmClock size={15} />
              متأخرة عن استحقاقها ({stats.overdueTasks.length})
            </h3>
            {stats.overdueTasks.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                لا مهام متأخرة — ممتاز
              </p>
            )}
            <div className="space-y-1.5">
              {stats.overdueTasks.slice(0, 6).map((task) => (
                <AttentionRow
                  key={task.id}
                  task={task}
                  note={task.due_date ? `استحقاقها ${formatDay(task.due_date)}` : undefined}
                  noteClassName="text-red-600 font-medium"
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-violet-700">
              <Eye size={15} />
              بانتظار اعتمادك ({stats.reviewTasks.length})
            </h3>
            {stats.reviewTasks.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                لا مهام بانتظار المراجعة
              </p>
            )}
            <div className="space-y-1.5">
              {stats.reviewTasks.slice(0, 6).map((task) => (
                <AttentionRow key={task.id} task={task} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-700">
              <Timer size={15} />
              راكدة منذ {STALE_DAYS}+ أيام ({stats.staleTasks.length})
            </h3>
            {stats.staleTasks.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                لا مهام راكدة — ممتاز
              </p>
            )}
            <div className="space-y-1.5">
              {stats.staleTasks.slice(0, 6).map((task) => (
                <AttentionRow
                  key={task.id}
                  task={task}
                  note={`منذ ${Math.floor(
                    (Date.now() - new Date(task.updated_at).getTime()) / DAY_MS,
                  )} يوماً`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* آخر النشاطات */}
      <section className="rounded-xl border border-slate-200/70 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-bold text-slate-700">
            <History size={16} className="text-slate-400" />
            آخر النشاطات
          </h2>
          <Link to="/activity" className="text-xs font-medium text-blue-600 hover:text-blue-700">
            عرض الكل
          </Link>
        </div>
        {activities.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">لا نشاط مسجل بعد</p>
        )}
        <div className="divide-y divide-slate-100">
          {activities.slice(0, 8).map((entry) => (
            <div key={entry.id} className="flex items-start gap-2.5 py-2">
              {entry.actor ? (
                <Avatar user={entry.actor} size={24} />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
                  ؟
                </span>
              )}
              <p className="min-w-0 flex-1 truncate text-sm text-slate-700">
                <span className="text-slate-400">
                  {entry.actor ? displayName(entry.actor) : 'مستخدم محذوف'}
                </span>{' '}
                {entry.message}
              </p>
              <span className="shrink-0 text-[11px] text-slate-400">
                {formatDate(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatTile({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number; tone?: 'violet' | 'red' }) {
  return (
    <div
      className={
        tone === 'red'
          ? 'rounded-xl border border-red-200 bg-red-50/60 p-4'
          : tone === 'violet'
            ? 'rounded-xl border border-violet-200 bg-violet-50/60 p-4'
            : 'rounded-xl border border-slate-200/70 bg-white p-4'
      }
    >
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

/** صف مهمة في قسم «بحاجة إلى انتباه» — ينقل للمشروع مع وميض المهمة */
function AttentionRow({
  task, note, noteClassName = 'text-amber-600',
}: { task: Task; note?: string; noteClassName?: string }) {
  return (
    <Link
      to={`/projects/${task.project}?focus=task-${task.id}`}
      className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 hover:border-blue-200 hover:bg-blue-50/40"
    >
      <StatusIcon status={task.status} size={14} />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{task.title}</span>
      {note && <span className={`shrink-0 text-[11px] ${noteClassName}`}>{note}</span>}
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.project_color }} />
        {task.project_title}
      </span>
    </Link>
  )
}
