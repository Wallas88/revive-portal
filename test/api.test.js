import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../server/app.js'
import { createDatabase, seedDemo } from '../server/db.js'

let server
let baseUrl
const db = createDatabase(':memory:')

before(async () => {
  seedDemo(db)
  const app = createApp(db, { sessionHours: 1 })
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve) })
  baseUrl = `http://127.0.0.1:${server.address().port}/api`
})

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
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'client@demo.local', password: 'revive-demo' }),
  })
  assert.equal(login.status, 200)
  const { token } = await login.json()
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
