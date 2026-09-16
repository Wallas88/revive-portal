export default function Panel({ eyebrow, title, aside, className = '', children }) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(eyebrow || title) && <header><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h2>{title}</h2>}</div>{aside && <span>{aside}</span>}</header>}
      {children}
    </section>
  )
}
