import { createHash, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

// Private file storage on local disk under UPLOAD_DIR. Keys are random and
// extensionless, grouped per project; nothing here is ever served
// statically. Swap this module for an object-store driver (R2/S3) without
// touching the files module.
export function createStorage(env) {
  const root = resolve(env.UPLOAD_DIR)
  mkdirSync(root, { recursive: true })
  const pathFor = (key) => {
    const target = resolve(root, key)
    if (!target.startsWith(root + '/')) throw new Error('Invalid storage key')
    return target
  }
  return {
    root,
    newKey: (projectId) => `${projectId}/${randomBytes(16).toString('hex')}`,
    async save(key, buffer) {
      const target = pathFor(key)
      mkdirSync(dirname(target), { recursive: true })
      await new Promise((done, fail) => {
        const out = createWriteStream(target, { flags: 'wx' })
        out.on('error', fail); out.on('finish', done); out.end(buffer)
      })
      return { sha256: createHash('sha256').update(buffer).digest('hex'), size: buffer.length }
    },
    exists: (key) => existsSync(pathFor(key)),
    stream: (key) => createReadStream(pathFor(key)),
    size: async (key) => (await stat(pathFor(key))).size,
    remove: (key) => rm(pathFor(key), { force: true }),
  }
}
