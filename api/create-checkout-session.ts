import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  const chipPrice = process.env.STRIPE_PRICE_PRAYER_CHIP
  const prayPrice = process.env.STRIPE_PRICE_PRAY_FOR_IVAN

  if (!secretKey || !chipPrice || !prayPrice) {
    const missing: string[] = []

    if (!secretKey) missing.push('STRIPE_SECRET_KEY')
    if (!chipPrice) missing.push('STRIPE_PRICE_PRAYER_CHIP')
    if (!prayPrice) missing.push('STRIPE_PRICE_PRAY_FOR_IVAN')

    return res.status(500).json({
      error: `Stripe configuration is missing: ${missing.join(', ')}`,
    })
  }

  const stripe = new Stripe(secretKey)

  try {
    const {
      kind,
      quantity = 1,
      prayerRequest = '',
    } = req.body ?? {}

    if (kind !== 'chip' && kind !== 'pray') {
      return res.status(400).json({
        error: 'Invalid purchase type.',
      })
    }

    const qty = Math.max(1, Math.min(Number(quantity) || 1, 100))

    const price = kind === 'chip' ? chipPrice : prayPrice

    const siteUrl =
      process.env.SITE_URL ||
      `http://${req.headers.host || 'localhost:3000'}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',

      line_items: [
        {
          price,
          quantity: qty,
        },
      ],

      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancelled`,

      metadata: {
        kind,
        prayer_request:
          typeof prayerRequest === 'string'
            ? prayerRequest.slice(0, 500)
            : '',
      },
    })

    return res.status(200).json({
      url: session.url,
    })
  } catch (error) {
    console.error('Stripe checkout error:', error)

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Unable to start Stripe Checkout.',
    })
  }
}