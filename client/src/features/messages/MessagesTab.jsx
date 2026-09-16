import { useCallback, useEffect, useState } from 'react'
import Avatar from '../../components/ui/Avatar.jsx'
import Panel from '../../components/ui/Panel.jsx'
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { formatDateTime } from '../../lib/format.js'
import { useProject } from '../projects/ProjectContext.jsx'

export default function MessagesTab() {
  const { projectId, reload } = useProject()
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const base = `/projects/${projectId}/messages`
  const load = useCallback(async () => { setError(null); try { setMessages((await api.get(base)).messages) } catch (e) { setError(e) } }, [base])
  useEffect(() => { load() }, [load])

  async function send(event) {
    event.preventDefault(); if (!draft.trim()) return
    setSending(true); setSendError('')
    try { await api.post(base, { body: draft }); setDraft(''); await load(); reload() }
    catch (requestError) { setSendError(requestError.fields?.body || requestError.message) }
    finally { setSending(false) }
  }

  return (
    <Panel className="conversation" eyebrow="The project channel" title="Messages" aside={messages ? `${messages.length} update${messages.length === 1 ? '' : 's'}` : ''}>
      {error ? <ErrorState error={error} onRetry={load} /> : !messages ? <LoadingBlock /> : messages.length ? (
        <div className="messages">{messages.map((entry) => <article key={entry.id}><Avatar name={entry.author} admin={entry.authorRole === 'admin'} /><div><header><strong>{entry.author}{entry.mine ? ' (you)' : ''}</strong><time>{formatDateTime(entry.createdAt)}</time></header><p>{entry.body}</p></div></article>)}</div>
      ) : <EmptyState title="No messages yet" text="Start the conversation below — one clear message beats five scattered emails." />}
      <form onSubmit={send}>
        <label htmlFor="message">Add a project note</label>
        <textarea id="message" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="One clear message beats five scattered emails…" />
        <footer><small>{draft.length} / 2000</small><button className="button primary" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send update'} <span>↑</span></button></footer>
        <Notice tone="error">{sendError}</Notice>
      </form>
    </Panel>
  )
}
