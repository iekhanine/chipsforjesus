import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getErrorMessage, getSupabaseAdmin, requireJesusAdmin } from '../_lib/supabase.js'

type Action = 'increment' | 'complete' | 'reopen' | 'archive' | 'restore' | 'notes' | 'publish' | 'unpublish'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireJesusAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    const body = (req.body ?? {}) as { id?: string; action?: Action; notes?: string; publicResponse?: string }
    const { id, action, notes, publicResponse } = body
    if (!id || !action) return res.status(400).json({ error: 'Order id and action are required.' })

    const allowedActions: Action[] = ['increment', 'complete', 'reopen', 'archive', 'restore', 'notes', 'publish', 'unpublish']
    if (!allowedActions.includes(action)) return res.status(400).json({ error: 'Invalid admin action.' })

    const supabase = getSupabaseAdmin()
    const { data: current, error: loadError } = await supabase
      .from('c4j_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (loadError || !current) throw loadError || new Error('Order not found.')

    const quantity = Math.max(1, Number(current.quantity || 1))
    const fulfilled = Math.max(0, Number(current.fulfilled_quantity || 0))
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_updated_by: auth.email,
    }

    if (action === 'increment') {
      const next = Math.min(quantity, fulfilled + 1)
      patch.fulfilled_quantity = next
      patch.status = next >= quantity ? 'completed' : 'in_progress'
      patch.prayed_at = next >= quantity ? new Date().toISOString() : null
    }

    if (action === 'complete') {
      patch.fulfilled_quantity = quantity
      patch.status = 'completed'
      patch.prayed_at = new Date().toISOString()
    }

    if (action === 'reopen') {
      patch.fulfilled_quantity = 0
      patch.status = 'pending'
      patch.prayed_at = null
    }

    if (action === 'archive') patch.status = 'archived'

    if (action === 'restore') {
      patch.status = fulfilled >= quantity ? 'completed' : fulfilled > 0 ? 'in_progress' : 'pending'
    }

    if (action === 'publish') {
      if (!current.public_requested || !current.prayer_request) return res.status(400).json({ error: 'Customer did not opt in to sharing a written prayer.' })
      if (!publicResponse?.trim()) return res.status(400).json({ error: 'Write a public response before publishing.' })
      patch.public_approved = true
      patch.public_response = publicResponse.trim().slice(0, 1000)
    }
    if (action === 'unpublish') patch.public_approved = false

    if (action === 'notes') {
      patch.admin_notes = typeof notes === 'string' ? notes.slice(0, 4000) : ''
    }

    const { data, error } = await supabase
      .from('c4j_orders')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return res.status(200).json({ order: data })
  } catch (error) {
    console.error('Jesus Admin update error:', error)
    return res.status(500).json({
      error: getErrorMessage(error, 'Could not update prayer.'),
    })
  }
}
