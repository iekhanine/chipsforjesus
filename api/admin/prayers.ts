import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin, requireJesusAdmin } from '../_lib/supabase.js'

type OrderRow = {
  kind: 'chip' | 'pray'
  quantity: number | null
  fulfilled_quantity: number | null
  amount_total: number | null
  customer_email: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireJesusAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('c4j_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    const orders = (data ?? []) as Array<OrderRow & Record<string, unknown>>
    const summary = orders.reduce(
      (acc, order) => {
        const quantity = Number(order.quantity || 0)
        const fulfilled = Number(order.fulfilled_quantity || 0)
        const amount = Number(order.amount_total || 0)

        acc.orders += 1
        acc.revenueCents += amount
        if (order.kind === 'chip') {
          acc.prayerChips += quantity
          acc.pendingPrayers += Math.max(quantity - fulfilled, 0)
        }
        if (order.kind === 'pray') acc.prayersForIvan += quantity
        if (order.customer_email) acc.customers.add(String(order.customer_email).toLowerCase())
        return acc
      },
      {
        orders: 0,
        revenueCents: 0,
        prayerChips: 0,
        pendingPrayers: 0,
        prayersForIvan: 0,
        customers: new Set<string>(),
      },
    )

    return res.status(200).json({
      adminEmail: auth.email,
      orders,
      summary: {
        orders: summary.orders,
        revenueCents: summary.revenueCents,
        prayerChips: summary.prayerChips,
        pendingPrayers: summary.pendingPrayers,
        prayersForIvan: summary.prayersForIvan,
        customers: summary.customers.size,
      },
    })
  } catch (error) {
    console.error('Jesus Admin list error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not load Jesus Admin data.',
    })
  }
}
