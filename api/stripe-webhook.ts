import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).send('Method not allowed')
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey || !webhookSecret) {
    const missing = [
      !secretKey && 'STRIPE_SECRET_KEY',
      !webhookSecret && 'STRIPE_WEBHOOK_SECRET',
    ].filter(Boolean)
    console.error('Missing Stripe webhook environment variables:', missing)
    return res.status(500).send(`Stripe webhook configuration is missing: ${missing.join(', ')}`)
  }

  const stripe = new Stripe(secretKey)

  const signature = req.headers['stripe-signature']
  if (typeof signature !== 'string') {
    return res.status(400).send('Missing Stripe signature')
  }

  try {
    const rawBody = await getRawBody(req)
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      console.log('Chips for Jesus purchase completed', {
        sessionId: session.id,
        kind: session.metadata?.kind,
        quantity: session.metadata?.quantity,
        prayerRequest: session.metadata?.prayer_request,
        customerEmail: session.customer_details?.email,
      })

      // TODO: Persist counters and prayer requests to a database here.
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return res.status(400).send('Invalid webhook')
  }
}
