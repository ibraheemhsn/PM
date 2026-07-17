import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAllNotifications, useNotificationMutations } from '../../hooks/useNotifications'
import { cn, formatDate } from '../../lib/utils'
import type { AppNotification } from '../../types'
import { Avatar } from '../ui/Avatar'

/** تسميات أنواع الإشعارات وألوان شاراتها */
const KIND_BADGES: Record<AppNotification['kind'], { label: string; className: string }> = {
  TASK_ASSIGNED: { label: 'مهمة مسندة', className: 'bg-blue-50 text-blue-600' },
  TASK_STATUS: { label: 'تغيير حالة', className: 'bg-emerald-50 text-emerald-600' },
  TASK_SUGGESTED: { label: 'مهمة مقترحة', className: 'bg-sky-50 text-sky-600' },
  NEW_COMMENT: { label: 'تعليق جديد', className: 'bg-amber-50 text-amber-700' },
  MENTION: { label: 'إشارة إليك', className: 'bg-rose-50 text-rose-600' },
  DUE_SOON: { label: 'اقتراب استحقاق', className: 'bg-red-50 text-red-600' },
  DETAILS_PROPOSED: { label: 'تعديل مقترح', className: 'bg-purple-50 text-purple-600' },
  PROJECT_UPDATE: { label: 'تحديث مشروع', className: 'bg-violet-50 text-violet-600' },
}

type Filter = 'all' | 'unread'

/** صفحة الإشعارات الكاملة: آخر 100 إشعار مع فلتر «غير المقروءة»
 *  وتعليم فردي (بالنقر) أو جماعي كمقروء. النقر ينقل للمشروع المعني. */
export function NotificationsPage() {
  const navigate = useNavigate()
  const { data: notifications = [], isLoading, isError } = useAllNotifications()
  const { markRead } = useNotificationMutations()
  const [filter, setFilter] = useState<Filter>('all')

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const visible = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications

  const openItem = (item: AppNotification) => {
    if (!item.is_read) markRead.mutate([item.id])
    if (!item.project) {
      navigate('/tasks')
      return
    }
    // معامل focus يجعل صفحة المشروع تمرر إلى العنصر المستهدف وتومض حوله
    const focus =
      item.kind === 'DETAILS_PROPOSED'
        ? 'details'
        : item.kind === 'PROJECT_UPDATE'
          ? 'updates'
          : item.task
            ? `task-${item.task}`
            : null
    navigate(`/projects/${item.project}${focus ? `?focus=${focus}` : ''}`)
  }

  if (isLoading) return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>
  if (isError)
    return (
      <p className="p-10 text-center text-red-600">
        تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000
      </p>
    )

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Bell size={20} className="text-slate-400" />
        <h1 className="text-xl font-bold text-slate-900">
          الإشعارات{' '}
          {unreadCount > 0 && (
            <span className="text-sm font-normal text-slate-400">({unreadCount} غير مقروء)</span>
          )}
        </h1>
        <div className="ms-auto flex items-center gap-2">
          {/* فلتر: الكل / غير المقروءة */}
          <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
            {(
              [
                ['all', 'الكل'],
                ['unread', `غير المقروءة (${unreadCount})`],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs transition-colors',
                  filter === value
                    ? 'bg-blue-600 font-medium text-white'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markRead.mutate(undefined)}
              disabled={markRead.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 hover:border-blue-400 disabled:opacity-50"
            >
              <CheckCheck size={14} />
              تعليم الكل كمقروء
            </button>
          )}
        </div>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        آخر 100 إشعار — النقر على الإشعار يعلّمه مقروءاً وينقلك إلى المشروع المعني.
      </p>

      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          {filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات بعد'}
        </p>
      )}

      <div className="space-y-2">
        {visible.map((item) => {
          const badge = KIND_BADGES[item.kind]
          return (
            <button
              key={item.id}
              onClick={() => openItem(item)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-start shadow-sm transition-colors',
                item.is_read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/60 hover:bg-blue-50',
              )}
            >
              {item.actor ? (
                <Avatar user={item.actor} size={34} />
              ) : (
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                  <Bell size={15} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {badge && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', badge.className)}>
                      {badge.label}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">{formatDate(item.created_at)}</span>
                </span>
                <span
                  className={cn(
                    'mt-1 block text-sm leading-snug text-slate-700',
                    !item.is_read && 'font-bold',
                  )}
                >
                  {item.message}
                </span>
              </span>
              {!item.is_read && (
                <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
