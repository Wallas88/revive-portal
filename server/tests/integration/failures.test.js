// What the API does when a step fails partway: no half-written records, no
// orphan files, and no crash. Each test boots its own app because it breaks
// something on purpose.
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import { createStorage } from '../../src/services/storage.js'
import { bootApp, seedAdmin, seedClientUser, seedProject } from './helpers.js'

// Long enough for a real download here; short enough that a stuck request
// fails the test instead of hanging the whole run.
const DOWNLOAD_TEST_TIMEOUT_MS = 5000
const PNG_BYTES = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(64, 1)])

function pngUpload(fileName) {
  const form = new FormData()
  form.set('file', new Blob([PNG_BYTES], { type: 'image/png' }), fileName)
  return form
}

// Makes the next INSERT into a table fail, the way a full disk or a broken
// constraint would.
function failInsertsInto(db, table) {
  db.exec(`CREATE TRIGGER fail_${table} BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'forced failure'); END`)
}

// Real storage, except every read fails as soon as it starts.
function storageWithFailingReads(env) {
  const storage = createStorage(env)

  function streamThatFails() {
    return new Readable({
      read() {
        this.destroy(new Error('disk read failed'))
      },
    })
  }

  return { ...storage, stream: streamThatFails }
}

async function signedInAdmin(app) {
  const admin = seedAdmin(app.db)
  const client = app.client()
  await client.login(admin.email, admin.password)
  return client
}

test('adding a person leaves no user or membership behind when the invitation fails', async () => {
  const app = await bootApp()
  try {
    const admin = await signedInAdmin(app)
    const { clientId } = seedClientUser(app.db, { clientName: 'Northstar', email: 'first@test.local' })
    failInsertsInto(app.db, 'invitations')

    const response = await admin.post(`/clients/${clientId}/users`, { name: 'New Person', email: 'new@test.local' })

    assert.equal(response.status, 500)
    const user = app.db.prepare('SELECT id FROM users WHERE email = ?').get('new@test.local')
    assert.equal(user, undefined)
    const memberships = app.db.prepare('SELECT COUNT(*) AS count FROM client_memberships WHERE client_id = ?').get(clientId)
    assert.equal(memberships.count, 1)
  } finally {
    await app.close()
  }
})

test('a failed upload removes the stored file instead of leaving an orphan', async () => {
  const app = await bootApp()
  try {
    const admin = await signedInAdmin(app)
    const { clientId } = seedClientUser(app.db, { clientName: 'Northstar', email: 'mara@test.local' })
    const projectId = seedProject(app.db, { clientId })
    failInsertsInto(app.db, 'files')

    const response = await admin.upload(`/projects/${projectId}/files`, pngUpload('mockup.png'))

    assert.equal(response.status, 500)
    const storedFiles = readdirSync(join(app.env.UPLOAD_DIR, String(projectId)))
    assert.deepEqual(storedFiles, [])
  } finally {
    await app.close()
  }
})

test('a download whose read fails does not crash the server', { timeout: DOWNLOAD_TEST_TIMEOUT_MS }, async () => {
  const app = await bootApp({ createTestStorage: storageWithFailingReads })
  try {
    const admin = await signedInAdmin(app)
    const { clientId } = seedClientUser(app.db, { clientName: 'Northstar', email: 'mara@test.local' })
    const projectId = seedProject(app.db, { clientId })
    const upload = await admin.upload(`/projects/${projectId}/files`, pngUpload('mockup.png'))
    assert.equal(upload.status, 201)

    await assert.rejects(admin.get(`/projects/${projectId}/files/${upload.data.file.id}/download`))

    const health = await admin.get('/health')
    assert.equal(health.status, 200)
  } finally {
    await app.close()
  }
})
