import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import { createApp } from './app.js'
import { createDatabase, seedDemo } from './db.js'

const port = Number(process.env.PORT || 4180)
const production = process.env.NODE_ENV === 'production'
const host = process.env.HOST || (production ? '0.0.0.0' : '127.0.0.1')
const db = createDatabase()
if (process.env.SEED_DEMO !== 'false') seedDemo(db)
const app = createApp(db)
const dist = resolve('dist')
if (production && existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*splat', (_req, res) => res.sendFile(resolve(dist, 'index.html')))
}
app.listen(port, host, () => console.log(`Revive Portal listening on http://${host}:${port}`))

