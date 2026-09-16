import { NavLink } from 'react-router'

// Route-driven tabs: each tab is a link, so back/forward and deep links work
// and the keyboard gets them for free.
export default function Tabs({ items, ariaLabel }) {
  return (
    <nav className="tabs" aria-label={ariaLabel}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}>
          {item.label}{item.count > 0 && <span className="tab-count">{item.count}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
