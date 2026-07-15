import { X } from 'lucide-react'
import { useEffect } from 'react'

/** عارض صور مكبّر — يُغلق بالنقر في أي مكان أو بزر Esc. */
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-slate-900/90 p-6"
      onClick={onClose}
    >
      <button
        className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="إغلاق"
      >
        <X size={20} />
      </button>
      <img src={src} alt="" className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain" />
    </div>
  )
}
