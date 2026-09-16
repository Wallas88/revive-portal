// Every environment variable the server reads, in one place, validated once.
// Nothing else in server/ touches process.env.
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4180),
  HOST: z.string().optional(),
  // Both live on the same persistent volume in production (Render disk at /var/data).
  DATABASE_PATH: z.string().default('./data/revive-portal.db'),
  UPLOAD_DIR: z.string().default('./data/uploads'),
  SESSION_HOURS: z.coerce.number().positive().default(12),
  // Public origin used to build invitation and password-reset links.
  APP_URL: z.string().url().default('http://127.0.0.1:5177'),
  // Optional email transport (Resend). Without it, invite/reset links are
  // handed to the admin to send by hand — nothing breaks.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Revive Portal <portal@siterevivesa.com>'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(15),
})

export function loadEnv(source = process.env) {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Invalid environment configuration — ${problems}`)
  }
  const env = parsed.data
  return {
    ...env,
    production: env.NODE_ENV === 'production',
    host: env.HOST || (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
    cookieSecure: env.NODE_ENV === 'production',
  }
}
