import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Archive,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  LogIn,
  LogOut,
  RefreshCcw,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react'
import { supabase } from './lib/supabase'

type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'archived'
type OrderKind = 'chip' | 'pray'

type PrayerOrder = {
  id: string
  stripe_session_id: string
  stripe_payment_intent: string | null
  customer_email: string | null
  customer_name: string | null
  kind: OrderKind
  quantity: number
  amount_total: number
  currency: string
  prayer_request: string | null
  payment_status: string | null
  fulfilled_quantity: number
  status: OrderStatus
  prayed_at: string | null
  admin_notes: string | null
  last_updated_by: string | null
  stripe_created_at: string | null
  created_at: string
  updated_at: string
}

type Summary = {
  orders: number
  revenueCents: number
  prayerChips: number
  pendingPrayers: number
  prayersForIvan: number
  customers: number
}

const emptySummary: Summary = {
  orders: 0,
  revenueCents: 0,
  prayerChips: 0,
  pendingPrayers: 0,
  prayersForIvan: 0,
  customers: 0,
}

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: `Server returned an invalid response (${response.status}).` }
  }
}

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function when(value: string | null) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function JesusAdmin() {
  const [session, setSession] = useState<Session | null>(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const [orders, setOrders] = useState<PrayerOrder[]>([])
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [adminEmail, setAdminEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | OrderKind>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | OrderStatus>('active')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [workingId, setWorkingId] = useState('')

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.access_token) loadOrders(session.access_token)
  }, [session?.access_token])

  async function signInWithGoogle() {
    if (!supabase) return
    setError('')
    setDenied(false)
    setLoginBusy(true)

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/jesus-admin`,
      },
    })

    if (authError) {
      setLoginBusy(false)
      setError(authError.message)
    }
  }

  async function loadOrders(token = session?.access_token) {
    if (!token) return
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/prayers', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await readJson(response)
      if (response.status === 403) setDenied(true)
      if (!response.ok) throw new Error(data.error || 'Could not load prayer orders.')

      const nextOrders = (data.orders || []) as PrayerOrder[]
      setOrders(nextOrders)
      setSummary(data.summary || emptySummary)
      setAdminEmail(data.adminEmail || '')
      setNotes(Object.fromEntries(nextOrders.map((order) => [order.id, order.admin_notes || ''])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load prayer orders.')
    } finally {
      setLoading(false)
    }
  }

  async function syncStripe() {
    if (!session?.access_token) return
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/sync-stripe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || 'Could not sync Stripe.')
      await loadOrders(session.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync Stripe.')
    } finally {
      setLoading(false)
    }
  }

  async function updateOrder(id: string, action: string, extra?: { notes?: string }) {
    if (!session?.access_token) return
    setWorkingId(id)
    setError('')

    try {
      const response = await fetch('/api/admin/update-prayer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, action, ...extra }),
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || 'Could not update prayer.')

      setOrders((current) => current.map((order) => order.id === id ? data.order : order))
      await loadOrders(session.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update prayer.')
    } finally {
      setWorkingId('')
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return orders.filter((order) => {
      if (kindFilter !== 'all' && order.kind !== kindFilter) return false
      if (statusFilter === 'active' && order.status === 'archived') return false
      if (statusFilter !== 'active' && statusFilter !== 'all' && order.status !== statusFilter) return false
      if (!needle) return true

      return [
        order.customer_email,
        order.customer_name,
        order.prayer_request,
        order.stripe_session_id,
      ].some((value) => value?.toLowerCase().includes(needle))
    })
  }, [orders, query, kindFilter, statusFilter])

  if (!supabase) {
    return (
      <main className="admin-page">
        <section className="admin-login-card">
          <p className="eyebrow">JESUS ADMIN</p>
          <h1>Supabase is not configured.</h1>
          <p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to this project.</p>
        </section>
      </main>
    )
  }

  if (!session || denied) {
    return (
      <main className="admin-page">
        <section className="admin-login-card">
          <div className="admin-seal">J</div>
          <p className="eyebrow">JESUS ADMIN</p>
          <h1>{denied ? 'Wrong Google account.' : 'Enter the back office.'}</h1>
          <p>
            {denied
              ? `${session?.user.email || 'This account'} is signed in, but it is not on the Jesus Admin allowlist.`
              : 'Sign in with the Google account approved for Jesus Admin.'}
          </p>

          {denied ? (
            <button
              className="primary-button"
              onClick={async () => {
                await supabase?.auth.signOut()
                setDenied(false)
                setError('')
              }}
            >
              <LogOut size={17} /> Sign out and use another Google account
            </button>
          ) : (
            <button className="primary-button" disabled={loginBusy} onClick={signInWithGoogle}>
              <LogIn size={17} /> {loginBusy ? 'Opening Google...' : 'Continue with Google'}
            </button>
          )}

          {error && <div className="error-box admin-error">{error}</div>}
        </section>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <section className="admin-heading">
        <div>
          <p className="eyebrow">JESUS ADMIN</p>
          <h1>Prayer desk.</h1>
          <p>See what was purchased, who bought it, what they asked for, and what still needs your attention.</p>
        </div>
        <div className="admin-heading-actions">
          <span>{adminEmail || session.user.email}</span>
          <button onClick={syncStripe} disabled={loading}><CircleDollarSign size={15} /> Sync Stripe</button>
          <button onClick={() => loadOrders()} disabled={loading}><RefreshCcw size={15} /> Refresh</button>
          <button onClick={() => supabase?.auth.signOut()}><LogOut size={15} /> Sign out</button>
        </div>
      </section>

      {error && <div className="error-box admin-error">{error}</div>}

      <section className="admin-stats">
        <StatCard icon={<ClipboardList size={20} />} label="Orders" value={summary.orders} />
        <StatCard icon={<CheckCircle2 size={20} />} label="Prayers waiting" value={summary.pendingPrayers} emphasis />
        <StatCard icon={<Users size={20} />} label="People" value={summary.customers} />
        <StatCard icon={<CircleDollarSign size={20} />} label="Gross collected" value={money(summary.revenueCents)} />
      </section>

      <section className="admin-substats">
        <span><strong>{summary.prayerChips}</strong> prayer chips purchased</span>
        <span><strong>{summary.prayersForIvan}</strong> prayers purchased for Ivan</span>
      </section>

      <section className="admin-toolbar">
        <label className="admin-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email, prayer, Stripe session..." />
        </label>
        <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}>
          <option value="all">All types</option>
          <option value="chip">Prayer chips</option>
          <option value="pray">Pray for Ivan</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
          <option value="active">Active</option>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </section>

      <section className="admin-orders">
        {loading && !orders.length ? (
          <div className="admin-empty">Loading the prayer desk...</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">Nothing matches those filters.</div>
        ) : (
          filtered.map((order) => (
            <article className={`admin-order ${order.status === 'archived' ? 'is-archived' : ''}`} key={order.id}>
              <div className="admin-order-top">
                <div>
                  <span className={`admin-kind ${order.kind}`}>{order.kind === 'chip' ? 'Prayer chip' : 'Pray for Ivan'}</span>
                  <h2>{order.customer_name || 'Stripe customer'}</h2>
                  {order.customer_email && <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>}
                </div>
                <div className="admin-order-money">
                  <strong>{money(order.amount_total, order.currency)}</strong>
                  <span>{when(order.stripe_created_at || order.created_at)}</span>
                </div>
              </div>

              <div className="admin-order-grid">
                <div>
                  <span>Quantity</span>
                  <strong>{order.quantity}</strong>
                </div>
                <div>
                  <span>Handled</span>
                  <strong>{order.kind === 'chip' ? `${order.fulfilled_quantity}/${order.quantity}` : 'N/A'}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong className={`status-${order.status}`}>{order.status.replace('_', ' ')}</strong>
                </div>
                <div>
                  <span>Payment</span>
                  <strong>{order.payment_status || 'unknown'}</strong>
                </div>
              </div>

              {order.kind === 'chip' && (
                <div className="admin-prayer-text">
                  <span>Prayer request</span>
                  <p>{order.prayer_request || 'No written request. Just pray for them.'}</p>
                </div>
              )}

              {order.kind === 'pray' && (
                <div className="admin-prayer-text ivan-prayer">
                  <span>Prayer direction</span>
                  <p>This customer purchased {order.quantity === 1 ? 'a prayer' : `${order.quantity} prayers`} for Ivan.</p>
                </div>
              )}

              <div className="admin-notes">
                <label htmlFor={`notes-${order.id}`}>Private admin notes</label>
                <textarea
                  id={`notes-${order.id}`}
                  value={notes[order.id] ?? ''}
                  onChange={(event) => setNotes((current) => ({ ...current, [order.id]: event.target.value }))}
                  placeholder="Anything you want to remember about this one..."
                />
                <button
                  className="admin-small-button"
                  disabled={workingId === order.id}
                  onClick={() => updateOrder(order.id, 'notes', { notes: notes[order.id] || '' })}
                >Save notes</button>
              </div>

              <div className="admin-order-actions">
                {order.kind === 'chip' && order.status !== 'archived' && order.fulfilled_quantity < order.quantity && (
                  <button disabled={workingId === order.id} onClick={() => updateOrder(order.id, 'increment')}>
                    <Check size={15} /> Mark one prayed
                  </button>
                )}
                {order.kind === 'chip' && order.status !== 'archived' && order.fulfilled_quantity < order.quantity && (
                  <button disabled={workingId === order.id} onClick={() => updateOrder(order.id, 'complete')}>
                    <CheckCircle2 size={15} /> Complete all
                  </button>
                )}
                {order.kind === 'chip' && order.fulfilled_quantity > 0 && order.status !== 'archived' && (
                  <button disabled={workingId === order.id} onClick={() => updateOrder(order.id, 'reopen')}>
                    <RotateCcw size={15} /> Reset
                  </button>
                )}
                {order.status === 'archived' ? (
                  <button disabled={workingId === order.id} onClick={() => updateOrder(order.id, 'restore')}>
                    <RotateCcw size={15} /> Restore
                  </button>
                ) : (
                  <button disabled={workingId === order.id} onClick={() => updateOrder(order.id, 'archive')}>
                    <Archive size={15} /> Archive
                  </button>
                )}
              </div>

              <details className="admin-stripe-details">
                <summary>Stripe details</summary>
                <code>{order.stripe_session_id}</code>
                {order.stripe_payment_intent && <code>{order.stripe_payment_intent}</code>}
              </details>
            </article>
          ))
        )}
      </section>
    </main>
  )
}

function StatCard({ icon, label, value, emphasis = false }: { icon: ReactNode; label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <article className={`admin-stat ${emphasis ? 'emphasis' : ''}`}>
      <div>{icon}<span>{label}</span></div>
      <strong>{value}</strong>
    </article>
  )
}
