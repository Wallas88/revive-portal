import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import Mark from '../components/ui/Mark.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import { useSession } from '../features/auth/SessionContext.jsx'

export default function PortalLayout() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const admin = user.role === 'admin'
  async function signOut() { await logout(); navigate('/login') }
  return (
    <div className="portal">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <Link className="brand" to="/"><span><Mark /></span><strong>Revive Portal</strong></Link>
        <nav className="topnav" aria-label="Portal">
          <NavLink to="/" end>Dashboard</NavLink>
          {admin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div>
          <Avatar name={user.name} admin={admin} />
          <p><strong>{user.name}</strong><small>{admin ? 'Studio workspace' : 'Client workspace'}</small></p>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main id="main" className="dashboard"><Outlet /></main>
      <footer className="site-footer"><span><Mark /></span><p><strong>Quiet systems. Clear progress.</strong><small>Revive Portal · built by Waldo Trytsman</small></p><a href="mailto:revivewebsitedev@gmail.com">Contact Waldo Trytsman ↗</a></footer>
    </div>
  )
}
