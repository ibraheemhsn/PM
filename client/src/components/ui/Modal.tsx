import { X } from 'lucide-react'
import { useEffect, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** مرجع لحاوية التمرير الداخلية — للسحب العمودي (التنقل بين العناصر) */
  bodyRef?: Ref<HTMLDivElement>
}

/** نافذة منبثقة عامة — تُغلق بزر Esc أو بالنقر خارجها.
 *  تُعرض عبر Portal إلى body كي لا تنحصر داخل أي عنصر أب فيه transform
 *  (كالشريط الجانبي المنزلق) فتبقى متمركزة نسبةً للشاشة كاملة. */
export function Modal({ title, onClose, children, bodyRef }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-16"
      onMouseDown={onClose}
    >
      <div
        // text-slate-800 يعيد ضبط لون النص — النافذة قد تُستدعى من داخل
        // الشريط الجانبي الداكن فترث نصه الفاتح.
        // max-h + عمود مرن: المحتوى الطويل يتمرر داخلياً بدل أن يُقص أسفل الشاشة
        className="flex max-h-full w-full max-w-lg flex-col rounded-xl bg-white text-slate-800 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>
        <div ref={bodyRef} className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
