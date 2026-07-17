import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useMatch } from 'react-router-dom'
import { enablePush, registerServiceWorker } from '../../lib/pwa'
import { cn } from '../../lib/utils'
import { CommandPalette } from '../search/CommandPalette'
import { TaskFormModal } from '../tasks/TaskFormModal'
import { Sidebar } from './Sidebar'

/** الإطار العام: شريط جانبي (درج منزلق على الجوال) + مساحة المحتوى
 *  + اختصارات لوحة المفاتيح: K أو Ctrl+K = البحث الشامل، N = مهمة جديدة. */
export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  // درج الشريط الجانبي على الجوال — يُغلق عند التنقل أو النقر خارجه
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setSidebarOpen(false), [location.pathname])

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
      {/* شريط علوي للجوال: زر القائمة + الاسم */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 bg-slate-900 px-4 py-3 text-white lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="فتح القائمة"
          className="rounded-lg p-1 hover:bg-slate-800"
        >
          <Menu size={20} />
        </button>
        <span className="font-bold">شركة الفخار</span>
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
