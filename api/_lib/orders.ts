import Stripe from 'stripe'
import { getSupabaseAdmin } from './supabase.js'

export type C4JKind = 'chip' | 'pray'

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null
}

export async function persistCheckoutSession(
  session: Stripe.Checkout.Session,
  options: { memberUserId?: string | null } = {},
) {
  const metadata = session.metadata ?? {}
  const kind: C4JKind | null = metadata.kind === 'chip' || metadata.kind === 'pray' ? metadata.kind : null
  if (!kind) throw new Error('Checkout session is not a Chips for Jesus purchase.')

  const quantity = Math.max(1, Number(metadata.quantity || 1))
  const paymentIntent =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null
  const customerEmail = normalizeEmail(session.customer_details?.email || session.customer_email)
  const memberUserId = options.memberUserId || metadata.member_user_id || null
  const supabase = getSupabaseAdmin()

  const base = {
    stripe_payment_intent: paymentIntent,
    customer_email: customerEmail,
    customer_name: session.customer_details?.name || null,
    kind,
    quantity,
    amount_total: session.amount_total || 0,
    currency: session.currency || 'usd',
    prayer_request: metadata.prayer_request?.trim() || null,
    payment_status: session.payment_status || null,
    stripe_created_at: new Date(session.created * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: existingError } = await supabase
    .from('c4j_orders')
    .select('*')
    .eq('stripe_session_id', session.id)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing) {
    const patch: Record<string, unknown> = { ...base }
    if (memberUserId && !existing.member_user_id) {
      patch.member_user_id = memberUserId
      patch.claimed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('c4j_orders')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return { order: data, inserted: false }
  }

  const initialFulfilled = kind === 'pray' ? quantity : 0
  const initialStatus = kind === 'pray' ? 'completed' : 'pending'
  const { data, error } = await supabase
    .from('c4j_orders')
    .insert({
      stripe_session_id: session.id,
      ...base,
      member_user_id: memberUserId,
      claimed_at: memberUserId ? new Date().toISOString() : null,
      fulfilled_quantity: initialFulfilled,
      status: initialStatus,
      prayed_at: kind === 'pray' ? new Date(session.created * 1000).toISOString() : null,
    })
    .select('*')
    .single()

  if (error) throw error
  return { order: data, inserted: true }
}
