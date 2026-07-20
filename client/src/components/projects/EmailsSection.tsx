import { useQuery } from '@tanstack/react-query'
import { Mail, RefreshCw, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { cn, formatDate } from '../../lib/utils'
import type { Project } from '../../types'

/** يستخرج رسالة الخطأ العربية من نص خطأ الـ API (API 400: {"detail": "..."}) */
function errorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/"detail"\s*:\s*"([^"]+)"/)
  return match ? match[1] : 'تعذر جلب الإيميلات — تحقق من إعدادات البريد.'
}

/** قسم «الإيميلات» في صفحة المشروع: رسائل وارد المستخدم التي يحمل
 *  موضوعها «وسم المشروع». يتطلب ربط البريد من صفحة إعدادات البريد. */
export function EmailsSection({ project }: { project: Project }) {
  const hasTag = !!project.email_tag.trim()

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['emails', project.id],
    queryFn: () => api.email.forProject(project.id),
    enabled: hasTag,
    staleTime: 60_000,
    retry: false, // فشل الاتصال بخادم البريد لا يستفيد من الإعادة التلقائية
  })

  const messages = data?.messages ?? []

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-slate-700">
          <Mail size={17} className="text-blue-600" />
          الإيميلات
          {hasTag && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-normal text-blue-600" dir="auto">
              {project.email_tag}
            </span>
          )}
          {data && (
            <span className="text-sm font-normal text-slate-400">({messages.length})</span>
          )}
        </h2>
        {hasTag && (
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="تحديث القائمة من خادم البريد"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />
            تحديث
          </button>
        )}
      </div>

      {!hasTag && (
        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          حدد «وسم المشروع» من تعديل المشروع — الرسائل التي يحمل موضوعها الوسم
          ستظهر هنا تلقائياً.
        </p>
      )}

      {hasTag && isFetching && !data && (
        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          جارٍ جلب الإيميلات من خادم البريد…
        </p>
      )}

      {hasTag && isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{errorDetail(error)}</span>
          <Link
            to="/email-settings"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-amber-300 hover:bg-amber-100"
          >
            <Settings size={13} />
            إعدادات البريد
          </Link>
        </div>
      )}

      {hasTag && data && messages.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          لا توجد رسائل يحمل موضوعها «{project.email_tag}» في صندوق الوارد.
        </p>
      )}

      <div className="space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-sm font-medium leading-snug text-slate-800" dir="auto">
              {message.subject}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
              <span dir="ltr" className="truncate">{message.sender}</span>
              {message.date && <span>{formatDate(message.date)}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
