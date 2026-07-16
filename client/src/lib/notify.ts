/** تنبيهات المتصفح: صوت مولَّد بـ Web Audio (بلا ملفات) + Notification API. */

let audioContext: AudioContext | null = null

/** نغمة تنبيه قصيرة من نوتتين صاعدتين. تفشل بصمت إن منع المتصفح الصوت
 *  قبل أول تفاعل من المستخدم. */
export function playNotificationSound() {
  try {
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume()
    const now = audioContext.currentTime
    const notes: Array<[frequency: number, startOffset: number]> = [
      [880, 0], // A5
      [1174.66, 0.14], // D6
    ]
    for (const [frequency, startOffset] of notes) {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const start = now + startOffset
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4)
      oscillator.connect(gain).connect(audioContext.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.45)
    }
  } catch {
    // لا صوت — ليس خطأً حرجاً
  }
}

/** اطلب إذن إشعارات المتصفح إن لم يُحسم بعد. */
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission()
  }
}

/** أظهر إشعار متصفح (يظهر حتى والنافذة في الخلفية) — يتطلب إذناً ممنوحاً. */
export function showBrowserNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const notification = new Notification(title, { body, dir: 'rtl', lang: 'ar', tag: `pm-${Date.now()}` })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    // بعض المتصفحات تمنع الإنشاء المباشر — نكتفي بالجرس والصوت
  }
}
