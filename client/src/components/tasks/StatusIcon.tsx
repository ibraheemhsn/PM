import { CheckCircle2, Circle, Eye, Lightbulb, PauseCircle, Timer } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TaskStatus } from '../../types'

const STATUS_STYLES: Record<TaskStatus, { Icon: typeof Circle; className: string }> = {
  SUGGESTED: { Icon: Lightbulb, className: 'text-sky-500' },
  OPEN: { Icon: Circle, className: 'text-slate-400' },
  IN_PROGRESS: { Icon: Timer, className: 'text-amber-500' },
  ON_HOLD: { Icon: PauseCircle, className: 'text-orange-500' },
  REVIEW: { Icon: Eye, className: 'text-violet-500' },
  DONE: { Icon: CheckCircle2, className: 'text-emerald-500' },
}

export function StatusIcon({ status, size = 20, className }: {
  status: TaskStatus
  size?: number
  className?: string
}) {
  const { Icon, className: colorClass } = STATUS_STYLES[status]
  return <Icon size={size} className={cn(colorClass, className)} />
}
