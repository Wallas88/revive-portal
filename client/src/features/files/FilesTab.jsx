import { useCallback, useEffect, useRef, useState } from 'react'
import Panel from '../../components/ui/Panel.jsx'
import { EmptyState, ErrorState, LoadingBlock, Notice } from '../../components/ui/States.jsx'
import { api } from '../../lib/api.js'
import { fileSize, formatDate } from '../../lib/format.js'
import { useSession } from '../auth/SessionContext.jsx'
import { useProject } from '../projects/ProjectContext.jsx'

export default function FilesTab() {
  const { user } = useSession()
  const { projectId, reload } = useProject()
  const [files, setFiles] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState({})
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const base = `/projects/${projectId}/files`
  const load = useCallback(async () => { setError(null); try { setFiles((await api.get(base)).files) } catch (e) { setError(e) } }, [base])
  useEffect(() => { load() }, [load])

  async function upload(event) {
    event.preventDefault()
    const file = input.current?.files?.[0]
    if (!file) return setNotice({ tone: 'error', text: 'Choose a file first.' })
    setBusy(true); setNotice({})
    const form = new FormData(); form.set('file', file)
    try { await api.upload(base, form); input.current.value = ''; setNotice({ tone: 'success', text: `${file.name} is shared with the project.` }); await load(); reload() }
    catch (requestError) { setNotice({ tone: 'error', text: requestError.fields?.file || requestError.message }) }
    finally { setBusy(false) }
  }
  async function remove(file) {
    if (!window.confirm(`Remove ${file.name}?`)) return
    try { await api.del(`${base}/${file.id}`); await load(); reload() } catch (requestError) { setNotice({ tone: 'error', text: requestError.message }) }
  }

  return (
    <Panel eyebrow="Shared files" title="Files" aside={files ? `${files.length} file${files.length === 1 ? '' : 's'}` : ''}>
      {error ? <ErrorState error={error} onRetry={load} /> : !files ? <LoadingBlock /> : files.length ? (
        <ul className="list">{files.map((file) => (
          <li key={file.id}>
            <div><strong>{file.name}</strong><small>{fileSize(file.size)} · {file.uploadedBy} · {formatDate(file.createdAt)}</small></div>
            <div className="actions">
              <a className="button small" href={`/api${base}/${file.id}/download`}>Download <span>↓</span></a>
              {user.role === 'admin' && <button type="button" className="button danger small" onClick={() => remove(file)}>Remove</button>}
            </div>
          </li>
        ))}</ul>
      ) : <EmptyState title="Nothing shared yet" text="Designs, documents and exports will be listed here." />}
      <form className="panel-form" onSubmit={upload}>
        <h3>Share a file</h3>
        <div className="field"><label htmlFor="file">PDF, images, office documents or zip · up to 15 MB</label><input id="file" ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.zip,.docx,.xlsx,.pptx,.txt,.md,.csv" /></div>
        <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload'} <span>↑</span></button></div>
        <Notice tone={notice.tone}>{notice.text}</Notice>
      </form>
    </Panel>
  )
}
