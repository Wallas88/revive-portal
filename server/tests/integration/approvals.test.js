import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { bootApp, seedAdmin, seedClientUser, seedProject } from './helpers.js'

let app, admin, mara, project, a, c
before(async () => {
  app = await bootApp(); admin = seedAdmin(app.db)
  mara = seedClientUser(app.db, { clientName: 'Northstar', email: 'mara@test.local' })
  project = seedProject(app.db, { clientId: mara.clientId, memberIds: [mara.userId] })
  a = app.client(); await a.login(admin.email, admin.password)
  c = app.client(); await c.login(mara.email, mara.password)
})
after(() => app.close())

const base = () => `/projects/${project}`
const deliverables = async (who) => (await who.get(`${base()}/deliverables`)).data.deliverables

test('approval history stays attached to the exact version; a new revision starts clean', async () => {
  const d = (await a.post(`${base()}/deliverables`, { title: 'Homepage design' })).data.deliverable
  const v1 = (await a.post(`${base()}/deliverables/${d.id}/versions`, { previewUrl: 'https://example.com/v1', note: 'first' })).data.version
  assert.equal(v1.versionNumber, 1)
  const r1 = (await a.post(`${base()}/versions/${v1.id}/approval-requests`, { message: 'Please review v1' })).data.request
  assert.equal(r1.status, 'pending')
  assert.equal((await a.post(`${base()}/versions/${v1.id}/approval-requests`, {})).status, 409) // one pending per version

  // the client sees it as their next action and approves
  const page = (await c.get(base())).data
  assert.equal(page.pendingApprovals.length, 1); assert.equal(page.pendingApprovals[0].versionNumber, 1)
  const decided = await c.post(`${base()}/approval-requests/${r1.id}/responses`, { decision: 'approved', feedback: 'Looks great.' })
  assert.equal(decided.status, 201); assert.equal(decided.data.request.status, 'approved'); assert.equal(decided.data.responses[0].respondedBy, 'Client User')
  assert.equal((await c.post(`${base()}/approval-requests/${r1.id}/responses`, { decision: 'changes_requested', feedback: 'wait' })).status, 409)

  // a new version inherits nothing
  const v2 = (await a.post(`${base()}/deliverables/${d.id}/versions`, { previewUrl: 'https://example.com/v2', note: 'revision' })).data.version
  assert.equal(v2.versionNumber, 2)
  let [item] = await deliverables(c)
  const byNumber = Object.fromEntries(item.versions.map((v) => [v.versionNumber, v]))
  assert.equal(byNumber[2].requests.length, 0)
  assert.equal(byNumber[1].requests[0].status, 'approved')
  assert.equal((await c.get(base())).data.pendingApprovals.length, 0)

  // request on v2, client asks for changes — feedback required, recorded on v2 only
  const r2 = (await a.post(`${base()}/versions/${v2.id}/approval-requests`, { message: 'And v2?' })).data.request
  assert.equal((await c.post(`${base()}/approval-requests/${r2.id}/responses`, { decision: 'changes_requested' })).status, 400)
  const changes = await c.post(`${base()}/approval-requests/${r2.id}/responses`, { decision: 'changes_requested', feedback: 'Logo too small on mobile.' })
  assert.equal(changes.status, 201); assert.equal(changes.data.request.status, 'changes_requested')
  ;[item] = await deliverables(c)
  const after2 = Object.fromEntries(item.versions.map((v) => [v.versionNumber, v]))
  assert.equal(after2[1].requests[0].status, 'approved'); assert.equal(after2[1].requests[0].responses[0].feedback, 'Looks great.')
  assert.equal(after2[2].requests[0].status, 'changes_requested'); assert.equal(after2[2].requests[0].responses[0].feedback, 'Logo too small on mobile.')

  // audit trail names who decided, without feedback bodies
  const actions = (await a.get(base())).data.activity.map((e) => e.action)
  assert.ok(actions.includes('approval.approved') && actions.includes('approval.changes_requested'))
  assert.ok(!JSON.stringify((await a.get(base())).data.activity).includes('Logo too small'))
})

test('the admin cannot decide on the client\'s behalf, but can withdraw', async () => {
  const d = (await a.post(`${base()}/deliverables`, { title: 'Contact page' })).data.deliverable
  const v = (await a.post(`${base()}/deliverables/${d.id}/versions`, { previewUrl: 'https://example.com/c1' })).data.version
  const r = (await a.post(`${base()}/versions/${v.id}/approval-requests`, {})).data.request
  assert.equal((await a.post(`${base()}/approval-requests/${r.id}/responses`, { decision: 'approved' })).status, 403)
  assert.equal((await a.post(`${base()}/approval-requests/${r.id}/withdraw`)).data.request.status, 'withdrawn')
  assert.equal((await c.post(`${base()}/approval-requests/${r.id}/responses`, { decision: 'approved' })).status, 409)
})

test('the admin decisions queue lists only pending requests across projects', async () => {
  const before = (await a.get('/admin/decisions')).data.decisions.length
  const d = (await a.post(`${base()}/deliverables`, { title: 'Footer' })).data.deliverable
  const v = (await a.post(`${base()}/deliverables/${d.id}/versions`, { previewUrl: 'https://example.com/f1' })).data.version
  await a.post(`${base()}/versions/${v.id}/approval-requests`, {})
  const queue = (await a.get('/admin/decisions')).data.decisions
  assert.equal(queue.length, before + 1); assert.equal(queue.at(-1).deliverableTitle, 'Footer'); assert.equal(queue.at(-1).clientName, 'Northstar')
})
