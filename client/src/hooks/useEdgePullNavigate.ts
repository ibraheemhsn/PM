import { useEffect, useRef, useState, type RefObject } from 'react'
import { haptics } from '../lib/haptics'

/** مكافئ ويب لمنطق «تجاوز السحب عند الحدود» (Overscroll / Pull-to-action):
 *  - أعلى الصفحة (scrollTop ≤ 0) + سحب لأسفل قوي  → المشروع السابق
 *  - أسفل الصفحة (نهاية المحتوى) + سحب لأعلى قوي → المشروع التالي
 *
 *  بدل PanResponder نستخدم أحداث اللمس الأصلية على حاوية التمرير،
 *  وبدل contentOffset.y نقرأ element.scrollTop. القيمة المُعادة `pull`
 *  إزاحة مُخمَّدة (بالبكسل، موجبة = سحب لأسفل، سالبة = لأعلى) لربط الحركة.
 *  يعمل على اللمس فقط (الجوال) — مُعطَّل على الشاشات الكبيرة. */
export function useEdgePullNavigate(options: {
  scrollRef: RefObject<HTMLElement | null>
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  /** الحد الأدنى للسحب قبل تشغيل التبديل (بكسل بعد التخميد) */
  threshold?: number
}) {
  const { scrollRef, threshold = 80 } = options
  const [pull, setPull] = useState(0)

  // نُبقي أحدث القيم في ref كي تبقى مستمعات اللمس ثابتة (تُسجَّل مرة واحدة)
  const latest = useRef(options)
  latest.current = options
  const pullRef = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let active = false
    let startY = 0
    let dir: 0 | 1 | -1 = 0 // 1 = سحب لأسفل (سابق)، -1 = سحب لأعلى (تالي)
    let passedThreshold = false // لضمان اهتزاز واحد عند لحظة العبور فقط

    // اللمس/الجوال فقط — يُقيَّم لحظة كل إيماءة كي يعمل حتى لو بُدّل عرض
    // النافذة أو فُعِّل Device Mode بعد التحميل (بلا إعادة تحميل)
    const isMobileWidth = () => window.innerWidth < 1024
    const atTop = () => el.scrollTop <= 0
    const atBottom = () => el.scrollHeight - el.scrollTop - el.clientHeight <= 1

    // هل يوجد جار في اتجاه السحب الحالي؟ (لتشغيل الاهتزاز/التبديل فقط عند وجوده)
    const navigable = () =>
      (dir === 1 && latest.current.hasPrev) || (dir === -1 && latest.current.hasNext)

    const setPullValue = (v: number) => {
      pullRef.current = v
      setPull(v)
      // تأثير لمسي متوسط لحظة بلوغ العتبة — فقط عند وجود جار (تبديل فعلي)
      const past = Math.abs(v) >= threshold && navigable()
      if (past && !passedThreshold) haptics.medium()
      passedThreshold = past
    }

    const onStart = (e: TouchEvent) => {
      if (!isMobileWidth()) return
      active = true
      startY = e.touches[0].clientY
      dir = 0
      passedThreshold = false
    }

    const onMove = (e: TouchEvent) => {
      if (!active) return
      const dy = e.touches[0].clientY - startY

      // السحب يعمل عند الحافة حتى بلا جار — كي يظهر تنبيه «لا يوجد المزيد».
      // مقاومة أكبر (تخميد أقل) حين لا جار للدلالة على أنه طريق مسدود
      const damp = () => (navigable() ? 0.45 : 0.25)
      const cap = () => (navigable() ? 150 : 60)

      // سحب لأسفل عند القمة → السابق (أو «لا مزيد في الأعلى»)
      if (dy > 0 && atTop()) {
        dir = 1
        setPullValue(Math.min(dy * damp(), cap()))
        e.preventDefault() // امنع اهتزاز المتصفح المطاطي أثناء تولّينا الإيماءة
      }
      // سحب لأعلى عند القاع → التالي (أو «لا مزيد في الأسفل»)
      else if (dy < 0 && atBottom()) {
        dir = -1
        setPullValue(Math.max(dy * damp(), -cap()))
        e.preventDefault()
      }
      // عاد ضمن نطاق التمرير الطبيعي — أفلت الإيماءة
      else if (dir !== 0) {
        dir = 0
        setPullValue(0)
      }
    }

    const onEnd = () => {
      if (active) {
        // التبديل فقط عند تجاوز العتبة ووجود جار في الاتجاه
        if (dir === 1 && pullRef.current >= threshold && latest.current.hasPrev) {
          latest.current.onPrev()
        } else if (dir === -1 && pullRef.current <= -threshold && latest.current.hasNext) {
          latest.current.onNext()
        }
      }
      active = false
      dir = 0
      setPullValue(0) // ارتداد ناعم للوضع الأصلي (transition في العنصر)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [scrollRef, threshold])

  return { pull, threshold }
}
