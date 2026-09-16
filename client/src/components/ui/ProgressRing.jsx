export default function ProgressRing({ value }) {
  return <div className="progress-ring" style={{ '--progress': `${value * 3.6}deg` }} role="img" aria-label={`${value}% complete`}><div><strong>{value}%</strong><span>complete</span></div></div>
}
