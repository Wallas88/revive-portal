import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { bootApp, seedAdmin, seedClientUser, seedProject } from './helpers.js'

let app, admin, mara, bob, project, a, c, cb
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(64, 1)])
const form = (name, buffer, type = 'application/octet-stream') => { const f = new FormData(); f.set('file', new Blob([buffer], { type }), name); return f }

before(async () => {
  app = await bootApp(); admin = seedAdmin(app.db)
  mara = seedClientUser(app.db, { clientName: 'Northstar', email: 'mara@test.local' })
  bob = seedClientUser(app.db, { clientName: 'Beta', email: 'bob@test.local' })
  project = seedProject(app.db, { clientId: mara.clientId, memberIds: [mara.userId] })
  a = app.client(); await a.login(admin.email, admin.password)
  c = app.client(); await c.login(mara.email, mara.password)
  cb = app.client(); await cb.login(bob.email, bob.password)
})
after(() => app.close())

test('a member uploads an allowed file and downloads it as an attachment', async () => {
  const up = await c.upload(`/projects/${project}/files`, form('mockup.png', png, 'image/png'))
  assert.equal(up.status, 201); assert.equal(up.data.file.name, 'mockup.png'); assert.equal(up.data.file.mimeType, 'image/png')
  const down = await c.get(`/projects/${project}/files/${up.data.file.id}/download`)
  assert.equal(down.status, 200); assert.match(down.headers.get('content-disposition'), /attachment; filename="mockup.png"/)
  assert.equal(Buffer.from(down.data).length, png.length)
})

test('disallowed and disguised files are refused', async () => {
  assert.equal((await c.upload(`/projects/${project}/files`, form('run.exe', Buffer.alloc(32, 7)))).status, 400)
  assert.equal((await c.upload(`/projects/${project}/files`, form('fake.png', Buffer.from('not really a png'), 'image/png'))).status, 400)
  assert.equal((await c.upload(`/projects/${project}/files`, new FormData())).status, 400)
})

test('another client cannot list or download the file; a client cannot delete; admin can', async () => {
  const id = (await c.get(`/projects/${project}/files`)).data.files[0].id
  assert.equal((await cb.get(`/projects/${project}/files`)).status, 404)
  assert.equal((await cb.get(`/projects/${project}/files/${id}/download`)).status, 404)
  assert.equal((await app.client().get(`/projects/${project}/files/${id}/download`)).status, 401)
  assert.equal((await c.del(`/projects/${project}/files/${id}`)).status, 403)
  assert.equal((await a.del(`/projects/${project}/files/${id}`)).status, 204)
  assert.equal((await c.get(`/projects/${project}/files/${id}/download`)).status, 404)
})

test('a deliverable version can attach a project file but not a foreign one', async () => {
  const up = await a.upload(`/projects/${project}/files`, form('v1.png', png, 'image/png'))
  const d = (await a.post(`/projects/${project}/deliverables`, { title: 'Brand sheet' })).data.deliverable
  const ok = await a.post(`/projects/${project}/deliverables/${d.id}/versions`, { fileId: up.data.file.id })
  assert.equal(ok.status, 201); assert.equal(ok.data.version.fileName, 'v1.png')
  const other = seedProject(app.db, { clientId: bob.clientId, memberIds: [bob.userId] })
  const foreign = await a.upload(`/projects/${other}/files`, form('theirs.png', png, 'image/png'))
  assert.equal((await a.post(`/projects/${project}/deliverables/${d.id}/versions`, { fileId: foreign.data.file.id })).status, 400)
})
