import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { requestNotificationPermission } from '../../lib/notify'

/** جرس الإشعارات في ترويسة الشريط الجانبي: عدّاد غير المقروء، والنقر
 *  ينقل إلى صفحة الإشعارات الكاملة (/notifications).
 *  وجوده الدائم في الواجهة هو ما يبقي الفحص الدوري (والتنبيه الصوتي) نشطاً. */
export function NotificationsBell() {
  const { data: notifications = [] } = useNotifications()
  const navigate = useNavigate()

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const open = () => {
    // النقرة على الجرس تطلب إذن إشعارات المتصفح (تفاعل مستخدم = يقبله المتصفح)
    requestNotificationPermission()
    navigate('/notifications')
  }

  return (
    <button
      onClick={open}
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
  )
}
