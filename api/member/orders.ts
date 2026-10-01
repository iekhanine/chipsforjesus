import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin, requireMember } from '../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireMember(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()

    const { error: claimError } = await supabase
      .from('c4j_orders')
      .update({ member_user_id: auth.user.id, claimed_at: now, updated_at: now })
      .is('member_user_id', null)
      .eq('customer_email', auth.email)

    if (claimError) throw claimError

    const { data, error } = await supabase
      .from('c4j_orders')
      .select('id,stripe_session_id,customer_email,customer_name,kind,quantity,amount_total,currency,prayer_request,payment_status,fulfilled_quantity,status,prayed_at,stripe_created_at,created_at,updated_at')
      .eq('member_user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    const orders = data ?? []
    const summary = orders.reduce(
      (acc, order) => {
        const quantity = Math.max(0, Number(order.quantity || 0))
        const fulfilled = Math.max(0, Math.min(quantity, Number(order.fulfilled_quantity || 0)))
        acc.orders += 1
        acc.grossCents += Number(order.amount_total || 0)
        if (order.kind === 'chip') {
          acc.chipsPurchased += quantity
          acc.prayedFor += fulfilled
          acc.chipsRemaining += Math.max(quantity - fulfilled, 0)
        } else if (order.kind === 'pray') {
          acc.prayersForIvan += quantity
        }
        return acc
      },
      { orders: 0, grossCents: 0, chipsPurchased: 0, prayedFor: 0, chipsRemaining: 0, prayersForIvan: 0 },
    )

    return res.status(200).json({
      user: {
        id: auth.user.id,
        email: auth.email,
        name: auth.user.user_metadata?.full_name || auth.user.user_metadata?.name || null,
      },
      summary,
      orders,
    })
  } catch (error) {
    console.error('Member orders error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not load your Chips for Jesus account.',
    })
  }
}
