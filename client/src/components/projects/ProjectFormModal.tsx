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
  const [shareLink, setShareLink] = useState(project?.share_link ?? '')
  const [outgoingLink, setOutgoingLink] = useState(project?.outgoing_link ?? '')
  const [accountsLink, setAccountsLink] = useState(project?.accounts_link ?? '')
  const [incomingLink, setIncomingLink] = useState(project?.incoming_link ?? '')

  const saving = create.isPending || update.isPending

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || saving) return
    const data = {
      title: trimmed,
      color,
      share_link: shareLink.trim(),
      outgoing_link: outgoingLink.trim(),
      accounts_link: accountsLink.trim(),
      incoming_link: incomingLink.trim(),
    }

    if (project) {
      update.mutate({ id: project.id, data }, { onSuccess: onClose })
    } else {
      create.mutate(
        data,
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

        {/* روابط المشروع الخارجية — تظهر أيقوناتها بجانب عنوان المشروع */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-600">
            روابط المشروع{' '}
            <span className="text-[11px] font-normal text-slate-400">
              (اختيارية — تظهر أيقوناتها بجانب عنوان المشروع)
            </span>
          </label>
          {/* dir=auto: النص التوضيحي العربي يظهر RTL وهو فارغ، والرابط المكتوب
              يتحول تلقائياً إلى LTR — فلا يُقص النص التوضيحي */}
          <input
            value={shareLink}
            onChange={(e) => setShareLink(e.target.value)}
            dir="auto"
            placeholder="رابط الشير — ‪\\server\share‬ أو رابط سحابي 📁"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-300 focus:border-blue-400"
          />
          <input
            value={outgoingLink}
            onChange={(e) => setOutgoingLink(e.target.value)}
            dir="auto"
            placeholder="ملف الصادر — Google Docs للكتب الصادرة 📄"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-300 focus:border-blue-400"
          />
          <input
            value={accountsLink}
            onChange={(e) => setAccountsLink(e.target.value)}
            dir="auto"
            placeholder="ملف الحسابات — Google Sheets للحسابات والأسعار 📊"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-300 focus:border-blue-400"
          />
          <input
            value={incomingLink}
            onChange={(e) => setIncomingLink(e.target.value)}
            dir="auto"
            placeholder="مجلد الواردة — Google Drive لصور الكتب الواردة 📥"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-300 focus:border-blue-400"
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
