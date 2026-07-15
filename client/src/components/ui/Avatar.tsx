import { cn } from '../../lib/utils'
import { AVATAR_MAP, displayName, type UserBrief } from '../../types'

/** أيقونة المستخدم الجاهزة (مفتاح من AVATAR_OPTIONS)،
 *  أو دائرة بأول حرف من اسمه إن لم تُحدَّد أيقونة. */
export function Avatar({ user, size = 28, className }: {
  user: UserBrief
  size?: number
  className?: string
}) {
  const name = displayName(user)
  const preset = user.avatar ? AVATAR_MAP[user.avatar] : undefined

  // الصورة المرفوعة لها الأولوية على الأيقونة الجاهزة
  if (user.photo) {
    return (
      <img
        src={user.photo}
        alt={name}
        title={name}
        style={{ width: size, height: size }}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    )
  }
  if (preset) {
    return (
      <span
        title={name}
        style={{ width: size, height: size, fontSize: size * 0.55, backgroundColor: `${preset.bg}26` }}
        className={cn('flex shrink-0 items-center justify-center rounded-full leading-none', className)}
      >
        {preset.emoji}
      </span>
    )
  }
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white',
        className,
      )}
    >
      {name.charAt(0)}
    </span>
  )
}
