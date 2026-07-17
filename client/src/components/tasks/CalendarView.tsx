import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { isTaskOverdue, type Task } from '../../types'

/** الأسبوع يبدأ بالسبت — المتعارف عليه في تقاويم المنطقة */
const WEEKDAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

const monthFormatter = new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' })

/** مفتاح يوم محلي بصيغة YYYY-MM-DD — نفس صيغة due_date القادمة من الخادم */
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** تقويم شهري: كل مهمة تظهر في يوم استحقاقها — المتأخرة حمراء والمنجزة باهتة.
 *  النقر على مهمة ينقل لمشروعها مع الوميض عليها. */
export function CalendarView({ tasks }: { tasks: Task[] }) {
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const todayKey = toKey(new Date())

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (!task.due_date) continue
      const list = map.get(task.due_date) ?? []
      list.push(task)
      map.set(task.due_date, list)
    }
    return map
  }, [tasks])

  const noDueCount = useMemo(() => tasks.filter((t) => !t.due_date).length, [tasks])

  // شبكة ستة أسابيع تبدأ من السبت الذي يسبق أول الشهر (أو يطابقه)
  const days = useMemo(() => {
    const start = new Date(monthDate)
    start.setDate(start.getDate() - ((start.getDay() + 1) % 7))
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [monthDate])

  const shiftMonth = (delta: number) =>
    setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4">
      {/* ترويسة الشهر والتنقل */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-slate-800">{monthFormatter.format(monthDate)}</h2>
        <div className="flex items-center gap-1">
          {/* في RTL: السهم لليمين يعود شهراً، ولليسار يتقدم */}
          <button
            onClick={() => shiftMonth(-1)}
            title="الشهر السابق"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-blue-400 hover:text-blue-600"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => setMonthDate(() => {
              const now = new Date()
              return new Date(now.getFullYear(), now.getMonth(), 1)
            })}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600"
          >
            اليوم
          </button>
          <button
            onClick={() => shiftMonth(1)}
            title="الشهر التالي"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-blue-400 hover:text-blue-600"
          >
            <ChevronLeft size={15} />
          </button>
        </div>
        {noDueCount > 0 && (
          <span className="ms-auto text-xs text-slate-400">
            {noDueCount} مهمة بلا تاريخ استحقاق لا تظهر في التقويم
          </span>
        )}
      </div>

      {/* رؤوس أيام الأسبوع */}
      <div className="grid grid-cols-7 border-b border-slate-200 pb-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-xs font-bold text-slate-500">
            {day}
          </span>
        ))}
      </div>

      {/* خلايا الأيام */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toKey(day)
          const inMonth = day.getMonth() === monthDate.getMonth()
          const isToday = key === todayKey
          const dayTasks = tasksByDay.get(key) ?? []

          return (
            <div
              key={key}
              className={cn(
                'min-h-24 space-y-1 border-b border-e border-slate-100 p-1.5 first:border-s',
                !inMonth && 'bg-slate-50/70',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                  isToday
                    ? 'bg-blue-600 font-bold text-white'
                    : inMonth
                      ? 'text-slate-600'
                      : 'text-slate-300',
                )}
              >
                {day.getDate()}
              </span>

              {dayTasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/projects/${task.project}?focus=task-${task.id}`}
                  title={`${task.title} — ${task.project_title}`}
                  className={cn(
                    'block truncate rounded border-s-2 px-1.5 py-0.5 text-[11px] leading-snug',
                    isTaskOverdue(task)
                      ? 'bg-red-50 font-medium text-red-700 hover:bg-red-100'
                      : task.status === 'DONE'
                        ? 'bg-slate-50 text-slate-400 line-through hover:bg-slate-100'
                        : 'bg-blue-50/60 text-slate-700 hover:bg-blue-100/70',
                  )}
                  style={{ borderInlineStartColor: task.color || task.project_color }}
                >
                  {task.title}
                </Link>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
