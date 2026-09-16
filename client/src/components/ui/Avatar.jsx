import { initials } from '../../lib/format.js'
export default function Avatar({ name, admin = false }) {
  return <span className={`avatar${admin ? ' avatar-admin' : ''}`} aria-hidden="true">{initials(name)}</span>
}
