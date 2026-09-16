import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router'
import { useSession } from '../features/auth/SessionContext.jsx'
import { LoadingScreen, ErrorState } from '../components/ui/States.jsx'
import AuthLayout from '../layouts/AuthLayout.jsx'
import PortalLayout from '../layouts/PortalLayout.jsx'
import LoginPage from '../features/auth/LoginPage.jsx'
import InvitePage from '../features/auth/InvitePage.jsx'
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from '../features/auth/ResetPasswordPage.jsx'
import SetupPage from '../features/auth/SetupPage.jsx'
import DashboardPage from '../features/dashboard/DashboardPage.jsx'
import ProjectPage from '../features/projects/ProjectPage.jsx'
import OverviewTab from '../features/projects/OverviewTab.jsx'
import MilestonesTab from '../features/milestones/MilestonesTab.jsx'
import ApprovalsTab from '../features/approvals/ApprovalsTab.jsx'
import MessagesTab from '../features/messages/MessagesTab.jsx'
import FilesTab from '../features/files/FilesTab.jsx'
import AdminPage from '../features/admin/AdminPage.jsx'
import ClientPage from '../features/admin/ClientPage.jsx'

function Gate({ admin = false }) {
  const { user, status, refresh } = useSession()
  const location = useLocation()
  if (status === 'checking') return <LoadingScreen text="Restoring your workspace…" />
  if (status === 'offline') return <main className="loading"><ErrorState error={{ message: 'The portal could not be reached.' }} onRetry={refresh} /></main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

function PublicOnly() {
  const { user, status } = useSession()
  if (status === 'checking') return <LoadingScreen text="One moment…" />
  return user ? <Navigate to="/" replace /> : <Outlet />
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { element: <PublicOnly />, children: [
        { path: '/login', element: <LoginPage /> },
        { path: '/forgot-password', element: <ForgotPasswordPage /> },
      ] },
      { path: '/invite/:token', element: <InvitePage /> },
      { path: '/reset/:token', element: <ResetPasswordPage /> },
      { element: <PublicOnly />, children: [{ path: '/setup', element: <SetupPage /> }] },
    ],
  },
  {
    element: <Gate />,
    children: [{
      element: <PortalLayout />,
      children: [
        { path: '/', element: <DashboardPage /> },
        {
          path: '/projects/:projectId', element: <ProjectPage />,
          children: [
            { index: true, element: <OverviewTab /> },
            { path: 'milestones', element: <MilestonesTab /> },
            { path: 'approvals', element: <ApprovalsTab /> },
            { path: 'messages', element: <MessagesTab /> },
            { path: 'files', element: <FilesTab /> },
          ],
        },
        { element: <Gate admin />, children: [
          { path: '/admin', element: <AdminPage /> },
          { path: '/admin/clients/:clientId', element: <ClientPage /> },
        ] },
      ],
    }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
