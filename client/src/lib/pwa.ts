/** PWA: تسجيل الـ Service Worker والاشتراك في Web Push.
 *  الدفع يصل للجهاز حتى والتطبيق مغلق — بعكس الفحص الدوري داخل التبويب. */
import { api } from './api'

export const PUSH_ENABLED_FLAG = 'pm-push-on'

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch {
    // بيئة لا تدعم SW (أو http غير محلي) — التطبيق يعمل عادياً بدونه
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/** اشترك في Web Push وسجّل الاشتراك على الخادم — يتطلب إذن إشعارات ممنوحاً. */
export async function enablePush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    if (Notification.permission !== 'granted') return false

    const registration = await navigator.serviceWorker.ready
    const { public_key } = await api.push.key()
    if (!public_key) return false

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    })
    await api.push.subscribe(subscription.toJSON())
    // علم يمنع ازدواج الإشعارات: الدفع يغني عن إشعار المتصفح المحلي
    localStorage.setItem(PUSH_ENABLED_FLAG, '1')
    return true
  } catch {
    return false
  }
}
