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

export function useProjectMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['projects-trash'] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
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

export function useAttachmentMutations(projectId: number) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['attachments', projectId] })

  return {
    create: useMutation({
      mutationFn: ({ file, description }: { file: File; description: string }) =>
        api.attachments.create(projectId, file, description),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, description }: { id: number; description: string }) =>
        api.attachments.update(id, description),
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

export function useProjectUpdateMutations(projectId: number) {
  const queryClient = useQueryClient()
  // البادئة ['updates'] تشمل قائمة المشروع والخلاصة الموحدة معاً
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['updates'] })

  return {
    create: useMutation({
      mutationFn: (body: string) => api.updates.create({ project: projectId, body }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: number; body: string }) => api.updates.update(id, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: api.updates.remove, onSuccess: invalidate }),
  }
}
