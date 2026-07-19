import { AlarmClock, AtSign, CalendarDays, MessageSquare, Sun } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { useAllNotifications } from '../../hooks/useNotifications'
import { useTasks } from '../../hooks/useTasks'
import { formatDate, formatDay } from '../../lib/utils'
import { displayName, isTaskOverdue, type AppNotification, type Task } from '../../types'
import { StatusIcon } from '../tasks/StatusIcon'
import { Avatar } from '../ui/Avatar'

/** مفتاح اليوم المحلي YYYY-MM-DD — نفس صيغة due_date، بلا انزياح UTC */
function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** صفحة «يومي»: نظرة شخصية صباحية للموظف — ما يستحق اليوم، المتأخر،
 *  ما ينتظر ردّي (تعليقات جديدة)، وآخر الإشارات إليّ (@).
 *  كلها محسوبة من بيانات React Query المخزّنة — بلا نقاط خادم إضافية. */
export function MyDayPage() {
  const { data: me } = useMe()
  const { data: tasks = [] } = useTasks()
  const { data: notifications = [] } = useAllNotifications()

  const myId = me?.id ?? 0

  const groups = useMemo(() => {
    const today = todayKey()
    // مهامي = المُسنَدة إليّ في مشاريع غير مؤرشفة (المحذوفة مستبعدة من الخادم)
    const active = tasks.filter((t) => !t.project_archived)
    const mine = active.filter((t) => t.assignees.some((a) => a.id === myId))

    const dueToday = mine.filter((t) => t.status !== 'DONE' && t.due_date === today)
    const overdue = mine
      .filter(isTaskOverdue)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    // بانتظار ردّي: مهام لي عليها تعليقات جديدة من غيري لم أطّلع عليها
    const waiting = active
      .filter((t) => t.has_unread_comments)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

    const mentions = notifications
      .filter((n) => n.kind === 'MENTION')
      .slice(0, 8)
    const unreadMentions = mentions.filter((n) => !n.is_read).length

    return { dueToday, overdue, waiting, mentions, unreadMentions }
  }, [tasks, notifications, myId])

  const allClear =
    groups.dueToday.length === 0 &&
    groups.overdue.length === 0 &&
    groups.waiting.length === 0 &&
    groups.mentions.length === 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'طاب يومك' : 'مساء الخير'

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ترويسة ترحيبية */}
      <div className="mb-6 flex items-center gap-3">
        {me && <Avatar user={me} size={40} />}
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-xl font-bold text-slate-900">
            <Sun size={20} className="text-amber-400" />
            {greeting}{me ? `، ${displayName(me)}` : ''}
          </h1>
          <p className="text-xs text-slate-400">
            {new Intl.DateTimeFormat('ar', { dateStyle: 'full' }).format(new Date())}
          </p>
        </div>
      </div>

      {/* بطاقات الأرقام */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<CalendarDays size={17} className="text-blue-500" />}
          label="مستحقة اليوم"
          value={groups.dueToday.length}
          tone={groups.dueToday.length > 0 ? 'blue' : undefined}
        />
        <StatTile
          icon={<AlarmClock size={17} className="text-red-500" />}
          label="متأخرة"
          value={groups.overdue.length}
          tone={groups.overdue.length > 0 ? 'red' : undefined}
        />
        <StatTile
          icon={<MessageSquare size={17} className="text-violet-500" />}
          label="بانتظار ردّي"
          value={groups.waiting.length}
          tone={groups.waiting.length > 0 ? 'violet' : undefined}
        />
        <StatTile
          icon={<AtSign size={17} className="text-emerald-500" />}
          label="إشارات جديدة"
          value={groups.unreadMentions}
          tone={groups.unreadMentions > 0 ? 'emerald' : undefined}
        />
      </div>

      {allClear && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <Sun size={28} className="mx-auto text-amber-300" />
          <p className="mt-2 text-sm font-medium text-slate-500">كل شيء تحت السيطرة</p>
          <p className="text-xs text-slate-400">لا مهام مستحقة اليوم ولا متأخرات ولا إشارات جديدة</p>
        </div>
      )}

      <div className="space-y-4">
        {/* مستحقة اليوم */}
        {groups.dueToday.length > 0 && (
          <Section
            title="مستحقة اليوم"
            icon={<CalendarDays size={16} className="text-blue-500" />}
            count={groups.dueToday.length}
          >
            {groups.dueToday.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </Section>
        )}

        {/* متأخرة */}
        {groups.overdue.length > 0 && (
          <Section
            title="متأخرة عن استحقاقها"
            icon={<AlarmClock size={16} className="text-red-500" />}
            count={groups.overdue.length}
          >
            {groups.overdue.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                note={task.due_date ? `استحقاقها ${formatDay(task.due_date)}` : undefined}
                noteClassName="text-red-600 font-medium"
              />
            ))}
          </Section>
        )}

        {/* بانتظار ردّي */}
        {groups.waiting.length > 0 && (
          <Section
            title="بانتظار ردّي"
            icon={<MessageSquare size={16} className="text-violet-500" />}
            count={groups.waiting.length}
          >
            {groups.waiting.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                note="تعليقات جديدة"
                noteClassName="text-violet-600 font-medium"
              />
            ))}
          </Section>
        )}

        {/* آخر الإشارات إليّ */}
        {groups.mentions.length > 0 && (
          <Section
            title="آخر الإشارات إليّ"
            icon={<AtSign size={16} className="text-emerald-500" />}
            count={groups.mentions.length}
          >
            {groups.mentions.map((n) => (
              <MentionRow key={n.id} notification={n} />
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

function StatTile({
  icon, label, value, tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: 'blue' | 'red' | 'violet' | 'emerald'
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-200 bg-red-50/60'
      : tone === 'violet'
        ? 'border-violet-200 bg-violet-50/60'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50/60'
          : tone === 'emerald'
            ? 'border-emerald-200 bg-emerald-50/60'
            : 'border-slate-200/70 bg-white'
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function Section({
  title, icon, count, children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200/70 bg-white p-4">
      <h2 className="mb-3 flex items-center gap-1.5 font-bold text-slate-700">
        {icon}
        {title}
        <span className="text-xs font-normal text-slate-400">({count})</span>
      </h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

/** صف مهمة — ينقل لصفحة المشروع مع وميض المهمة المستهدفة */
function TaskRow({
  task, note, noteClassName = 'text-slate-500',
}: { task: Task; note?: string; noteClassName?: string }) {
  return (
    <Link
      to={`/projects/${task.project}?focus=task-${task.id}`}
      className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 hover:border-blue-200 hover:bg-blue-50/40"
    >
      <StatusIcon status={task.status} size={15} />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{task.title}</span>
      {note && <span className={`shrink-0 text-[11px] ${noteClassName}`}>{note}</span>}
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.project_color }} />
        {task.project_title}
      </span>
    </Link>
  )
}

/** صف إشارة (@) — ينقل للمهمة أو المشروع، ويميّز غير المقروء */
function MentionRow({ notification: n }: { notification: AppNotification }) {
  const to = n.task
    ? `/projects/${n.project}?focus=task-${n.task}`
    : n.project
      ? `/projects/${n.project}`
      : '/notifications'
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 hover:border-blue-200 hover:bg-blue-50/40 ${
        n.is_read ? 'border-slate-100' : 'border-emerald-200 bg-emerald-50/40'
      }`}
    >
      {n.actor ? (
        <Avatar user={n.actor} size={26} />
      ) : (
        <AtSign size={18} className="shrink-0 text-emerald-500" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{n.message}</span>
      <span className="shrink-0 text-[11px] text-slate-400">{formatDate(n.created_at)}</span>
    </Link>
  )
}
