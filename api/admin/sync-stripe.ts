import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { requireJesusAdmin } from '../_lib/supabase.js'
import { persistCheckoutSession } from '../_lib/orders.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireJesusAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured.' })

    const stripe = new Stripe(secretKey)
    let matched = 0
    let inserted = 0
    let scanned = 0
    let startingAfter: string | undefined

    while (scanned < 500) {
      const page = await stripe.checkout.sessions.list({
        limit: Math.min(100, 500 - scanned),
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })

      for (const session of page.data) {
        scanned += 1
        if (session.status !== 'complete') continue
        const kind = session.metadata?.kind
        if (kind !== 'chip' && kind !== 'pray') continue

        matched += 1
        const result = await persistCheckoutSession(session)
        if (result.inserted) inserted += 1
      }

      if (!page.has_more || !page.data.length) break
      startingAfter = page.data[page.data.length - 1].id
    }

    return res.status(200).json({ matched, inserted, scanned })
  } catch (error) {
    console.error('Jesus Admin Stripe sync error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not sync Stripe purchases.',
    })
  }
}
