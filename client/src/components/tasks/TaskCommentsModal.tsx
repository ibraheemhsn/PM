import type { Task } from '../../types'
import { Modal } from '../ui/Modal'
import { TaskComments } from './TaskComments'

/** نافذة التعليقات المستقلة — تُفتح للموظف من أيقونة 💬.
 *  تعيد استخدام قسم التعليقات (مع حذف المدير). */
export function TaskCommentsModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <Modal title="التعليقات" onClose={onClose}>
      <p className="mb-3 truncate text-sm text-slate-500">المهمة: {task.title}</p>
      <TaskComments task={task} />
    </Modal>
  )
}
