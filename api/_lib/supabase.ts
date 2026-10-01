import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
}

function publicSupabaseKey() {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  )
}

function serviceSupabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  )
}

export function getSupabaseAdmin() {
  const url = supabaseUrl()
  const key = serviceSupabaseKey()

  if (!url || !key) {
    const missing = [
      !url && 'SUPABASE_URL or VITE_SUPABASE_URL',
      !key && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean)

    throw new Error(`Supabase server configuration is missing: ${missing.join(', ')}`)
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function getSupabaseAuthClient() {
  const url = supabaseUrl()
  const key = publicSupabaseKey()

  if (!url || !key) {
    throw new Error('Supabase auth configuration is missing.')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function getBearerToken(req: VercelRequest) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length).trim()
}

export async function requireMember(req: VercelRequest) {
  const token = getBearerToken(req)
  if (!token) {
    return { ok: false as const, status: 401, error: 'Sign in required.' }
  }

  const authClient = getSupabaseAuthClient()
  const { data, error } = await authClient.auth.getUser(token)

  if (error || !data.user?.email) {
    return { ok: false as const, status: 401, error: 'Your session is invalid or expired.' }
  }

  return {
    ok: true as const,
    user: data.user,
    email: data.user.email.trim().toLowerCase(),
  }
}

function allowedAdminEmails() {
  const configured = (process.env.JESUS_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  return Array.from(new Set(['iekhanine@gmail.com', ...configured]))
}

export async function requireJesusAdmin(req: VercelRequest) {
  const auth = await requireMember(req)
  if (!auth.ok) return auth

  const allowed = allowedAdminEmails()
  if (!allowed.length) {
    return { ok: false as const, status: 500, error: 'JESUS_ADMIN_EMAILS is not configured.' }
  }

  if (!allowed.includes(auth.email)) {
    return { ok: false as const, status: 403, error: 'This Google account is not authorized for Jesus Admin.' }
  }

  return auth
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message

  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    const message = typeof value.message === 'string' ? value.message.trim() : ''
    const details = typeof value.details === 'string' ? value.details.trim() : ''
    const hint = typeof value.hint === 'string' ? value.hint.trim() : ''
    const code = typeof value.code === 'string' ? value.code.trim() : ''

    const parts = [message, details, hint, code ? `Code: ${code}` : ''].filter(Boolean)
    if (parts.length) return parts.join(' | ')
  }

  return fallback
}
