import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

/** المستخدم الحالي (null = غير مسجل الدخول). النداء الأول يزرع كعكة CSRF أيضاً. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.auth.me()).user,
    staleTime: Infinity,
    retry: false,
  })
}

export function useAuthMutations() {
  const queryClient = useQueryClient()

  return {
    login: useMutation({
      mutationFn: api.auth.login,
      onSuccess: ({ user }) => {
        // امسح بيانات الجلسة السابقة ثم ثبّت المستخدم الجديد.
        // لا تستخدم clear() هنا: إزالة استعلام ['me'] بينما الواجهة تراقبه
        // تفصلها عن القيمة الجديدة فلا يحدث الانتقال بعد الدخول.
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
        queryClient.setQueryData(['me'], user)
      },
    }),
    logout: useMutation({
      mutationFn: api.auth.logout,
      onSuccess: () => {
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
        queryClient.setQueryData(['me'], null)
      },
    }),
  }
}
