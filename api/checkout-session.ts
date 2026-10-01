import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured.' })

    const sessionId = Array.isArray(req.query.session_id) ? req.query.session_id[0] : req.query.session_id
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'A valid Stripe Checkout session is required.' })
    }

    const stripe = new Stripe(secretKey)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const kind = session.metadata?.kind
    if (kind !== 'chip' && kind !== 'pray') {
      return res.status(404).json({ error: 'This is not a Chips for Jesus purchase.' })
    }

    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return res.status(409).json({ error: 'This checkout has not completed payment.' })
    }

    const email = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase()
    if (!email) return res.status(422).json({ error: 'Stripe did not return an email for this purchase.' })

    return res.status(200).json({
      sessionId: session.id,
      email,
      name: session.customer_details?.name || null,
      kind,
      quantity: Math.max(1, Number(session.metadata?.quantity || 1)),
      amountTotal: session.amount_total || 0,
      currency: session.currency || 'usd',
    })
  } catch (error) {
    console.error('Checkout session lookup error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not load this purchase.',
    })
  }
}
