import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CommandPalette } from '../search/CommandPalette'
import { Sidebar } from './Sidebar'

/** الإطار العام: شريط جانبي + مساحة المحتوى + البحث الشامل (K أو Ctrl+K). */
export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // e.code يضمن عمل الاختصار حتى مع تخطيط لوحة المفاتيح العربية
      const isK = e.code === 'KeyK' || e.key.toLowerCase() === 'k'
      if (!isK) return

      // Ctrl+K (أو Cmd+K) يعمل دائماً
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      if (e.altKey) return

      // حرف K وحده: يفتح البحث فقط خارج حقول الكتابة كي لا يعطّل الإدخال
      const target = e.target as HTMLElement | null
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (isTyping) return
      e.preventDefault()
      setPaletteOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      <Sidebar onOpenSearch={() => setPaletteOpen(true)} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}
