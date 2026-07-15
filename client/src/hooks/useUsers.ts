import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type UserInput } from '../lib/api'

/** قائمة الموظفين — endpoint خاص بالمدير، مرِّر enabled=false لغيره. */
export function useUsers(enabled = true) {
  return useQuery({ queryKey: ['users'], queryFn: api.users.list, enabled })
}

export function useUserMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    // أسماء وصور المسندين معروضة داخل المهام
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  return {
    create: useMutation({ mutationFn: api.users.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: number; data: Partial<UserInput> | FormData }) =>
        api.users.update(id, data),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: api.users.remove, onSuccess: invalidate }),
  }
}
