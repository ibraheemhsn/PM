import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useMe } from '../../hooks/useAuth'
import { useUserMutations, useUsers } from '../../hooks/useUsers'
import { displayName, type User } from '../../types'
import { Avatar } from '../ui/Avatar'
import { EmployeeFormModal } from './EmployeeFormModal'

export function EmployeesPage() {
  const { data: me } = useMe()
  const { data: users = [], isLoading, isError } = useUsers()
  const { remove } = useUserMutations()

  // null = مغلق، 'new' = إنشاء، وإلا فهو الموظف الجاري تعديله
  const [editing, setEditing] = useState<User | 'new' | null>(null)

  const handleDelete = (user: User) => {
    if (!confirm(`حذف الموظف «${displayName(user)}»؟ ستُزال إسناداته من المهام.`)) return
    remove.mutate(user.id)
  }

  if (isLoading) return <p className="p-10 text-center text-slate-400">جارٍ التحميل…</p>
  if (isError)
    return (
      <p className="p-10 text-center text-red-600">
        تعذر الاتصال بالخادم — تأكد من تشغيل خادم Django على المنفذ 8000
      </p>
    )

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">
          الموظفون <span className="text-sm font-normal text-slate-400">({users.length})</span>
        </h1>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={15} />
          موظف جديد
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <Avatar user={user} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">
                {displayName(user)}
                {user.is_manager && (
                  <span className="ms-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">
                    مدير
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-slate-400" dir="ltr">
                @{user.username}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => setEditing(user)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                title="تعديل"
              >
                <Pencil size={15} />
              </button>
              {user.id !== me?.id && (
                <button
                  onClick={() => handleDelete(user)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EmployeeFormModal
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
