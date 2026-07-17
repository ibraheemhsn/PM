import { useEffect, useState } from 'react'
import { Outlet, useMatch } from 'react-router-dom'
import { CommandPalette } from '../search/CommandPalette'
import { TaskFormModal } from '../tasks/TaskFormModal'
import { Sidebar } from './Sidebar'

/** الإطار العام: شريط جانبي + مساحة المحتوى + اختصارات لوحة المفاتيح:
 *  K أو Ctrl+K = البحث الشامل، N = مهمة جديدة (اقتراح للموظف). */
export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)

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
      <Sidebar onOpenSearch={() => setPaletteOpen(true)} />
      <main className="flex-1 overflow-y-auto">
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
