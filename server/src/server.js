import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import { loadEnv } from './config/env.js'
import { openDatabase } from './db/connection.js'
import { createApp } from './app.js'

const env = loadEnv()
const db = openDatabase(env.DATABASE_PATH)
const app = createApp({ db, env })

// In production the same process serves the built client; every non-API
// path falls through to index.html so deep links (invite, reset) resolve.
const dist = resolve('dist')
if (env.production && existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  app.get('*splat', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.sendFile(resolve(dist, 'index.html')) })
}

const server = app.listen(env.PORT, env.host, () => console.log(`Revive Portal listening on http://${env.host}:${env.PORT}`))
// Graceful stop: stop accepting, drop idle keep-alive connections, and never
// hang on a slow client — the platform's next deploy is waiting on this.
function shutdown() {
  server.close(() => { db.close(); process.exit(0) })
  server.closeAllConnections?.()
  setTimeout(() => process.exit(0), 5000).unref()
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, shutdown)
