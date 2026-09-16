import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const keyLength = 64

// scrypt with a per-user salt; stored as "salt:hash" (unchanged from the
// original auth.js so existing hashes keep working).
export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, keyLength).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored) return false
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const actual = scryptSync(password, salt, keyLength)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Opaque random tokens (sessions, invitations, resets). Only the hash is
// stored, so a database read never yields a usable token.
export const createToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token) => createHash('sha256').update(token).digest('hex')
export const createCsrfToken = () => randomBytes(24).toString('base64url')
