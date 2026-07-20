import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './components/auth/LoginPage'
import { EmployeesPage } from './components/employees/EmployeesPage'
import { AppLayout } from './components/layout/AppLayout'
import { ActivityPage } from './components/activity/ActivityPage'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { MyDayPage } from './components/dashboard/MyDayPage'
import { NotificationsPage } from './components/notifications/NotificationsPage'
import { ArchivePage } from './components/projects/ArchivePage'
import { AttachmentsPage } from './components/projects/AttachmentsPage'
import { ProjectPage } from './components/projects/ProjectPage'
import { ProjectsPage } from './components/projects/ProjectsPage'
import { EmailSettingsPage } from './components/settings/EmailSettingsPage'
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
        {/* الصفحة الرئيسية: لوحة الإحصائيات للمدير، و«يومي» الشخصية للموظف */}
        <Route
          index
          element={<Navigate to={me.is_manager ? '/dashboard' : '/my-day'} replace />}
        />
        <Route
          path="/dashboard"
          element={me.is_manager ? <DashboardPage /> : <Navigate to="/my-day" replace />}
        />
        {/* «يومي»: نظرة شخصية للجميع — مهامي المستحقة والمتأخرة وما ينتظر ردّي */}
        <Route path="/my-day" element={<MyDayPage />} />
        <Route path="/tasks" element={<AllTasksPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/attachments" element={<AttachmentsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/email-settings" element={<EmailSettingsPage />} />
        <Route
          path="/employees"
          element={me.is_manager ? <EmployeesPage /> : <Navigate to="/tasks" replace />}
        />
        <Route
          path="/archive"
          element={me.is_manager ? <ArchivePage /> : <Navigate to="/tasks" replace />}
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
