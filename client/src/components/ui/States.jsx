import Mark from './Mark.jsx'

// Every screen has four states; these keep them consistent.
export function LoadingScreen({ text = 'Gathering the project…' }) {
  return <main className="loading" aria-busy="true"><Mark /><p>{text}</p></main>
}

export function LoadingBlock({ text = 'Loading…' }) {
  return <div className="state state-loading" aria-busy="true"><Mark /><p>{text}</p></div>
}

export function EmptyState({ title, text, children }) {
  return <div className="state state-empty"><span className="state-glyph" aria-hidden="true">·</span><strong>{title}</strong>{text && <p>{text}</p>}{children}</div>
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <strong>Something did not load.</strong>
      <p>{error?.message || 'Please try again.'}</p>
      {onRetry && <button type="button" className="button" onClick={onRetry}>Try again <span>↻</span></button>}
    </div>
  )
}

// Inline feedback under a form or action: tone = error | success | info.
export function Notice({ tone = 'info', children }) {
  if (!children) return null
  return <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</p>
}
