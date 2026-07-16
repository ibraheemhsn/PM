import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './components/auth/LoginPage'
import { EmployeesPage } from './components/employees/EmployeesPage'
import { AppLayout } from './components/layout/AppLayout'
import { NotificationsPage } from './components/notifications/NotificationsPage'
import { AttachmentsPage } from './components/projects/AttachmentsPage'
import { ProjectPage } from './components/projects/ProjectPage'
import { TrashPage } from './components/projects/TrashPage'
import { AllTasksPage } from './components/tasks/AllTasksPage'
import { useMe } from './hooks/useAuth'

export default function App() {
  const { data: me, isLoading } = useMe()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">
        جارٍ التحميل…
      </div>
    )
  }
  if (!me) return <LoginPage />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/tasks" replace />} />
        <Route path="/tasks" element={<AllTasksPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/attachments" element={<AttachmentsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route
          path="/employees"
          element={me.is_manager ? <EmployeesPage /> : <Navigate to="/tasks" replace />}
        />
        <Route
          path="/trash"
          element={me.is_manager ? <TrashPage /> : <Navigate to="/tasks" replace />}
        />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Route>
    </Routes>
  )
}
