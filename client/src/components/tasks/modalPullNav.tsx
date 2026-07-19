import { ChevronsDown, ChevronsUp } from 'lucide-react'
import { useRef } from 'react'
import { useEdgePullNavigate } from '../../hooks/useEdgePullNavigate'
import { cn } from '../../lib/utils'

/** كلاس أنيميشن دخول النافذة حسب اتجاه التنقل (~نصف ثانية) */
export function enterClass(dir?: 'prev' | 'next') {
  return dir === 'prev' ? 'task-enter-prev' : dir === 'next' ? 'task-enter-next' : ''
}

/** التنقل بالسحب العمودي داخل نافذة (الجوال): أعلى المحتوى + سحب لأسفل =
 *  العنصر السابق، وأسفله + سحب لأعلى = التالي. يعيد مرجع حاوية التمرير
 *  ومؤشري السحب الجاهزين للعرض داخل النافذة. */
export function useModalPullNav({
  onPrev, onNext,
}: { onPrev?: () => void; onNext?: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const { pull, threshold } = useEdgePullNavigate({
    scrollRef: bodyRef,
    hasPrev: !!onPrev,
    hasNext: !!onNext,
    onPrev: () => onPrev?.(),
    onNext: () => onNext?.(),
  })
  const progress = Math.min(Math.abs(pull) / threshold, 1)

  const hints = (
    <>
      {pull > 0 && (
        <PullHint
          direction="prev"
          progress={progress}
          ready={pull >= threshold}
          blocked={!onPrev}
        />
      )}
      {pull < 0 && (
        <PullHint
          direction="next"
          progress={progress}
          ready={-pull >= threshold}
          blocked={!onNext}
        />
      )}
    </>
  )

  return { bodyRef, hints }
}

function PullHint({
  direction, progress, ready, blocked,
}: { direction: 'prev' | 'next'; progress: number; ready: boolean; blocked?: boolean }) {
  const label = blocked
    ? direction === 'prev'
      ? 'لا يوجد المزيد في الأعلى'
      : 'لا يوجد المزيد في الأسفل'
    : ready
      ? 'أفلت للانتقال'
      : direction === 'prev'
        ? 'السابق'
        : 'التالي'
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4',
        direction === 'prev' ? 'top-20' : 'bottom-6',
      )}
      style={{ opacity: Math.max(progress, 0.4) }}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-colors',
          blocked ? 'bg-slate-500/90' : ready ? 'bg-emerald-600' : 'bg-slate-800/90',
        )}
      >
        {direction === 'prev' ? <ChevronsDown size={14} /> : <ChevronsUp size={14} />}
        {label}
      </span>
    </div>
  )
}
