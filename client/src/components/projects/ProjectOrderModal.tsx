import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical } from 'lucide-react'
import { useState } from 'react'
import { useMe } from '../../hooks/useAuth'
import { useProjects } from '../../hooks/useProjects'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'
import { orderProjects, type Project } from '../../types'
import { Modal } from '../ui/Modal'

/** نافذة «ترتيب المشاريع»: سحب وإفلات (dnd-kit) لترتيب مخصص يخص
 *  المستخدم الحالي وحده — يُحفظ في حسابه وينعكس على شريطه الجانبي فقط. */
export function ProjectOrderModal({ onClose }: { onClose: () => void }) {
  const { data: me } = useMe()
  const { data: projects = [] } = useProjects()
  const queryClient = useQueryClient()

  // الترتيب المعروض يبدأ من ترتيب المستخدم الحالي (المحفوظ + الجدد في ذيله)
  const [items, setItems] = useState<Project[]>(() =>
    orderProjects(projects, me?.project_order ?? []),
  )

  const save = useMutation({
    mutationFn: () => api.auth.saveProjectOrder(items.map((p) => p.id)),
    onSuccess: () => {
      // الترتيب يصل الواجهة عبر /auth/me/ — تحديثه يعيد ترتيب الشريط الجانبي فوراً
      queryClient.invalidateQueries({ queryKey: ['me'] })
      onClose()
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setItems((current) => {
      const from = current.findIndex((p) => p.id === active.id)
      const to = current.findIndex((p) => p.id === over.id)
      return arrayMove(current, from, to)
    })
  }

  return (
    <Modal title="ترتيب المشاريع" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-400">
        اسحب المشاريع لترتيبها كما يناسبك — هذا الترتيب يخص حسابك فقط ولا يؤثر على بقية
        المستخدمين.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {items.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                لا توجد مشاريع بعد
              </li>
            )}
            {items.map((project, index) => (
              <SortableProjectRow key={project.id} project={project} index={index} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={save.isPending}
          className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          إلغاء
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || items.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {save.isPending ? 'جارٍ الحفظ…' : 'حفظ الترتيب'}
        </button>
      </div>
    </Modal>
  )
}

function SortableProjectRow({ project, index }: { project: Project; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5',
        isDragging && 'z-10 opacity-80 shadow-lg ring-2 ring-blue-300',
      )}
    >
      {/* مقبض السحب — يدعم لوحة المفاتيح أيضاً (مسافة ثم أسهم) */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
        aria-label={`سحب لترتيب «${project.title}»`}
      >
        <GripVertical size={16} />
      </button>
      <span className="w-5 text-center text-xs font-bold text-slate-300">{index + 1}</span>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
        {project.title}
      </span>
      <span className="text-xs text-slate-400">{project.tasks_count} مهمة</span>
    </li>
  )
}
