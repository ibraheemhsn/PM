import type { Task } from '../../types'
import { Modal } from '../ui/Modal'
import { enterClass, useModalPullNav } from './modalPullNav'
import { TaskComments } from './TaskComments'

/** نافذة التعليقات المستقلة — تُفتح للموظف من أيقونة 💬.
 *  تعيد استخدام قسم التعليقات (مع حذف المدير) + تنقل بالسحب بين العناصر. */
export function TaskCommentsModal({
  task, onClose, onPrev, onNext, enterDir,
}: {
  task: Task
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  enterDir?: 'prev' | 'next'
}) {
  const { bodyRef, hints } = useModalPullNav({ onPrev, onNext })
  return (
    <Modal title="التعليقات" onClose={onClose} bodyRef={bodyRef}>
      {hints}
      <div className={enterClass(enterDir)}>
        <p className="mb-3 truncate text-sm text-slate-500">المهمة: {task.title}</p>
        <TaskComments task={task} />
      </div>
    </Modal>
  )
}
