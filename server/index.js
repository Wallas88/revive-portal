import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import { createApp } from './app.js'
import { createDatabase, seedDemo } from './db.js'

const port = Number(process.env.PORT || 4180)
const db = createDatabase()
if (process.env.SEED_DEMO !== 'false') seedDemo(db)
const app = createApp(db)
const dist = resolve('dist')
if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*splat', (_req, res) => res.sendFile(resolve(dist, 'index.html')))
}
app.listen(port, '127.0.0.1', () => console.log(`Revive Portal API listening on http://127.0.0.1:${port}`))
