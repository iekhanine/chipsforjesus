import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

type PurchaseKind = 'chip' | 'pray'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  const chipPrice = process.env.STRIPE_PRICE_PRAYER_CHIP
  const prayPrice = process.env.STRIPE_PRICE_PRAY_FOR_IVAN

  const missing = [
    !secretKey && 'STRIPE_SECRET_KEY',
    !chipPrice && 'STRIPE_PRICE_PRAYER_CHIP',
    !prayPrice && 'STRIPE_PRICE_PRAY_FOR_IVAN',
  ].filter(Boolean)

  if (missing.length) {
    console.error('Missing Stripe environment variables:', missing)
    return res.status(500).json({
      error: `Stripe configuration is missing: ${missing.join(', ')}`
    })
  }

  const stripe = new Stripe(secretKey)

  try {
    const { kind, quantity, prayerRequest } = req.body as {
      kind?: PurchaseKind
      quantity?: number
      prayerRequest?: string
    }

    if (kind !== 'chip' && kind !== 'pray') {
      return res.status(400).json({ error: 'Invalid purchase type.' })
    }

    const safeQuantity = Math.max(1, Math.min(50, Math.floor(Number(quantity) || 1)))
    const price = kind === 'chip' ? chipPrice : prayPrice

    const siteUrl = (process.env.SITE_URL || req.headers.origin || 'http://localhost:3000').replace(/\/$/, '')
    const sanitizedPrayer = typeof prayerRequest === 'string'
      ? prayerRequest.trim().slice(0, 450)
      : ''

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price, quantity: safeQuantity }],
      success_url: `${siteUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancelled`,
      customer_creation: 'always',
      submit_type: 'pay',
      metadata: {
        project: 'chipsforjesus',
        kind,
        quantity: String(safeQuantity),
        prayer_request: kind === 'chip' ? sanitizedPrayer : '',
      },
      payment_intent_data: {
        metadata: {
          project: 'chipsforjesus',
          kind,
          quantity: String(safeQuantity),
        },
      },
    })

    return res.status(200).json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return res.status(500).json({ error: 'Could not start Stripe Checkout.' })
  }
}
