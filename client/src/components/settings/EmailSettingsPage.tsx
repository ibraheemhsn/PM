import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Mail, Plug, Save, Unlink, XCircle } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type EmailSettingsInput } from '../../lib/api'
import { cn } from '../../lib/utils'

/** شعار Google الملون — للاستخدام في زر «تسجيل الدخول عبر Google» */
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/** صفحة «إعدادات البريد»: ربط بريد المستخدم الشخصي (IMAP للاستلام +
 *  SMTP للإرسال) — أساس قسم «الإيميلات» في صفحات المشاريع.
 *  القيم الافتراضية جاهزة لحساب Google (Gmail). */
export function EmailSettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: api.email.settings,
  })
  // نتيجة العودة من شاشة موافقة Google (?google=connected|error)
  const [searchParams, setSearchParams] = useSearchParams()
  const googleResult = searchParams.get('google')
  useEffect(() => {
    if (!googleResult) return
    const timer = setTimeout(() => setSearchParams({}, { replace: true }), 6000)
    return () => clearTimeout(timer)
  }, [googleResult, setSearchParams])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [imapHost, setImapHost] = useState('imap.gmail.com')
  const [imapPort, setImapPort] = useState(993)
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com')
  const [smtpPort, setSmtpPort] = useState(587)

  // املأ النموذج بالإعدادات المحفوظة عند وصولها
  useEffect(() => {
    const saved = data?.settings
    if (!saved) return
    setEmail(saved.email_address)
    setImapHost(saved.imap_host)
    setImapPort(saved.imap_port)
    setSmtpHost(saved.smtp_host)
    setSmtpPort(saved.smtp_port)
  }, [data])

  const save = useMutation({
    mutationFn: (input: EmailSettingsInput) => api.email.saveSettings(input),
    onSuccess: () => {
      setPassword('')
      queryClient.invalidateQueries({ queryKey: ['email-settings'] })
      queryClient.invalidateQueries({ queryKey: ['emails'] })
    },
  })
  const test = useMutation({ mutationFn: api.email.test })
  const disconnect = useMutation({
    mutationFn: api.email.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] })
      queryClient.invalidateQueries({ queryKey: ['emails'] })
    },
  })

  const configured = !!data?.configured
  const googleAvailable = !!data?.google_available
  const connectedViaGoogle = configured && data?.settings?.auth_method === 'GOOGLE'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || save.isPending) return
    save.mutate({
      email_address: email.trim(),
      // فارغة عند التعديل = الإبقاء على المحفوظة
      ...(password ? { password } : {}),
      imap_host: imapHost.trim(),
      imap_port: imapPort,
      smtp_host: smtpHost.trim(),
      smtp_port: smtpPort,
    })
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400'

  if (isLoading) return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold text-slate-900">
        <Mail size={22} className="text-blue-600" />
        إعدادات البريد
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        اربط بريدك الشخصي ليعرض قسم «الإيميلات» في كل مشروع الرسائل التي يحمل
        موضوعها وسم المشروع.
      </p>

      {/* رسالة العودة من شاشة موافقة Google */}
      {googleResult === 'connected' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          تم ربط حساب Google بنجاح — قسم «الإيميلات» جاهز في صفحات المشاريع.
        </div>
      )}
      {googleResult === 'error' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle size={16} className="shrink-0" />
          لم يكتمل ربط Google — أعد المحاولة، وتأكد من الموافقة على صلاحية البريد.
        </div>
      )}

      {/* ===== الربط عبر Google (الموصى به) ===== */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-bold text-slate-700">الربط عبر حساب Google (موصى به)</h2>
        <p className="mb-3 text-xs text-slate-500">
          موافقة واحدة بلا كلمات مرور — الصلاحية تشمل الاستلام والإرسال وتتجدد تلقائياً،
          ويمكنك إلغاؤها من حساب Google في أي وقت.
        </p>

        {connectedViaGoogle ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <GoogleLogo size={16} />
              <span dir="ltr">{data?.settings?.email_address}</span>
              — مرتبط عبر Google ✓
            </span>
            <button
              onClick={() => {
                if (confirm('فصل حساب Google؟ سيتوقف قسم «الإيميلات» حتى تعيد الربط.'))
                  disconnect.mutate()
              }}
              disabled={disconnect.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              <Unlink size={14} />
              {disconnect.isPending ? 'جارٍ الفصل…' : 'فصل الحساب'}
            </button>
          </div>
        ) : googleAvailable ? (
          /* التحويل لشاشة موافقة Google — تنقّل كامل وليس fetch */
          <a
            href="/api/email/oauth/start/"
            className="inline-flex items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <GoogleLogo />
            تسجيل الدخول عبر Google
          </a>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
            غير مفعّل على الخادم بعد — يتطلب ضبط <code dir="ltr">GOOGLE_CLIENT_ID</code> و
            <code dir="ltr">GOOGLE_CLIENT_SECRET</code> في متغيرات البيئة (بيانات عميل OAuth
            من Google Cloud Console). حتى ذلك الحين استخدم الربط اليدوي أدناه.
          </div>
        )}
      </div>

      {/* ===== الربط اليدوي (بديل) ===== */}
      <h2 className="mb-1 text-sm font-bold text-slate-700">الربط اليدوي (بديل)</h2>
      {/* إرشاد حساب Google: يتطلب كلمة مرور تطبيق */}
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
        حساب Google لا يقبل كلمة المرور العادية — فعّل «التحقق بخطوتين» ثم أنشئ{' '}
        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline"
        >
          كلمة مرور تطبيق (App Password)
        </a>{' '}
        واستخدمها هنا. القيم الافتراضية أدناه جاهزة لـ Gmail.
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            عنوان البريد الإلكتروني
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            placeholder="you@gmail.com"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            كلمة المرور{' '}
            <span className="text-[11px] font-normal text-slate-400">
              {configured ? '(اتركها فارغة للإبقاء على المحفوظة)' : '(كلمة مرور التطبيق)'}
            </span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            placeholder={configured ? '••••••••' : 'xxxx xxxx xxxx xxxx'}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              خادم الاستلام (IMAP)
            </label>
            <input
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              dir="ltr"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">منفذ IMAP</label>
            <input
              type="number"
              value={imapPort}
              onChange={(e) => setImapPort(Number(e.target.value))}
              dir="ltr"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              خادم الإرسال (SMTP)
            </label>
            <input
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              dir="ltr"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">منفذ SMTP</label>
            <input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(Number(e.target.value))}
              dir="ltr"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={!email.trim() || save.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={15} />
            {save.isPending ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}
          </button>
          <button
            type="button"
            onClick={() => test.mutate()}
            disabled={!configured || test.isPending}
            title={configured ? 'اختبار الاتصال بالإعدادات المحفوظة' : 'احفظ الإعدادات أولاً'}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
          >
            <Plug size={15} />
            {test.isPending ? 'جارٍ الاختبار…' : 'اختبار الاتصال'}
          </button>
          {save.isSuccess && !save.isPending && (
            <span className="text-xs font-medium text-emerald-600">حُفظت الإعدادات ✓</span>
          )}
        </div>
      </form>

      {/* نتيجة اختبار الاتصال — لكل جهة على حدة */}
      {test.data && (
        <div className="mt-4 space-y-2">
          {(
            [
              { ok: test.data.imap_ok, error: test.data.imap_error, label: 'الاستلام (IMAP)' },
              { ok: test.data.smtp_ok, error: test.data.smtp_error, label: 'الإرسال (SMTP)' },
            ] as const
          ).map((item) => (
            <div
              key={item.label}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                item.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700',
              )}
            >
              {item.ok ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : (
                <XCircle size={16} className="mt-0.5 shrink-0" />
              )}
              <span>
                <span className="font-medium">{item.label}: </span>
                {item.ok ? 'الاتصال ناجح' : item.error}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
