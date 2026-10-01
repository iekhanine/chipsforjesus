import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CheckCircle2, Clock3, Coins, LogOut, RefreshCcw, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react'
import { supabase } from './lib/supabase'
import JesusAdmin from './JesusAdmin'

type MemberOrder = {
  id: string
  stripe_session_id: string
  customer_email: string | null
  customer_name: string | null
  kind: 'chip' | 'pray'
  quantity: number
  amount_total: number
  currency: string
  prayer_request: string | null
  payment_status: string | null
  fulfilled_quantity: number
  status: 'pending' | 'in_progress' | 'completed' | 'archived'
  prayed_at: string | null
  stripe_created_at: string | null
  created_at: string
  updated_at: string
}

type MemberSummary = {
  orders: number
  grossCents: number
  chipsPurchased: number
  prayedFor: number
  chipsRemaining: number
  prayersForIvan: number
}

const emptySummary: MemberSummary = { orders: 0, grossCents: 0, chipsPurchased: 0, prayedFor: 0, chipsRemaining: 0, prayersForIvan: 0 }

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { error: `Server returned an invalid response (${response.status}).` } }
}

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

function when(value: string | null) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export default function Members() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<MemberOrder[]>([])
  const [summary, setSummary] = useState<MemberSummary>(emptySummary)
  const [profile, setProfile] = useState<{ email: string; name: string | null } | null>(null)
  const [error, setError] = useState('')
  const [purchaseAdded, setPurchaseAdded] = useState(false)

  const isJesusAdmin = (session?.user.email || '').trim().toLowerCase() === 'iekhanine@gmail.com'

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false) })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.access_token) loadAccount(session.access_token)
  }, [session?.access_token])

  async function claimPendingCheckout(token: string) {
    const sessionId = window.localStorage.getItem('c4j_pending_checkout')
    if (!sessionId) return

    const response = await fetch('/api/member/claim-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId }),
    })
    const data = await readJson(response)
    if (!response.ok) throw new Error(data.error || 'Could not add your latest purchase.')
    window.localStorage.removeItem('c4j_pending_checkout')
    window.localStorage.removeItem('c4j_pending_checkout_email')
    setPurchaseAdded(true)
  }

  async function loadAccount(token = session?.access_token) {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      try { await claimPendingCheckout(token) } catch (claimError) { setError(claimError instanceof Error ? claimError.message : 'Could not add your latest purchase.') }

      const response = await fetch('/api/member/orders', { headers: { Authorization: `Bearer ${token}` } })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || 'Could not load your account.')
      setOrders(data.orders || [])
      setSummary(data.summary || emptySummary)
      setProfile(data.user || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your account.')
    } finally {
      setLoading(false)
    }
  }

  if (!supabase) {
    return <main className="admin-page"><section className="admin-login-card"><p className="eyebrow">MY CHIPS</p><h1>Supabase is not configured.</h1></section></main>
  }

  if (checking) {
    return <main className="admin-page"><div className="admin-empty">Checking your account...</div></main>
  }

  if (!session) {
    return (
      <main className="admin-page">
        <section className="admin-login-card">
          <div className="admin-seal">J</div>
          <p className="eyebrow">MY CHIPS</p>
          <h1>Your prayer ledger.</h1>
          <p>Sign in to see what you bought, what has already been prayed for, and what is still waiting.</p>
          <a className="primary-link-button" href="/login">Sign in to My Chips</a>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-page member-page">
      <section className="admin-heading">
        <div>
          <p className="eyebrow">MY CHIPS</p>
          <h1>Prayer ledger.</h1>
          <p>Your purchases and prayer progress, tied to the email you used at checkout.</p>
        </div>
        <div className="admin-heading-actions">
          <span>{profile?.name || session.user.user_metadata?.full_name || session.user.email}<br />{profile?.email || session.user.email}</span>
          <button onClick={() => loadAccount()} disabled={loading}><RefreshCcw size={15} /> Refresh</button>
          <button onClick={async () => { await supabase?.auth.signOut(); window.location.assign('/login') }}><LogOut size={15} /> Sign out</button>
        </div>
      </section>

      {purchaseAdded && <div className="notice success member-notice"><CheckCircle2 size={18} /> Your latest Stripe purchase was added to this account.</div>}
      {error && <div className="error-box admin-error">{error}</div>}

      <section className="admin-stats member-stats">
        <StatCard icon={<Coins size={20} />} label="Chips bought" value={summary.chipsPurchased} />
        <StatCard icon={<CheckCircle2 size={20} />} label="Prayed for" value={summary.prayedFor} />
        <StatCard icon={<Clock3 size={20} />} label="Still waiting" value={summary.chipsRemaining} emphasis />
        <StatCard icon={<Sparkles size={20} />} label="Prayers for Ivan" value={summary.prayersForIvan} />
      </section>

      <section className="admin-substats member-substats">
        <span><strong>{summary.orders}</strong> purchases on this account</span>
        <span><strong>{money(summary.grossCents)}</strong> total paid</span>
      </section>

      <a className="member-buy-cta" href="/">
        <span className="member-buy-icon"><Coins size={30} /></span>
        <span className="member-buy-copy">
          <small>Need more in the prayer bank?</small>
          <strong>Buy More Chips</strong>
          <em>$1 per chip</em>
        </span>
        <span className="member-buy-arrow"><ArrowRight size={28} /></span>
      </a>

      <section className="admin-orders">
        {loading && !orders.length ? <div className="admin-empty">Loading your prayer ledger...</div> : orders.length === 0 ? (
          <div className="admin-empty">No purchases are attached to this account yet. If you just paid, hit Refresh in a moment.</div>
        ) : orders.map((order) => {
          const handled = Math.min(order.quantity, Math.max(0, order.fulfilled_quantity || 0))
          const remaining = order.kind === 'chip' ? Math.max(order.quantity - handled, 0) : 0
          return (
            <article className="admin-order member-order" key={order.id}>
              <div className="admin-order-top">
                <div>
                  <span className={`admin-kind ${order.kind}`}>{order.kind === 'chip' ? 'Prayer chip' : 'Pray for Ivan'}</span>
                  <h2>{order.kind === 'chip' ? (order.prayer_request || 'Prayer requested') : 'Prayer for Ivan'}</h2>
                  <span className="member-order-date">{when(order.stripe_created_at || order.created_at)}</span>
                </div>
                <div className="admin-order-money"><strong>{money(order.amount_total, order.currency)}</strong><span>{order.quantity} purchased</span></div>
              </div>

              <div className="admin-order-grid">
                <div><span>Purchased</span><strong>{order.quantity}</strong></div>
                <div><span>Prayed</span><strong>{order.kind === 'chip' ? handled : 'N/A'}</strong></div>
                <div><span>Left</span><strong>{order.kind === 'chip' ? remaining : 'N/A'}</strong></div>
                <div><span>Status</span><strong className={`status-${order.status}`}>{order.kind === 'pray' ? 'sent to Ivan' : order.status.replace('_', ' ')}</strong></div>
              </div>

              {order.kind === 'chip' && (
                <div className="member-progress-wrap">
                  <div className="member-progress-copy"><span>Prayer progress</span><strong>{handled} of {order.quantity}</strong></div>
                  <div className="member-progress"><i style={{ width: `${order.quantity ? Math.round((handled / order.quantity) * 100) : 0}%` }} /></div>
                  {order.prayed_at && remaining === 0 && <small>Completed {when(order.prayed_at)}</small>}
                </div>
              )}
            </article>
          )
        })}
      </section>

      {isJesusAdmin && (
        <section className="member-admin-access">
          <div className="member-admin-banner">
            <div>
              <p className="eyebrow">ADMIN ACCESS</p>
              <h2>Jesus Admin</h2>
              <p>You are signed in as Ivan, so the full prayer desk is available below.</p>
            </div>
            <a href="/jesus-admin"><ShieldCheck size={16} /> Open admin only</a>
          </div>
          <div className="member-admin-embedded">
            <JesusAdmin />
          </div>
        </section>
      )}
    </main>
  )
}

function StatCard({ icon, label, value, emphasis = false }: { icon: ReactNode; label: string; value: ReactNode; emphasis?: boolean }) {
  return <article className={`admin-stat ${emphasis ? 'emphasis' : ''}`}><div>{icon}<span>{label}</span></div><strong>{value}</strong></article>
}
