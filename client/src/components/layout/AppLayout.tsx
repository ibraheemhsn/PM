import {
  Archive, ArrowDownUp, History, Menu, Paperclip, Trash2, Users,
} from 'lucide-react'
import {
  useEffect, useRef, useState, type ReactNode, type RefObject,
} from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { enablePush, registerServiceWorker } from '../../lib/pwa'
import { cn } from '../../lib/utils'
import { ProjectOrderModal } from '../projects/ProjectOrderModal'
import { CommandPalette } from '../search/CommandPalette'
import { TaskFormModal } from '../tasks/TaskFormModal'
import { Avatar } from '../ui/Avatar'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

/** رابط داخل قائمة المستخدم المنسدلة — بنمط الشريط الجانبي الداكن */
function UserMenuLink({
  to, icon, onClick, children,
}: { to: string; icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-5 py-3 text-sm',
          isActive ? 'bg-slate-800 text-white' : 'text-slate-200 hover:bg-slate-800',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}

/** سياق يمرَّر للصفحات عبر Outlet — مرجع حاوية التمرير الرئيسية،
 *  ودالة لإخفاء الشريط الجانبي على الحاسوب (تُستخدم في عرض الكانبان/التقويم). */
export interface MainScrollContext {
  scrollRef: RefObject<HTMLElement | null>
  setSidebarCollapsed: (collapsed: boolean) => void
}

/** الإطار العام: شريط جانبي (درج منزلق على الجوال) + مساحة المحتوى
 *  + اختصارات لوحة المفاتيح: K أو Ctrl+K = البحث الشامل، N = مهمة جديدة. */
export function AppLayout() {
  const mainRef = useRef<HTMLElement>(null)
  const { data: me } = useMe()
  const isManager = !!me?.is_manager
  // الصفحة الرئيسية للمدير لوحة الإحصائيات، وللموظف قائمة مهامه
  const homePath = isManager ? '/dashboard' : '/tasks'

  // قائمة المستخدم المنسدلة (الجوال) من صورة المستخدم أعلى اليسار
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [orderingOpen, setOrderingOpen] = useState(false)
  const closeUserMenu = () => setUserMenuOpen(false)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  // درج الشريط الجانبي على الجوال — يُغلق عند التنقل أو النقر خارجه
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // إخفاء الشريط الجانبي على الحاسوب (عرض الكانبان/التقويم لمساحة أوسع)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setSidebarOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  // الشريط العلوي على الجوال: يختفي عند النزول في الصفحة ويظهر عند الصعود
  // — والشريط السفلي العائم يصبح شبه شفاف أثناء التمرير (بأي اتجاه)
  const [topBarHidden, setTopBarHidden] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const lastScrollTop = useRef(0)
  const scrollIdleTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onScroll = () => {
      // شفافية الشريط السفلي طوال التمرير، وتزول بعد توقف قصير
      setIsScrolling(true)
      window.clearTimeout(scrollIdleTimer.current)
      scrollIdleTimer.current = window.setTimeout(() => setIsScrolling(false), 250)

      const scrollTop = el.scrollTop
      const delta = scrollTop - lastScrollTop.current
      if (Math.abs(delta) < 8) return // تجاهل الاهتزازات الصغيرة
      setTopBarHidden(delta > 0 && scrollTop > 60)
      lastScrollTop.current = scrollTop
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.clearTimeout(scrollIdleTimer.current)
    }
  }, [])
  // عند التنقل لصفحة جديدة أظهر الشريط من جديد
  useEffect(() => setTopBarHidden(false), [location.pathname])

  // إيماءات الدرج على الجوال (RTL): سحب لليسار من النصف الأيمن يفتحه،
  // وسحب لليمين (باتجاه حافته) وهو مفتوح يغلقه
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touchStart.current = { x: t.clientX, y: t.clientY }
    }
    const onEnd = (e: TouchEvent) => {
      const start = touchStart.current
      touchStart.current = null
      if (!start || window.innerWidth >= 1024) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      // سحب أفقي واضح (أطول من العمودي) كي لا يتداخل مع التمرير
      if (Math.abs(dx) <= Math.abs(dy) * 1.5) return
      if (!sidebarOpen && start.x > window.innerWidth / 2 && dx < -50) {
        setSidebarOpen(true)
      } else if (sidebarOpen && dx > 50) {
        setSidebarOpen(false)
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
      {/* شريط علوي للجوال: زر القائمة + الاسم (يوجّه للرئيسية) + البحث
          — ينزلق مختفياً عند النزول في الصفحة ويعود عند الصعود */}
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-30 flex items-center gap-3 bg-slate-900 px-4 py-3 text-white transition-transform duration-200 lg:hidden',
          topBarHidden && '-translate-y-full',
        )}
      >
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
        {/* أقصى اليسار في RTL: صورة المستخدم — تفتح قائمة الأدوات */}
        {me && (
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-label="قائمة المستخدم"
            className={cn('ms-auto rounded-full', userMenuOpen && 'ring-2 ring-blue-400')}
          >
            <Avatar user={me} size={30} />
          </button>
        )}
      </header>

      {/* قائمة المستخدم المنسدلة — بعرض الشاشة وبخلفية الشريط الجانبي الداكنة */}
      {userMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setUserMenuOpen(false)} />
          <div
            className={cn(
              'fixed inset-x-0 top-[52px] z-50 border-b border-slate-800 bg-slate-900 py-2 text-slate-100 shadow-xl transition-transform duration-200 lg:hidden',
              topBarHidden && '-translate-y-[200%]',
            )}
          >
            {isManager && (
              <UserMenuLink to="/employees" icon={<Users size={17} />} onClick={closeUserMenu}>
                الموظفون
              </UserMenuLink>
            )}
            <UserMenuLink to="/activity" icon={<History size={17} />} onClick={closeUserMenu}>
              سجل النشاطات
            </UserMenuLink>
            <button
              onClick={() => {
                setUserMenuOpen(false)
                setOrderingOpen(true)
              }}
              className="flex w-full items-center gap-3 px-5 py-3 text-start text-sm text-slate-200 hover:bg-slate-800"
            >
              <ArrowDownUp size={17} />
              ترتيب المشاريع
            </button>
            {isManager && (
              <>
                <UserMenuLink to="/attachments" icon={<Paperclip size={17} />} onClick={closeUserMenu}>
                  كل المرفقات
                </UserMenuLink>
                <UserMenuLink to="/archive" icon={<Archive size={17} />} onClick={closeUserMenu}>
                  الأرشيف
                </UserMenuLink>
                <UserMenuLink to="/trash" icon={<Trash2 size={17} />} onClick={closeUserMenu}>
                  المحذوفات
                </UserMenuLink>
              </>
            )}
          </div>
        </>
      )}

      {/* زر إظهار الشريط الجانبي على الحاسوب عند إخفائه (كانبان/تقويم) */}
      {collapsed && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="إظهار القائمة"
          className="fixed start-3 top-3 z-30 hidden rounded-lg bg-slate-900 p-2 text-white shadow-lg hover:bg-slate-800 lg:block"
        >
          <Menu size={18} />
        </button>
      )}

      {/* خلفية إغلاق الدرج — على الجوال دائماً، وعلى الحاسوب عند الإخفاء التلقائي */}
      {sidebarOpen && (
        <div
          className={cn('fixed inset-0 z-40 bg-slate-900/60', !collapsed && 'lg:hidden')}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* الشريط الجانبي: درج منزلق على الجوال (وعلى الحاسوب عند الإخفاء)،
          ثابت على الشاشات الكبيرة في الوضع العادي */}
      <div
        className={cn(
          'fixed inset-y-0 start-0 z-50 transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full',
          !collapsed && 'lg:static lg:z-auto lg:translate-x-0',
        )}
      >
        <Sidebar
          onOpenSearch={() => {
            setPaletteOpen(true)
            setSidebarOpen(false)
          }}
        />
      </div>

      {/* pb للجوال: مساحة لشريط التنقل السفلي العائم كي لا يغطي آخر المحتوى */}
      <main ref={mainRef} className="flex-1 overflow-y-auto pb-24 pt-12 lg:pb-0 lg:pt-0">
        <Outlet
          context={
            { scrollRef: mainRef, setSidebarCollapsed: setCollapsed } satisfies MainScrollContext
          }
        />
      </main>

      {/* شريط التنقل السفلي — جوال فقط، شبه شفاف أثناء التمرير */}
      <BottomNav onOpenSearch={() => setPaletteOpen(true)} dimmed={isScrolling} />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {newTaskOpen && (
        <TaskFormModal
          task={null}
          defaultProjectId={defaultProjectId}
          onClose={() => setNewTaskOpen(false)}
        />
      )}
      {orderingOpen && <ProjectOrderModal onClose={() => setOrderingOpen(false)} />}
    </div>
  )
}
