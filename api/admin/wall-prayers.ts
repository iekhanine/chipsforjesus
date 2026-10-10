import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireJesusAdmin, getSupabaseAdmin, getErrorMessage } from '../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET','POST','PATCH','DELETE'].includes(req.method || '')) return res.status(405).json({error:'Method not allowed'})
  try {
    const auth = await requireJesusAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({error:auth.error})
    const db = getSupabaseAdmin().from('c4j_wall_entries')
    if (req.method === 'GET') {
      const {data,error} = await db.select('id,prayer,response,category,visible').order('id',{ascending:true}).limit(300)
      if(error) throw error
      return res.status(200).json({entries:data})
    }
    const body = req.body || {}
    if(req.method === 'DELETE') {
      const id = Number(body.id)
      if(!Number.isSafeInteger(id) || id < 1) return res.status(400).json({error:'Invalid entry id'})
      const {error} = await db.delete().eq('id',id)
      if(error) throw error
      return res.status(200).json({ok:true})
    }
    const prayer = String(body.prayer || '').trim(), response = String(body.response || '').trim(), category = String(body.category || 'Community').trim()
    if (!prayer || prayer.length > 2000 || !response || response.length > 2000 || !category || category.length > 80) return res.status(400).json({error:'Prayer and reply required (maximum 2000 characters each).'})
    const record = {prayer,response,category,visible:body.visible !== false}
    if(req.method === 'POST') {
      const {data,error} = await db.insert(record).select('id,prayer,response,category,visible').single()
      if(error) throw error
      return res.status(200).json({entry:data})
    }
    const id = Number(body.id)
    if(!Number.isSafeInteger(id) || id < 1) return res.status(400).json({error:'Invalid entry id'})
    const {data,error} = await db.update(record).eq('id',id).select('id,prayer,response,category,visible').single()
    if(error) throw error
    return res.status(200).json({entry:data})
  } catch(e) { return res.status(500).json({error:getErrorMessage(e,'Unable to manage prayer wall')}) }
}
