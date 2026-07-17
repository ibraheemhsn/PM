import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'

/** عارض صور مكبّر:
 *  - النقر خارج الصورة (أو Esc أو زر الإغلاق) يغلق العارض
 *  - النقر على الصورة يبدّل بين الاحتواء والحجم الكامل (تكبير/تصغير)
 *  - زر تحميل أعلى العارض */
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] bg-slate-900/90 p-6',
        zoomed ? 'overflow-auto' : 'flex items-center justify-center',
      )}
      onClick={onClose}
    >
      {/* أزرار عائمة تبقى ظاهرة حتى مع تمرير الصورة المكبرة */}
      <button
        onClick={onClose}
        className="fixed end-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="إغلاق"
        title="إغلاق"
      >
        <X size={20} />
      </button>
      <a
        href={src}
        download
        onClick={(e) => e.stopPropagation()}
        className="fixed end-16 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        title="تحميل الصورة"
      >
        <Download size={20} />
      </a>

      <img
        src={src}
        alt=""
        // النقر على الصورة نفسها يكبّر/يصغّر ولا يغلق العارض
        onClick={(e) => {
          e.stopPropagation()
          setZoomed((v) => !v)
        }}
        className={cn(
          'rounded-lg',
          zoomed
            ? 'mx-auto max-h-none max-w-none cursor-zoom-out'
            : 'max-h-[90vh] max-w-[92vw] cursor-zoom-in object-contain',
        )}
      />
    </div>
  )
}
