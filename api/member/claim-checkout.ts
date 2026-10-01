import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { requireMember } from '../_lib/supabase.js'
import { persistCheckoutSession } from '../_lib/orders.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireMember(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured.' })

    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : ''
    if (!sessionId.startsWith('cs_')) return res.status(400).json({ error: 'A valid checkout session is required.' })

    const stripe = new Stripe(secretKey)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return res.status(409).json({ error: 'That checkout is not complete.' })
    }

    const purchaseEmail = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase()
    if (!purchaseEmail) return res.status(422).json({ error: 'Stripe did not return an email for this purchase.' })
    if (purchaseEmail !== auth.email) {
      return res.status(403).json({
        error: `This purchase was made with ${purchaseEmail}. Sign in with that email to add it to your account.`,
      })
    }

    const result = await persistCheckoutSession(session, { memberUserId: auth.user.id })
    return res.status(200).json({ order: result.order })
  } catch (error) {
    console.error('Member checkout claim error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not add this purchase to your account.',
    })
  }
}
