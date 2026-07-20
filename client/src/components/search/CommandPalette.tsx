import { useQuery } from '@tanstack/react-query'
import { Folder, History, Mail, Megaphone, MessageSquare, Paperclip, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { useAllAttachments, useProjects } from '../../hooks/useProjects'
import { useTasks } from '../../hooks/useTasks'
import { api } from '../../lib/api'
import {
  addRecentSearch, loadRecentSearches, removeRecentSearch,
  type RecentSearchItem,
} from '../../lib/recentSearches'
import { arabicToLatinKeys, cn, latinToArabicKeys, stripHtml } from '../../lib/utils'
import { StatusIcon } from '../tasks/StatusIcon'

/** نتيجة بحث — نفس بنية العنصر المحفوظ في سجل «الأخيرة» */
type SearchResult = RecentSearchItem

const GROUP_LABELS = {
  project: 'المشاريع', task: 'المهام', attachment: 'المرفقات',
  comment: 'التعليقات', update: 'التحديثات', email: 'البريد',
} as const

/** مقتطف نصي حول موضع التطابق — لعرض سياق النتيجة */
function excerpt(text: string, query: string, radius = 35): string {
  const index = text.toLowerCase().indexOf(query)
  if (index === -1) return ''
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + query.length + radius)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

interface CommandPaletteProps {
  onClose: () => void
}

/** البحث الشامل الفوري (Ctrl+K): عناوين المشاريع وتفاصيلها + عناوين المهام
 *  + المرفقات (اسم الملف والوصف).
 *  يبحث في بيانات React Query المخزّنة محلياً، فالنتائج لحظية بلا أي طلب شبكة. */
export function CommandPalette({ onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: projects = [] } = useProjects()
  const { data: tasks = [] } = useTasks()
  const { data: attachments = [] } = useAllAttachments()

  const userId = me?.id ?? 0
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  // سجل «عمليات البحث الأخيرة» — يُعرض عندما يكون حقل البحث فارغاً
  const [recents, setRecents] = useState<RecentSearchItem[]>(() => loadRecentSearches(userId))

  // البحث في التعليقات والتحديثات يجري على الخادم (نصوصها غير مخزّنة محلياً).
  // نؤخّر الاستعلام قليلاً كي لا يُطلق مع كل ضغطة مفتاح.
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const q = query.trim()
    const timer = setTimeout(() => setDebouncedQuery(q), 220)
    return () => clearTimeout(timer)
  }, [query])

  const { data: serverResults, isFetching: searchingServer } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => api.search.global(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    // البحث الذكي: العبارة كما كُتبت + تحويلها بين تخطيطي اللوحة —
    // «fdzm» بالحروف اللاتينية تطابق «بيئة»، و«يبلي» بالعربية تطابق «dfgd»
    const variants = [...new Set([q, latinToArabicKeys(q), arabicToLatinKeys(q)])]
    const findMatch = (text: string): string | undefined => {
      const lower = text.toLowerCase()
      return variants.find((variant) => lower.includes(variant))
    }

    const projectHits: SearchResult[] = projects
      .map((p): SearchResult | null => {
        const titleMatch = findMatch(p.title)
        const detailsText = stripHtml(p.details)
        const detailsMatch = titleMatch ? undefined : findMatch(detailsText)
        if (!titleMatch && !detailsMatch) return null
        return {
          type: 'project',
          key: `project-${p.id}`,
          title: p.title,
          subtitle: detailsMatch ? excerpt(detailsText, detailsMatch) : `${p.tasks_count} مهمة`,
          color: p.color,
          to: `/projects/${p.id}`,
        }
      })
      .filter((r): r is SearchResult => r !== null)
      .slice(0, 6)

    const taskHits: SearchResult[] = tasks
      .filter((t) => !t.project_archived && findMatch(t.title))
      .slice(0, 8)
      .map((t) => ({
        type: 'task' as const,
        key: `task-${t.id}`,
        title: t.title,
        subtitle: t.project_title,
        color: t.project_color,
        to: `/projects/${t.project}`,
        status: t.status,
      }))

    const attachmentHits: SearchResult[] = attachments
      .map((a): SearchResult | null => {
        const nameMatch = findMatch(a.file_name)
        const descriptionMatch = nameMatch ? undefined : findMatch(a.description)
        if (!nameMatch && !descriptionMatch) return null
        return {
          type: 'attachment',
          key: `attachment-${a.id}`,
          title: a.file_name,
          subtitle: descriptionMatch
            ? excerpt(a.description, descriptionMatch)
            : a.description || a.project_title,
          color: a.project_color,
          to: `/projects/${a.project}`,
          href: a.file,
        }
      })
      .filter((r): r is SearchResult => r !== null)
      .slice(0, 6)

    // نتائج الخادم للتعليقات والتحديثات — المقتطف حول موضع التطابق هو العنوان
    const serverQuery = debouncedQuery.toLowerCase()
    const snippet = (text: string) => {
      const match = findMatch(text) ?? serverQuery
      return excerpt(text, match) || text.slice(0, 70)
    }

    const commentHits: SearchResult[] = (serverResults?.comments ?? []).map((c) => {
      const text = stripHtml(c.body)
      return {
        type: 'comment' as const,
        key: `comment-${c.id}`,
        title: snippet(text),
        subtitle: `تعليق في «${c.task_title}» — ${c.project_title}`,
        color: c.project_color,
        to: `/projects/${c.project}?focus=task-${c.task}`,
      }
    })

    const updateHits: SearchResult[] = (serverResults?.updates ?? []).map((u) => {
      const text = stripHtml(u.body)
      return {
        type: 'update' as const,
        key: `update-${u.id}`,
        title: snippet(text),
        subtitle: `تحديث — ${u.project_title}`,
        color: u.project_color,
        to: `/projects/${u.project}?focus=updates`,
      }
    })

    const emailHits: SearchResult[] = (serverResults?.emails ?? []).map((m) => ({
      type: 'email' as const,
      key: `email-${m.id}`,
      title: m.subject || '(بلا موضوع)',
      subtitle: m.project_title
        ? `${m.folder === 'sent' ? 'صادر' : 'وارد'} — ${m.project_title}`
        : m.preview || m.sender,
      color: m.project_color || '#64748b',
      to: `/mail?open=${m.id}`,
    }))

    return [
      ...projectHits, ...taskHits, ...attachmentHits,
      ...commentHits, ...updateHits, ...emailHits,
    ]
  }, [query, debouncedQuery, projects, tasks, attachments, serverResults])

  // أعد المؤشر لأول نتيجة كلما تغيّر نص البحث
  useEffect(() => setActiveIndex(0), [query])

  // القائمة المعروضة: نتائج البحث، أو «الأخيرة» عندما يكون الحقل فارغاً
  const showingRecents = !query.trim()
  const displayed = showingRecents ? recents : results

  const open = (result: SearchResult) => {
    // كل نتيجة مفتوحة تدخل سجل «الأخيرة» (بلا تكرار — تصعد للمقدمة)
    setRecents(addRecentSearch(userId, result))
    // المرفق: افتح الملف نفسه في تبويب جديد؛ والبقية تنقّل داخلي
    if (result.href) {
      window.open(result.href, '_blank', 'noopener')
    } else {
      navigate(result.to)
    }
    onClose()
  }

  const removeRecent = (key: string) => {
    setRecents(removeRecentSearch(userId, key))
    setActiveIndex((i) => Math.max(0, Math.min(i, recents.length - 2)))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, displayed.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (displayed[activeIndex]) open(displayed[activeIndex])
        break
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-[15vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* حقل البحث */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ابحث في المشاريع والمهام والمرفقات والتعليقات والتحديثات…"
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            Esc
          </kbd>
        </div>

        {/* النتائج الفورية — أو «عمليات البحث الأخيرة» عندما يكون الحقل فارغاً */}
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim() && results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-slate-400">
              {searchingServer ? 'جارٍ البحث…' : 'لا توجد نتائج مطابقة'}
            </li>
          )}
          {showingRecents && recents.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-slate-400">
              اكتب للبحث في كل المشاريع والمهام والمرفقات والتعليقات والتحديثات
            </li>
          )}
          {showingRecents && recents.length > 0 && (
            <li>
              <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-bold text-slate-400">
                <History size={13} />
                عمليات البحث الأخيرة
              </p>
            </li>
          )}
          {displayed.map((result, index) => (
            <li key={result.key}>
              {/* عنوان المجموعة عند أول نتيجة من نوعها (في وضع البحث فقط) */}
              {!showingRecents && result.type !== displayed[index - 1]?.type && (
                <p className="px-3 pb-1 pt-2 text-xs font-bold text-slate-400">
                  {GROUP_LABELS[result.type]}
                </p>
              )}
              <div
                className={cn(
                  'group/row flex w-full items-center rounded-lg',
                  index === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-50',
                )}
              >
                <button
                  ref={index === activeIndex ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  onClick={() => open(result)}
                  onMouseMove={() => setActiveIndex(index)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-start"
                >
                  {result.type === 'project' ? (
                    <Folder size={17} style={{ color: result.color }} className="shrink-0" />
                  ) : result.type === 'attachment' ? (
                    <Paperclip size={17} style={{ color: result.color }} className="shrink-0" />
                  ) : result.type === 'comment' ? (
                    <MessageSquare size={17} style={{ color: result.color }} className="shrink-0" />
                  ) : result.type === 'update' ? (
                    <Megaphone size={17} style={{ color: result.color }} className="shrink-0" />
                  ) : result.type === 'email' ? (
                    <Mail size={17} style={{ color: result.color }} className="shrink-0" />
                  ) : (
                    <StatusIcon status={result.status!} size={17} className="shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {result.title}
                    </span>
                    {result.subtitle && (
                      <span className="block truncate text-xs text-slate-400">{result.subtitle}</span>
                    )}
                  </span>
                </button>
                {/* حذف العنصر من سجل «الأخيرة» — يظهر عند التحويم */}
                {showingRecents && (
                  <button
                    onClick={() => removeRecent(result.key)}
                    className="me-2 shrink-0 rounded p-1 text-slate-300 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-600 group-hover/row:opacity-100"
                    title="إزالة من السجل"
                    aria-label={`إزالة «${result.title}» من سجل البحث`}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* تلميحات الاستخدام */}
        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <span>↑↓ للتنقل</span>
          <span>Enter للفتح</span>
          <span>Esc للإغلاق</span>
        </div>
      </div>
    </div>
  )
}
