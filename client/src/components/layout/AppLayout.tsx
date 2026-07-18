import { Menu, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useMatch } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { enablePush, registerServiceWorker } from '../../lib/pwa'
import { cn } from '../../lib/utils'
import { CommandPalette } from '../search/CommandPalette'
import { TaskFormModal } from '../tasks/TaskFormModal'
import { Sidebar } from './Sidebar'

/** الإطار العام: شريط جانبي (درج منزلق على الجوال) + مساحة المحتوى
 *  + اختصارات لوحة المفاتيح: K أو Ctrl+K = البحث الشامل، N = مهمة جديدة. */
export function AppLayout() {
  const { data: me } = useMe()
  // الصفحة الرئيسية للمدير لوحة الإحصائيات، وللموظف قائمة مهامه
  const homePath = me?.is_manager ? '/dashboard' : '/tasks'

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  // درج الشريط الجانبي على الجوال — يُغلق عند التنقل أو النقر خارجه
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setSidebarOpen(false), [location.pathname])

  // السحب من الحافة اليمنى (RTL) يفتح الدرج — مكافئ لزر الهمبرغر
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touchStart.current = { x: t.clientX, y: t.clientY }
    }
    const onEnd = (e: TouchEvent) => {
      const start = touchStart.current
      touchStart.current = null
      if (!start || sidebarOpen || window.innerWidth >= 1024) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      // بدأ من حافة اليمين، وسحب لليسار أفقياً بمسافة كافية
      if (start.x > window.innerWidth - 32 && dx < -60 && Math.abs(dy) < 50) {
        setSidebarOpen(true)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [sidebarOpen])

  // PWA: سجّل الـ Service Worker، وإن كان إذن الإشعارات ممنوحاً أصلاً
  // فأعد مزامنة اشتراك Web Push لهذا الجهاز (يتجدد endpoint أحياناً)
  useEffect(() => {
    void registerServiceWorker().then(() => {
      if ('Notification' in window && Notification.permission === 'granted') {
        void enablePush()
      }
    })
  }, [])

  // إن كنا داخل صفحة مشروع، يصبح هو الافتراضي في نموذج المهمة الجديدة
  const projectMatch = useMatch('/projects/:projectId')
  const defaultProjectId = projectMatch ? Number(projectMatch.params.projectId) : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // لا اختصارات أثناء الكتابة في الحقول كي لا يتعطل الإدخال
      const target = e.target as HTMLElement | null
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      // e.code يضمن عمل الاختصارات حتى مع تخطيط لوحة المفاتيح العربية
      const isK = e.code === 'KeyK' || e.key.toLowerCase() === 'k'
      if (isK) {
        // Ctrl+K (أو Cmd+K) يعمل دائماً
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          setPaletteOpen((open) => !open)
          return
        }
        if (e.altKey || isTyping) return
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      // حرف N وحده: «مهمة جديدة» للمدير و«اقتراح مهمة» للموظف
      const isN = e.code === 'KeyN' || e.key.toLowerCase() === 'n'
      if (isN && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping) {
        e.preventDefault()
        setNewTaskOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      {/* شريط علوي للجوال: زر القائمة + الاسم (يوجّه للرئيسية) + البحث */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 bg-slate-900 px-4 py-3 text-white lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="فتح القائمة"
          className="rounded-lg p-1 hover:bg-slate-800"
        >
          <Menu size={20} />
        </button>
        <Link to={homePath} className="font-bold hover:text-blue-300">
          شركة الفخار
        </Link>
        {/* أقصى اليسار في RTL */}
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label="بحث"
          className="ms-auto rounded-lg p-1 hover:bg-slate-800"
        >
          <Search size={20} />
        </button>
      </header>

      {/* خلفية إغلاق الدرج على الجوال */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* الشريط الجانبي: درج منزلق من اليمين على الجوال، ثابت على الشاشات الكبيرة */}
      <div
        className={cn(
          'fixed inset-y-0 start-0 z-50 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <Sidebar
          onOpenSearch={() => {
            setPaletteOpen(true)
            setSidebarOpen(false)
          }}
        />
      </div>

      <main className="flex-1 overflow-y-auto pt-12 lg:pt-0">
        <Outlet />
      </main>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {newTaskOpen && (
        <TaskFormModal
          task={null}
          defaultProjectId={defaultProjectId}
          onClose={() => setNewTaskOpen(false)}
        />
      )}
    </div>
  )
}
