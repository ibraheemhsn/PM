import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { playNotificationSound, showBrowserNotification } from '../lib/notify'

/** فترة الفحص الدوري للإشعارات (ميلي ثانية) */
const POLL_INTERVAL = 15_000

/** إشعارات المستخدم مع فحص دوري — يستمر حتى والنافذة في الخلفية
 *  كي يصل إشعار المتصفح والصوت أثناء العمل في تبويب آخر. */
export function useNotifications() {
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: api.notifications.list,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: true,
  })

  // آخر معرف إشعار عُرض تنبيهه — null قبل أول جلب (لا تنبيه للإشعارات القديمة)
  const lastSeenId = useRef<number | null>(null)

  useEffect(() => {
    const items = query.data
    if (!items) return
    const maxId = items.reduce((max, n) => Math.max(max, n.id), 0)

    if (lastSeenId.current === null) {
      lastSeenId.current = maxId // أول جلب: سجّل الموجود دون تنبيه
      return
    }
    const fresh = items.filter((n) => n.id > (lastSeenId.current as number) && !n.is_read)
    if (fresh.length > 0) {
      playNotificationSound()
      // إشعار متصفح لكل جديد (حتى 3 كي لا تتكدس النوافذ)
      for (const n of fresh.slice(0, 3)) {
        showBrowserNotification('لوحة شركة الفخار', n.message)
      }
      if (fresh.length > 3) {
        showBrowserNotification('لوحة شركة الفخار', `و${fresh.length - 3} إشعارات أخرى…`)
      }
    }
    lastSeenId.current = Math.max(lastSeenId.current, maxId)
  }, [query.data])

  return query
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  return {
    markRead: useMutation({
      mutationFn: (ids?: number[]) => api.notifications.markRead(ids),
      onSuccess: invalidate,
    }),
  }
}
