import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** نافذة منبثقة عامة — تُغلق بزر Esc أو بالنقر خارجها. */
export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-24"
      onMouseDown={onClose}
    >
      <div
        // text-slate-800 يعيد ضبط لون النص — النافذة قد تُستدعى من داخل
        // الشريط الجانبي الداكن فترث نصه الفاتح
        className="w-full max-w-lg rounded-xl bg-white text-slate-800 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
