import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationMutations, useNotifications } from '../../hooks/useNotifications'
import { requestNotificationPermission } from '../../lib/notify'
import { cn, formatDate } from '../../lib/utils'
import type { AppNotification } from '../../types'
import { Avatar } from '../ui/Avatar'

/** جرس الإشعارات في ترويسة الشريط الجانبي: عدّاد غير المقروء + لوحة منسدلة.
 *  وجوده الدائم في الواجهة هو ما يبقي الفحص الدوري (والتنبيه الصوتي) نشطاً. */
export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const { markRead } = useNotificationMutations()
  const navigate = useNavigate()

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const toggle = () => {
    // أول نقرة على الجرس تطلب إذن إشعارات المتصفح (تفاعل مستخدم = يقبله المتصفح)
    requestNotificationPermission()
    setOpen((v) => !v)
  }

  const openItem = (item: AppNotification) => {
    if (!item.is_read) markRead.mutate([item.id])
    setOpen(false)
    navigate(item.project ? `/projects/${item.project}` : '/tasks')
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        title="الإشعارات"
        className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* طبقة شفافة للإغلاق عند النقر خارج اللوحة */}
          <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
          <div className="fixed end-3 top-16 z-50 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h3 className="text-sm font-bold">الإشعارات</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markRead.mutate(undefined)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <CheckCheck size={13} />
                  تعليم الكل كمقروء
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  لا توجد إشعارات بعد
                </p>
              )}
              {notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openItem(item)}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-slate-50 px-4 py-3 text-start hover:bg-slate-50',
                    !item.is_read && 'bg-blue-50/60 hover:bg-blue-50',
                  )}
                >
                  {item.actor ? (
                    <Avatar user={item.actor} size={30} />
                  ) : (
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                      <Bell size={14} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug text-slate-700">
                      {item.message}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {formatDate(item.created_at)}
                    </span>
                  </span>
                  {!item.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
