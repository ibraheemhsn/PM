import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectMutations } from '../../hooks/useProjects'
import { COLOR_PALETTE, type Project } from '../../types'
import { ColorPicker } from '../ui/ColorPicker'
import { Modal } from '../ui/Modal'

interface ProjectFormModalProps {
  /** null → إنشاء مشروع جديد */
  project: Project | null
  onClose: () => void
}

export function ProjectFormModal({ project, onClose }: ProjectFormModalProps) {
  const { create, update } = useProjectMutations()
  const navigate = useNavigate()

  const [title, setTitle] = useState(project?.title ?? '')
  const [color, setColor] = useState(project?.color ?? COLOR_PALETTE[5])

  const saving = create.isPending || update.isPending

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || saving) return

    if (project) {
      update.mutate({ id: project.id, data: { title: trimmed, color } }, { onSuccess: onClose })
    } else {
      create.mutate(
        { title: trimmed, color },
        {
          onSuccess: (created) => {
            onClose()
            navigate(`/projects/${created.id}`)
          },
        },
      )
    }
  }

  return (
    <Modal title={project ? 'تعديل المشروع' : 'مشروع جديد'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">عنوان المشروع</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: توسعة مصنع الرياض — خط الإنتاج الثاني"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">اللون المميز</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'جارٍ الحفظ…' : project ? 'حفظ التعديلات' : 'إنشاء المشروع'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
