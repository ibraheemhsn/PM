import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api, type TaskInput } from '../lib/api'
import { haptics } from '../lib/haptics'
import type { Task } from '../types'

export function useTasks() {
  return useQuery({ queryKey: ['tasks'], queryFn: api.tasks.list })
}

/** المهام المنقولة إلى المحذوفات — endpoint خاص بالمدير، مرِّر enabled=false لغيره. */
export function useTrashedTasks(enabled = true) {
  return useQuery({
    queryKey: ['tasks', 'trash'],
    queryFn: api.tasks.trashList,
    enabled,
  })
}

/** يعلّم المهام غير المقروءة المعروضة أمام المستخدم كمقروءة على الخادم.
 *  لا نبطل ['tasks'] كي يبقى التمييز الأصفر ظاهراً طوال الزيارة الحالية —
 *  يختفي مع أول جلب تالٍ. نبطل ['projects'] فقط لتحديث النقطة الحمراء. */
export function useMarkTasksSeen(tasks: Task[]) {
  const queryClient = useQueryClient()
  const marked = useRef<Set<number>>(new Set())

  useEffect(() => {
    const ids = tasks.filter((t) => t.is_unread && !marked.current.has(t.id)).map((t) => t.id)
    if (ids.length === 0) return
    for (const id of ids) marked.current.add(id)
    api.tasks
      .markSeen(ids)
      .then(() => queryClient.invalidateQueries({ queryKey: ['projects'] }))
      .catch(() => {}) // فشل صامت — ستبقى غير مقروءة للزيارة التالية
  }, [tasks, queryClient])
}

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: api.tags.list })
}

export function useTaskMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['tags'] })
    // عدّاد المهام في الشريط الجانبي يتبع المشاريع
    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  return {
    create: useMutation({ mutationFn: api.tasks.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: number; data: Partial<TaskInput> }) =>
        api.tasks.update(id, data),
      // إنجاز المهمة يستحق تأثير «نجاح» أوضح — يحلّ محل الاهتزاز الخفيف العام
      // (يعمل بعده لأن مستمع المثيل يُنفَّذ بعد مستمع الكاش المركزي)
      onSuccess: (_data, variables) => {
        if (variables.data.status === 'DONE') haptics.success()
        invalidate()
      },
    }),
    // حذف ناعم ← المحذوفات، ومنها استعادة أو حذف نهائي (إجراء حساس: تحذير)
    remove: useMutation({
      mutationFn: api.tasks.remove, onMutate: haptics.warning, onSuccess: invalidate,
    }),
    restore: useMutation({ mutationFn: api.tasks.restore, onSuccess: invalidate }),
    purge: useMutation({
      mutationFn: api.tasks.purge, onMutate: haptics.warning, onSuccess: invalidate,
    }),
  }
}

export function useTaskComments(taskId: number) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => api.tasks.comments(taskId),
    // كل فتح للتعليقات يمر على الخادم ليُحدَّث مؤشر «آخر اطلاع»
    refetchOnMount: 'always',
  })
}

export function useCommentMutations(taskId: number) {
  const queryClient = useQueryClient()

  return {
    create: useMutation({
      mutationFn: (body: string) => api.tasks.addComment(taskId, body),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['comments', taskId] })
        // عدّاد التعليقات معروض على بطاقة المهمة
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      },
    }),
  }
}
