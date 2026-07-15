import { cn } from '../../lib/utils'
import { COLOR_PALETTE } from '../../types'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  /** يتيح خيار «بدون لون» (قيمة فارغة) — مفيد للمهام */
  allowNone?: boolean
}

export function ColorPicker({ value, onChange, allowNone }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="بدون لون"
          className={cn(
            'h-7 w-7 rounded-full border-2 border-dashed border-slate-300 text-xs text-slate-400',
            value === '' && 'ring-2 ring-slate-400 ring-offset-2',
          )}
        >
          ـ
        </button>
      )}
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          title={color}
          style={{ backgroundColor: color }}
          className={cn(
            'h-7 w-7 rounded-full transition-transform hover:scale-110',
            value === color && 'ring-2 ring-slate-500 ring-offset-2',
          )}
        />
      ))}
    </div>
  )
}
