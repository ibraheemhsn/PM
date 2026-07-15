import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuthMutations } from '../../hooks/useAuth'

export function LoginPage() {
  const { login } = useAuthMutations()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password || login.isPending) return
    setError('')
    login.mutate(
      { username: username.trim(), password },
      {
        // ميّز خطأ البيانات (400) عن أعطال الاتصال بالخادم
        onError: (err) =>
          setError(
            err.message.includes('API 400')
              ? 'اسم المستخدم أو كلمة المرور غير صحيحة'
              : 'تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000 ثم أعد المحاولة',
          ),
      },
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-slate-900">شركة الفخار</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">تسجيل الدخول إلى لوحة إدارة المشاريع</p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">اسم المستخدم</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!username.trim() || !password || login.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <LogIn size={16} />
            {login.isPending ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
          </button>
        </div>
      </form>
    </div>
  )
}
