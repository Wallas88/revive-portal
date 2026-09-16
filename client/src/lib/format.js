const dateFormat = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC without a zone marker.
const parse = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? new Date(value.replace(' ', 'T') + 'Z') : new Date(value))
export const formatDate = (value) => (value ? dateFormat.format(parse(value)) : '—')
export const formatDateTime = (value) => (value ? timeFormat.format(parse(value)) : '—')
export const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
export const firstName = (name = '') => name.split(' ')[0]
export const fileSize = (bytes) => (bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`)
export const statusLabel = (value = '') => value.replace(/_/g, ' ')
