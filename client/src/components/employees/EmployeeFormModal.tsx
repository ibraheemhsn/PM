import { Camera } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useUserMutations } from '../../hooks/useUsers'
import { cn } from '../../lib/utils'
import { AVATAR_OPTIONS, type User } from '../../types'
import { Modal } from '../ui/Modal'

type AvatarMode = 'icon' | 'photo'

interface EmployeeFormModalProps {
  /** null → إنشاء موظف جديد */
  user: User | null
  onClose: () => void
}

export function EmployeeFormModal({ user, onClose }: EmployeeFormModalProps) {
  const { create, update } = useUserMutations()

  const [username, setUsername] = useState(user?.username ?? '')
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [password, setPassword] = useState('')
  // خياران للصورة الرمزية: أيقونة جاهزة أو صورة مرفوعة
  const [mode, setMode] = useState<AvatarMode>(user?.photo ? 'photo' : 'icon')
  const [avatar, setAvatar] = useState(user?.avatar || AVATAR_OPTIONS[0].key)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  const saving = create.isPending || update.isPending
  const currentPhoto = preview ?? user?.photo ?? null
  const canSubmit = username.trim() !== '' && (user !== null || password !== '') && !saving

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setPhotoFile(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  const handleError = (err: Error) =>
    setError(
      err.message.includes('API 4')
        ? err.message.includes('username')
          ? 'اسم المستخدم مستخدم مسبقاً — اختر اسماً آخر'
          : 'تعذر الحفظ — تحقق من البيانات'
        : 'تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000',
    )

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    const options = { onSuccess: onClose, onError: handleError }

    if (mode === 'photo') {
      if (photoFile) {
        // رفع صورة جديدة → multipart
        const data = new FormData()
        data.append('username', username.trim())
        data.append('first_name', firstName.trim())
        data.append('avatar', '')
        data.append('photo', photoFile)
        if (password) data.append('password', password)
        if (user) update.mutate({ id: user.id, data }, options)
        else create.mutate(data, options)
        return
      }
      if (user?.photo) {
        // إبقاء الصورة الحالية وتحديث بقية الحقول
        const data = {
          username: username.trim(),
          first_name: firstName.trim(),
          avatar: '',
          ...(password ? { password } : {}),
        }
        update.mutate({ id: user.id, data }, options)
        return
      }
      setError('اختر صورة أولاً أو بدّل إلى الأيقونات الجاهزة')
      return
    }

    // أيقونة جاهزة → JSON، مع مسح أي صورة مرفوعة سابقة
    const data = {
      username: username.trim(),
      first_name: firstName.trim(),
      avatar,
      photo: null,
      ...(password ? { password } : {}),
    }
    if (user) update.mutate({ id: user.id, data }, options)
    else create.mutate(data, options)
  }

  return (
    <Modal title={user ? 'تعديل الموظف' : 'موظف جديد'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* اختيار نوع الصورة الرمزية */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">الصورة الرمزية</label>
          <div className="mb-3 flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('icon')}
              className={cn(
                'rounded-md px-3 py-1 text-sm',
                mode === 'icon' ? 'bg-white font-medium text-slate-800 shadow-sm' : 'text-slate-500',
              )}
            >
              أيقونة جاهزة
            </button>
            <button
              type="button"
              onClick={() => setMode('photo')}
              className={cn(
                'rounded-md px-3 py-1 text-sm',
                mode === 'photo' ? 'bg-white font-medium text-slate-800 shadow-sm' : 'text-slate-500',
              )}
            >
              رفع صورة
            </button>
          </div>

          {mode === 'icon' ? (
            <div className="flex flex-wrap gap-2">
              {AVATAR_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  onClick={() => setAvatar(option.key)}
                  title={option.key}
                  style={{ backgroundColor: `${option.bg}26` }}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none transition-transform hover:scale-110',
                    avatar === option.key && 'ring-2 ring-blue-600 ring-offset-2',
                  )}
                >
                  {option.emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {currentPhoto ? (
                <img src={currentPhoto} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Camera size={22} />
                </span>
              )}
              <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600">
                {currentPhoto ? 'تغيير الصورة' : 'اختيار صورة'}
                <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
              </label>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">الاسم الظاهر</label>
          <input
            autoFocus
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="مثال: أحمد الفخار"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">اسم المستخدم</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="مثال: ahmad"
            dir="ltr"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={user ? 'اتركها فارغة للإبقاء على الحالية' : ''}
            dir="ltr"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'جارٍ الحفظ…' : user ? 'حفظ التعديلات' : 'إضافة الموظف'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
