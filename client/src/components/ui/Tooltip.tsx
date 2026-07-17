import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** تلميح حديث بديل عن title الكلاسيكي: خلفية داكنة دائرية الحواف
 *  تظهر تحت مؤشر الماوس وتتبعه أثناء الحركة. */
export function Tooltip({
  label, children, className,
}: { label: ReactNode; children: ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  return (
    <span
      className={cn('inline-flex', className)}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <span
          dir="rtl"
          className="pointer-events-none fixed z-[70] max-w-xs -translate-x-1/2 rounded-lg bg-slate-900/95 px-3 py-1.5 text-center text-[11px] leading-relaxed text-white shadow-xl"
          style={{ left: pos.x, top: pos.y + 18 }}
        >
          {label}
        </span>
      )}
    </span>
  )
}
