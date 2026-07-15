import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type TaskInput } from '../lib/api'

export function useTasks() {
  return useQuery({ queryKey: ['tasks'], queryFn: api.tasks.list })
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
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: api.tasks.remove, onSuccess: invalidate }),
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
