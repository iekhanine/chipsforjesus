import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getErrorMessage, getSupabaseAdmin, requireJesusAdmin } from '../_lib/supabase.js'
import { sendPrayerChipGiftEmail } from '../_lib/prayer-chip-email.js'

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function errorPayload(error: unknown, fallback: string, stage: string) {
  const payload: Record<string, unknown> = {
    error: getErrorMessage(error, fallback),
    stage,
  }

  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    for (const key of ['code', 'details', 'hint']) {
      if (typeof value[key] === 'string' && value[key]) payload[key] = value[key]
    }
  }

  return payload
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed', stage: 'method' })
  }

  let stage = 'authentication'

  try {
    const auth = await requireJesusAdmin(req)
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error, stage })
    }

    stage = 'validation'

    const body = (req.body ?? {}) as {
      email?: string
      name?: string
      quantity?: number | string
      notes?: string
    }

    const email = normalizeEmail(body.email)
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 4000) : ''
    const quantity = Math.floor(Number(body.quantity))

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid recipient email.', stage })
    }

    if (!Number.isFinite(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Chip quantity must be at least 1.', stage })
    }

    if (quantity > 100_000_000) {
      return res.status(400).json({ error: 'Chip quantity is too large for a single grant.', stage })
    }

    stage = 'database-client'
    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()

    stage = 'database-insert'
    const { data, error } = await supabase
      .from('c4j_orders')
      .insert({
        stripe_session_id: `admin_grant_${randomUUID()}`,
        customer_email: email,
        customer_name: name || null,
        kind: 'chip',
        quantity,
        amount_total: 0,
        currency: 'usd',
        payment_status: 'admin_grant',
        fulfilled_quantity: 0,
        status: 'pending',
        admin_notes: notes || `Administrative chip grant: ${quantity.toLocaleString()} chips`,
        last_updated_by: auth.email,
        stripe_created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Jesus Admin give chips Supabase insert error:', error)
      return res.status(500).json(errorPayload(error, 'Could not grant chips.', stage))
    }

    stage = 'email'
    const emailResult = await sendPrayerChipGiftEmail({
      orderId: String(data.id),
      to: email,
      recipientName: name || null,
      quantity,
    })

    if (!emailResult.sent) {
      console.error('Prayer Chip gift email failed:', emailResult.error)
    }

    return res.status(200).json({
      ok: true,
      order: data,
      email: emailResult,
      message: emailResult.sent
        ? `${quantity.toLocaleString()} chips granted to ${email}. Gift email sent.`
        : `${quantity.toLocaleString()} chips granted to ${email}, but the gift email could not be sent: ${emailResult.error}`,
    })
  } catch (error) {
    console.error(`Jesus Admin give chips error at ${stage}:`, error)
    return res.status(500).json(errorPayload(error, 'Could not grant chips.', stage))
  }
}
