import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const db = getSupabaseAdmin()
    // Fetch both sources independently. A missing new table or migration must
    // not make approved customer prayers disappear.
    const [ordersResult, entriesResult] = await Promise.allSettled([
      db.from('c4j_orders').select('id,prayer_request,public_response')
        .eq('public_requested', true).eq('public_approved', true)
        .neq('prayer_request', '').neq('public_response', '')
        .order('created_at', { ascending: false }).limit(100),
      db.from('c4j_wall_entries').select('id,prayer,response,category')
        .eq('visible', true).order('id', { ascending: true }).limit(100),
    ])
    const orders = ordersResult.status === 'fulfilled' && !ordersResult.value.error
      ? (ordersResult.value.data || []) : []
    const entries = entriesResult.status === 'fulfilled' && !entriesResult.value.error
      ? (entriesResult.value.data || []) : []
    if (ordersResult.status === 'rejected' || (ordersResult.status === 'fulfilled' && ordersResult.value.error))
      console.error('Prayer wall: orders query unavailable')
    if (entriesResult.status === 'rejected' || (entriesResult.status === 'fulfilled' && entriesResult.value.error))
      console.error('Prayer wall: wall entries query unavailable (migration may be pending)')
    const prayers = [
      ...orders.filter(row => row.prayer_request && row.public_response).map(row => ({
        id: String(row.id), prayer: row.prayer_request, response: row.public_response, category: 'Community',
      })),
      ...entries.filter(row => row.prayer && row.response).map(row => ({
        id: `seed-${row.id}`, prayer: row.prayer, response: row.response, category: row.category || 'Community',
      })),
    ]
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return res.status(200).json({ prayers })
  } catch (e) {
    console.error('Public prayer wall error', e)
    return res.status(503).json({ error: 'Prayer wall temporarily unavailable', prayers: [] })
  }
}
