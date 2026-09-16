import { RouterProvider } from 'react-router'
import { SessionProvider } from '../features/auth/SessionContext.jsx'
import { router } from './router.jsx'

export default function App() {
  return <SessionProvider><RouterProvider router={router} /></SessionProvider>
}
