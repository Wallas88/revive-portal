import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireAdmin } from '../../middleware/requireAdmin.js'
import { id, validateRequest } from '../../middleware/validateRequest.js'
import { badRequest, notFound } from '../../lib/httpError.js'
import { projectQueries } from '../projects/queries.js'

const params = z.object({ projectId: id })

// Allow-list by extension, confirmed by the first bytes where the format
// has a signature. Anything else is refused before it reaches disk.
const TYPES = {
  pdf: { mime: 'application/pdf', magic: ['25504446'] },
  png: { mime: 'image/png', magic: ['89504e47'] },
  jpg: { mime: 'image/jpeg', magic: ['ffd8ff'] },
  jpeg: { mime: 'image/jpeg', magic: ['ffd8ff'] },
  webp: { mime: 'image/webp', magic: ['52494646'] },
  gif: { mime: 'image/gif', magic: ['47494638'] },
  zip: { mime: 'application/zip', magic: ['504b0304', '504b0506'] },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: ['504b0304'] },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: ['504b0304'] },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', magic: ['504b0304'] },
  txt: { mime: 'text/plain' },
  md: { mime: 'text/markdown' },
  csv: { mime: 'text/csv' },
}

function classify(originalName, buffer) {
  const ext = originalName.toLowerCase().split('.').pop()
  const type = TYPES[ext]
  if (!type || ext === originalName.toLowerCase()) return null
  if (type.magic) {
    const head = buffer.subarray(0, 4).toString('hex')
    if (!type.magic.some((m) => head.startsWith(m))) return null
  }
  return type.mime
}

const safeName = (name) => name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'file'

export function fileQueries(db) {
  return {
    list: (projectId) => db.prepare(`
      SELECT files.id, original_name AS name, mime_type AS mimeType, size_bytes AS size, files.created_at AS createdAt, users.name AS uploadedBy, users.role AS uploaderRole
      FROM files JOIN users ON users.id = files.uploaded_by WHERE project_id = ? AND deleted_at IS NULL ORDER BY files.created_at DESC, files.id DESC
    `).all(projectId),
    get: (projectId, id) => db.prepare('SELECT id, original_name AS name, stored_key AS key, mime_type AS mimeType, size_bytes AS size FROM files WHERE project_id = ? AND id = ? AND deleted_at IS NULL').get(projectId, id),
    insert: ({ projectId, uploadedBy, name, key, mimeType, size, sha256 }) => db.prepare(
      'INSERT INTO files (project_id, uploaded_by, original_name, stored_key, mime_type, size_bytes, sha256) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id'
    ).get(projectId, uploadedBy, name, key, mimeType, size, sha256),
    softDelete: (id) => db.prepare('UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id),
  }
}

// Mounted at /api/projects/:projectId/files. Members upload and download;
// only admins delete. Downloads are authorized through the project.
export function fileRoutes({ db, audit, access, storage, env }) {
  const q = fileQueries(db)
  const projects = projectQueries(db)
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } })
  const router = Router({ mergeParams: true })
  router.use(authenticate, validateRequest({ params }), access.require())

  router.get('/', (req, res) => res.json({ files: q.list(req.project.id) }))

  router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) throw badRequest('Check the highlighted fields.', { file: 'Choose a file to upload.' })
    const mimeType = classify(req.file.originalname, req.file.buffer)
    if (!mimeType) throw badRequest('Check the highlighted fields.', { file: `That file type is not accepted. Use ${Object.keys(TYPES).join(', ')}.` })
    const key = storage.newKey(req.project.id)
    const { sha256, size } = await storage.save(key, req.file.buffer)
    const name = safeName(req.file.originalname)
    const { id: fileId } = q.insert({ projectId: req.project.id, uploadedBy: req.user.id, name, key, mimeType, size, sha256 })
    projects.touch(req.project.id)
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'file.uploaded', entityType: 'file', entityId: fileId, meta: { name, size } })
    res.status(201).json({ file: q.list(req.project.id).find((f) => f.id === fileId) })
  })

  router.get('/:fileId/download', validateRequest({ params: params.extend({ fileId: id }) }), (req, res) => {
    const file = q.get(req.project.id, req.params.fileId)
    if (!file || !storage.exists(file.key)) throw notFound('File not found.')
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Content-Length', file.size)
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(file.name).replace(/"/g, '')}"`)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, no-store')
    storage.stream(file.key).pipe(res)
  })

  router.delete('/:fileId', requireAdmin, validateRequest({ params: params.extend({ fileId: id }) }), async (req, res) => {
    const file = q.get(req.project.id, req.params.fileId)
    if (!file) throw notFound('File not found.')
    q.softDelete(file.id)
    await storage.remove(file.key)
    audit.record({ actorId: req.user.id, projectId: req.project.id, action: 'file.deleted', entityType: 'file', entityId: file.id, meta: { name: file.name } })
    res.status(204).end()
  })

  return router
}
