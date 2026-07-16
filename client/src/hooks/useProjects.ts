import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ProjectInput } from '../lib/api'

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: api.projects.list })
}

/** سلة المحذوفات — endpoint خاص بالمدير، مرِّر enabled=false لغيره. */
export function useTrashedProjects(enabled = true) {
  return useQuery({
    queryKey: ['projects-trash'],
    queryFn: api.projects.trashList,
    enabled,
  })
}

/** الأرشيف — endpoint خاص بالمدير، مرِّر enabled=false لغيره. */
export function useArchivedProjects(enabled = true) {
  return useQuery({
    queryKey: ['projects', 'archive'],
    queryFn: api.projects.archivedList,
    enabled,
  })
}

/** سجل النشاطات عبر كل المشاريع — لصفحة «سجل النشاطات» المستقلة */
export function useAllActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: api.activity.listAll,
    refetchOnMount: 'always', // السجل يتغير مع كل عملية — حدّثه عند كل زيارة
  })
}

export function useProjectMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['projects-trash'] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    // الأرشفة والاستعادة تؤثران على الخلاصة الموحدة وكل المرفقات أيضاً
    queryClient.invalidateQueries({ queryKey: ['updates'] })
    queryClient.invalidateQueries({ queryKey: ['attachments'] })
  }

  return {
    create: useMutation({ mutationFn: api.projects.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: number; data: Partial<ProjectInput> }) =>
        api.projects.update(id, data),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: api.projects.remove, onSuccess: invalidate }),
    restore: useMutation({ mutationFn: api.projects.restore, onSuccess: invalidate }),
    purge: useMutation({ mutationFn: api.projects.purge, onSuccess: invalidate }),
    archive: useMutation({ mutationFn: api.projects.archive, onSuccess: invalidate }),
    unarchive: useMutation({ mutationFn: api.projects.unarchive, onSuccess: invalidate }),
    // سير مراجعة التفاصيل الفنية: اقتراح (موظف) ← اعتماد أو تراجع (مدير)
    proposeDetails: useMutation({
      mutationFn: ({ id, details }: { id: number; details: string }) =>
        api.projects.proposeDetails(id, details),
      onSuccess: invalidate,
    }),
    approveDetails: useMutation({ mutationFn: api.projects.approveDetails, onSuccess: invalidate }),
    rejectDetails: useMutation({ mutationFn: api.projects.rejectDetails, onSuccess: invalidate }),
  }
}

export function useAttachments(projectId: number) {
  return useQuery({
    queryKey: ['attachments', projectId],
    queryFn: () => api.attachments.list(projectId),
  })
}

/** كل المرفقات عبر المشاريع — لصفحة «كل المرفقات» */
export function useAllAttachments() {
  return useQuery({ queryKey: ['attachments', 'all'], queryFn: api.attachments.listAll })
}

/** projectId مطلوب للرفع (create) فقط — التعديل والحذف يعملان بدونه.
 *  الإبطال بالبادئة ['attachments'] يشمل قائمة المشروع وصفحة «كل المرفقات». */
export function useAttachmentMutations(projectId?: number) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['attachments'] })

  return {
    create: useMutation({
      mutationFn: ({
        file, description, category,
      }: { file: File; description: string; category: string }) => {
        if (projectId === undefined) throw new Error('projectId مطلوب لرفع مرفق')
        return api.attachments.create(projectId, file, description, category)
      },
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({
        id, ...data
      }: { id: number; description?: string; category?: string }) =>
        api.attachments.update(id, data),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: api.attachments.remove, onSuccess: invalidate }),
  }
}

export function useProjectUpdates(projectId: number) {
  return useQuery({
    queryKey: ['updates', projectId],
    queryFn: () => api.updates.list(projectId),
  })
}

/** كل التحديثات عبر المشاريع — للخلاصة الموحدة في صفحة المهام */
export function useAllUpdates() {
  return useQuery({ queryKey: ['updates', 'all'], queryFn: api.updates.listAll })
}

/** التحديثات المنقولة إلى المحذوفات — endpoint خاص بالمدير، مرِّر enabled=false لغيره. */
export function useTrashedUpdates(enabled = true) {
  return useQuery({
    queryKey: ['updates', 'trash'],
    queryFn: api.updates.trashList,
    enabled,
  })
}

/** projectId مطلوب للإضافة (create) فقط — بقية العمليات تعمل بدونه. */
export function useProjectUpdateMutations(projectId?: number) {
  const queryClient = useQueryClient()
  // البادئة ['updates'] تشمل قائمة المشروع والخلاصة الموحدة والمحذوفات معاً
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['updates'] })

  return {
    create: useMutation({
      mutationFn: (body: string) => {
        if (projectId === undefined) throw new Error('projectId مطلوب لإضافة تحديث')
        return api.updates.create({ project: projectId, body })
      },
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: number; body: string }) => api.updates.update(id, body),
      onSuccess: invalidate,
    }),
    // حذف ناعم ← المحذوفات، ومنها استعادة أو حذف نهائي
    remove: useMutation({ mutationFn: api.updates.remove, onSuccess: invalidate }),
    restore: useMutation({ mutationFn: api.updates.restore, onSuccess: invalidate }),
    purge: useMutation({ mutationFn: api.updates.purge, onSuccess: invalidate }),
  }
}
