import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../server/app.js'
import { hashPassword } from '../server/auth.js'
import { createDatabase, seedDemo } from '../server/db.js'

let server
let baseUrl
const db = createDatabase(':memory:')

before(async () => {
  seedDemo(db)
  const otherClient = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id')
    .get('Other Client', 'other@demo.local', hashPassword('another-demo'), 'client')
  db.prepare('INSERT INTO projects (client_id, name, summary, status, progress) VALUES (?, ?, ?, ?, ?)')
    .run(otherClient.id, 'Private Project', 'A project assigned to a different client.', 'discovery', 10)
  const app = createApp(db, { sessionHours: 1 })
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve) })
  baseUrl = `http://127.0.0.1:${server.address().port}/api`
})

async function login() {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'client@demo.local', password: 'revive-demo' }),
  })
  assert.equal(response.status, 200)
  return (await response.json()).token
}

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
})

test('health endpoint responds', async () => {
  const response = await fetch(`${baseUrl}/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('protected projects reject anonymous requests', async () => {
  const response = await fetch(`${baseUrl}/projects`)
  assert.equal(response.status, 401)
})

test('client can authenticate, read their project, and post a message', async () => {
  const token = await login()
  const headers = { authorization: `Bearer ${token}` }
  const list = await fetch(`${baseUrl}/projects`, { headers })
  const { projects } = await list.json()
  assert.equal(projects.length, 1)
  const created = await fetch(`${baseUrl}/projects/${projects[0].id}/messages`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'A clear test update.' }),
  })
  assert.equal(created.status, 201)
  assert.equal((await created.json()).message.body, 'A clear test update.')
})

test('client cannot read a project assigned to another user', async () => {
  const token = await login()
  const otherProject = db.prepare("SELECT id FROM projects WHERE name = 'Private Project'").get()
  const response = await fetch(`${baseUrl}/projects/${otherProject.id}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  assert.equal(response.status, 404)
})

test('message validation rejects blank content', async () => {
  const token = await login()
  const project = db.prepare("SELECT id FROM projects WHERE name = 'Northstar Website'").get()
  const response = await fetch(`${baseUrl}/projects/${project.id}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ body: '   ' }),
  })
  assert.equal(response.status, 400)
})

test('logout invalidates the active session', async () => {
  const token = await login()
  const headers = { authorization: `Bearer ${token}` }
  const logout = await fetch(`${baseUrl}/auth/session`, { method: 'DELETE', headers })
  assert.equal(logout.status, 204)
  const session = await fetch(`${baseUrl}/me`, { headers })
  assert.equal(session.status, 401)
})

