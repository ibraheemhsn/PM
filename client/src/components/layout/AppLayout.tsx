import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CommandPalette } from '../search/CommandPalette'
import { Sidebar } from './Sidebar'

/** الإطار العام: شريط جانبي + مساحة المحتوى + البحث الشامل (Ctrl+K). */
export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // e.code يضمن عمل الاختصار حتى مع تخطيط لوحة المفاتيح العربية
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
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
