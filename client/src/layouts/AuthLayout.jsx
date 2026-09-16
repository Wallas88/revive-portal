import { Outlet } from 'react-router'
import Mark from '../components/ui/Mark.jsx'

// The two-column gate: story on the left, form on the right — the original
// login screen, now shared by sign-in, invitation and password pages.
export default function AuthLayout() {
  return (
    <main className="login-shell">
      <section className="login-story">
        <a className="brand" href="/" aria-label="Revive Portal home"><span><Mark /></span><strong>Revive Portal</strong></a>
        <div><p className="eyebrow">Project clarity, without the theatre</p><h1>Your project.<br /><em>One calm place.</em></h1><p>Milestones, decisions, messages, and momentum—visible when you need them.</p></div>
        <small>Built by Waldo Trytsman · Pretoria → Worldwide</small>
      </section>
      <section className="login-panel"><Outlet /></section>
    </main>
  )
}
