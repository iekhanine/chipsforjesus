import { useEffect, useMemo, useState } from 'react'
import JesusAdmin from './JesusAdmin'
import Members from './Members'
import { CreateAccountPage, ForgotPasswordPage, LoginPage, ResetPasswordPage } from './AuthPages'
import { supabase } from './lib/supabase'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HeartHandshake,
  Minus,
  Plus,
  Sparkles,
} from 'lucide-react'

type PurchaseKind = 'chip' | 'pray'

type Page = 'home' | 'prayers' | 'how' | 'fine-print' | 'admin' | 'login' | 'create-account' | 'members' | 'forgot-password' | 'reset-password'

const clamp = (value: number) => Math.max(1, Math.min(50, value))

function currentPage(): Page {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/prayers') return 'prayers'
  if (path === '/how-it-works') return 'how'
  if (path === '/fine-print') return 'fine-print'
  if (path === '/jesus-admin') return 'admin'
  if (path === '/login') return 'login'
  if (path === '/create-account') return 'create-account'
  if (path === '/members') return 'members'
  if (path === '/forgot-password') return 'forgot-password'
  if (path === '/reset-password') return 'reset-password'
  return 'home'
}

export default function App() {
  const page = currentPage()

  return (
    <div className="site-shell">
      <Header page={page} />
      {page === 'how' ? <HowItWorksPage />
        : page === 'fine-print' ? <FinePrintPage />
        : page === 'prayers' ? <PrayersPage />
        : page === 'admin' ? <JesusAdmin />
        : page === 'login' ? <LoginPage />
        : page === 'create-account' ? <CreateAccountPage />
        : page === 'members' ? <Members />
        : page === 'forgot-password' ? <ForgotPasswordPage />
        : page === 'reset-password' ? <ResetPasswordPage />
        : <HomePage />}
      {page !== 'home' && <Footer />}
    </div>
  )
}

function Header({ page }: { page: Page }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Chips for Jesus home">
        <span className="brand-mark"><img src="/chips-for-jesus-logo.webp" alt="" /></span>
        <span>Chips for Jesus</span>
      </a>
      <nav aria-label="Primary navigation">
        {page === 'admin' ? (
          <a href="/">Back to site</a>
        ) : (
          <>
            <a className={page === 'prayers' ? 'active' : ''} href="/prayers">Prayer wall</a>
            <a className={page === 'how' ? 'active' : ''} href="/how-it-works">How it works</a>
            <a className={page === 'fine-print' ? 'active' : ''} href="/fine-print">Fine print</a>
            <a className={page === 'members' || page === 'login' ? 'active' : ''} href="/members">My chips</a>
          </>
        )}
      </nav>
    </header>
  )
}

function HomePage() {
  const [chipQty, setChipQty] = useState(1)
  const [prayQty, setPrayQty] = useState(1)
  const [prayerRequest, setPrayerRequest] = useState('')
  const [ivanPrayer, setIvanPrayer] = useState('')
  const [chipPublic, setChipPublic] = useState(false)
  const [ivanPublic, setIvanPublic] = useState(false)
  const [loading, setLoading] = useState<PurchaseKind | null>(null)
  const [error, setError] = useState('')

  const status = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('checkout')
  }, [])

  async function checkout(kind: PurchaseKind) {
    setError('')
    setLoading(kind)

    try {
      const authSession = supabase ? (await supabase.auth.getSession()).data.session : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authSession?.access_token) headers.Authorization = `Bearer ${authSession.access_token}`

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          kind,
          quantity: kind === 'chip' ? chipQty : prayQty,
          prayerRequest: kind === 'chip' ? prayerRequest : ivanPrayer,
          publicRequested: kind === 'chip' ? chipPublic : ivanPublic,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout.')
      }

      window.location.assign(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.')
      setLoading(null)
    }
  }

  return (
    <main id="top">
      {status === 'success' && (
        <div className="notice success"><Check size={18} /> Payment received. Your chip is officially in the system.</div>
      )}
      {status === 'cancelled' && (
        <div className="notice">Checkout cancelled. No theological paperwork was filed.</div>
      )}

      <section className="wall-preview"><div className="section-heading"><span>PRAYERS FROM THE PEWS</span><h2>The prayer wall</h2></div><PrayerWall preview /><a className="welcome-cta" href="/prayers">READ ALL PRAYERS <ArrowRight size={19}/></a></section>

      <div className="purchase-spotlight">
        <div className="purchase-spotlight-top"><Sparkles size={18} /><span>TWO WAYS TO SPREAD THE GOOD WORD · ONE DOLLAR EACH</span><Sparkles size={18} /></div>
      <div className="section-heading" id="prayer-options"><span>THE MAIN EVENT · JUST $1</span><h2>Who needs a prayer?</h2><p>Choose a side. Write something if you like. The prayer is real, even if the website is ridiculous.</p></div>

      <section className="offers offers-first" aria-label="Prayer options">
        <article className="offer-card featured">
          <div className="offer-heading">
          <div className="offer-icon"><Sparkles size={24} /></div>
          <p className="eyebrow">OPTION ONE</p>
          <h2>Prayer for You</h2>
          </div>
          <p className="offer-copy">
            You buy a chip. You can tell me what is going on, or leave it blank. I will take the request seriously and say a prayer for you.
          </p>

          <div className="offer-layout">
          <div className="offer-message">
          <label className="field-label" htmlFor="prayer-request">What should I pray about? <span>Optional</span></label>
          <textarea
            id="prayer-request"
            maxLength={450}
            value={prayerRequest}
            onChange={(event) => setPrayerRequest(event.target.value)}
            placeholder="Job interview, family, health, your fantasy football team..."
          />
          <div className="field-meta">{prayerRequest.length}/450</div>

          </div>
          <div className="offer-actions">
          <label className="wall-consent"><input type="checkbox" checked={chipPublic} onChange={e => setChipPublic(e.target.checked)} /> I would like this prayer considered for the public prayer wall. Only Ivan can approve it; no personal details will be displayed.</label>
          <QuantityControl value={chipQty} onChange={setChipQty} label="chips" />
          <button className="primary-button" disabled={loading !== null} onClick={() => checkout('chip')}>
            {loading === 'chip' ? 'Opening Stripe...' : `Buy ${chipQty} ${chipQty === 1 ? 'chip' : 'chips'} for $${chipQty}`}
            <ArrowRight size={17} />
          </button>
          </div>
          </div>
        </article>

        <article className="offer-card dark-card">
          <div className="offer-heading">
          <div className="offer-icon"><HeartHandshake size={24} /></div>
          <p className="eyebrow">OPTION TWO</p>
          <h2>Prayer for Me</h2>
          </div>
          <p className="offer-copy">
            Think I need more help than you do? Fair. Spend a dollar and put the prayer back on me.
          </p>


          <div className="offer-layout">
          <div className="offer-message">
          <label className="field-label" htmlFor="ivan-prayer">Your prayer for me <span>Optional</span></label>
          <textarea id="ivan-prayer" maxLength={450} value={ivanPrayer} onChange={e => setIvanPrayer(e.target.value)} placeholder="Dear Lord, please help this man find the good chips..." />
          <div className="field-meta">{ivanPrayer.length}/450</div>
          </div>
          <div className="offer-actions">
          <label className="wall-consent wall-consent-dark"><input type="checkbox" checked={ivanPublic} onChange={e => setIvanPublic(e.target.checked)} /> Consider sharing my prayer on the public wall (after Ivan approves).</label>
          <QuantityControl value={prayQty} onChange={setPrayQty} label="prayers" dark />
          <button className="secondary-button" disabled={loading !== null} onClick={() => checkout('pray')}>
            {loading === 'pray' ? 'Opening Stripe...' : `Prayer for Me ${prayQty}× for $${prayQty}`}
            <ArrowRight size={17} />
          </button>
          </div>
          </div>
        </article>
      </section>

      </div>
      <section className="cartoon-welcome" aria-label="Welcome to Chips for Jesus">
        <div className="cartoon-welcome-copy">
          <span className="welcome-sticker">✦ THE HOLIEST SNACK ON THE INTERNET ✦</span>
          <h1>A little faith.<br /><span>A lot of crunch.</span></h1>
          <p>One dollar. One prayer chip. A ridiculous website with a sincere promise: if you ask for a prayer, you'll get one.</p>
          <a className="welcome-cta" href="#prayer-options">SEE THE $1 PRAYER OPTIONS <ArrowRight size={20} /></a>
          <span className="welcome-aside">No casinos. No jackpots. Just Jesus, chips &amp; good intentions.</span>
        </div>
        <div className="cartoon-welcome-art">
          <div className="art-rays" aria-hidden="true">✳</div>
          <img src="/chips-for-jesus-logo.webp" alt="Cartoon Jesus smiling and offering a potato chip with the Chips for Jesus logo" />
          <span className="art-sticker">100% GOOD VIBES*</span>
        </div>
      </section>
      {error && <div className="error-box">{error}</div>}
    </main>
  )
}

function HowItWorksPage() {
  return (
    <main className="content-page">
      <a className="back-link" href="/"><ArrowLeft size={15} /> Back to the chips</a>
      <section className="page-hero">
        <p className="eyebrow">HOW THIS WORKS</p>
        <h1>One dollar.<br /><em>One very small act of faith.</em></h1>
        <p>
          The site is intentionally ridiculous. The prayer requests are not. Here is exactly what happens when you buy a chip or decide I need the prayer more than you do.
        </p>
      </section>

      <section className="steps page-steps">
        <div><span>01</span><h3>Pick a side</h3><p>Buy a prayer chip for yourself or someone else, or spend the dollar praying for me.</p></div>
        <div><span>02</span><h3>Pay one dollar</h3><p>Checkout is handled securely by Stripe. You can buy more than one chip if you are feeling ambitious.</p></div>
        <div><span>03</span><h3>The prayer happens</h3><p>If you submit a prayer request, Ivan reads it and takes a sincere moment to pray for what you asked about.</p></div>
      </section>

      <section className="content-card">
        <p className="eyebrow">WHAT A CHIP IS</p>
        <h2>It is a digital prayer chip, not a physical item in the mail.</h2>
        <p>
          A Prayer Chip is a $1 novelty service. Buying one represents one prayer request. You can leave the request blank, write something serious, or keep it light. Nothing needs to be public.
        </p>
      </section>

      <section className="content-card dark-content-card">
        <p className="eyebrow">THE OTHER DIRECTION</p>
        <h2>What does “Prayer for Me” mean?</h2>
        <p>
          It means exactly what it sounds like. You spend a dollar, and the prayer is yours to make for me. There is no claim that buying a prayer makes it stronger, faster, or more likely to receive divine technical support.
        </p>
      </section>
    </main>
  )
}

function FinePrintPage() {
  return (
    <main className="content-page">
      <a className="back-link" href="/"><ArrowLeft size={15} /> Back to the chips</a>
      <section className="page-hero compact-page-hero">
        <p className="eyebrow">FINE PRINT</p>
        <h1>No halos were harmed in the making of this website.</h1>
        <p>
          The short version: this is an independent novelty project, the money goes to Ivan, and a purchase is not a charitable donation.
        </p>
      </section>

      <section className="legal-grid">
        <article className="legal-card">
          <h2>Who operates this?</h2>
          <p>Chips for Jesus is an independent novelty project operated by some dude named Ivan.</p>
        </article>
        <article className="legal-card">
          <h2>Is this a charity?</h2>
          <p>No. It is not a church, ministry, nonprofit, charity, religious organization, or tax-exempt entity.</p>
        </article>
        <article className="legal-card">
          <h2>Are purchases tax deductible?</h2>
          <p>No. Payments are voluntary purchases of the novelty service described on the site and are not charitable contributions.</p>
        </article>
        <article className="legal-card">
          <h2>Where does the money go?</h2>
          <p>Payments are processed through Stripe and ultimately go to Ivan, subject to normal payment processing fees and obligations.</p>
        </article>
        <article className="legal-card">
          <h2>Is prayer guaranteed to do anything?</h2>
          <p>No outcome, spiritual or otherwise, is promised or guaranteed. Ivan promises only to treat sincere prayer requests sincerely.</p>
        </article>
        <article className="legal-card">
          <h2>Official religious affiliation?</h2>
          <p>None. No affiliation with Jesus, any church, denomination, ministry, or divine entity has been confirmed.</p>
        </article>
      </section>
    </main>
  )
}

function Footer() {
  return (
    <footer>
      <span>© {new Date().getFullYear()} Chips for Jesus</span>
      <span className="footer-links"><a href="/how-it-works">How it works</a><a href="/fine-print">Fine print</a><a href="/prayers">Prayer wall</a><a href="/members">My chips</a></span>
      <span>Built with unreasonable confidence and Stripe.</span>
    </footer>
  )
}

function QuantityControl({ value, onChange, label, dark = false }: { value: number; onChange: (n: number) => void; label: string; dark?: boolean }) {
  return (
    <div className={`quantity ${dark ? 'quantity-dark' : ''}`}>
      <div>
        <span>Quantity</span>
        <small>$1 each</small>
      </div>
      <div className="quantity-buttons">
        <button type="button" aria-label="Decrease quantity" onClick={() => onChange(clamp(value - 1))}><Minus size={15} /></button>
        <strong>{value}</strong>
        <button type="button" aria-label="Increase quantity" onClick={() => onChange(clamp(value + 1))}><Plus size={15} /></button>
      </div>
      <span className="quantity-label">{label}</span>
    </div>
  )
}


type WallPrayer = { id: string; prayer: string; response: string; category: string; sample?: boolean }

function PrayerWall({ preview = false }: { preview?: boolean }) {
  const [real, setReal] = useState<WallPrayer[]>([])
  useEffect(() => {
    let active = true
    async function loadPrayers() {
      // Vercel serves /api/* in production. Plain `vite` on localhost does not.
      // If it is unavailable, use the PUBLIC wall entries only via Supabase RLS.
      try {
        const response = await fetch('/api/public-prayers')
        if (!response.ok) throw new Error('Prayer API unavailable')
        const data = await response.json()
        if (Array.isArray(data.prayers) && data.prayers.length > 0) {
          if (active) setReal(data.prayers)
          return
        }
      } catch {
        // Local Vite or server API outage: try the public read-only table.
      }
      if (!supabase) return
      const { data, error } = await supabase
        .from('c4j_wall_entries')
        .select('id,prayer,response,category')
        .eq('visible', true)
        .order('id', { ascending: true })
        .limit(100)
      if (error) {
        console.warn('Unable to load public prayer wall:', error.message)
        return
      }
      if (active) setReal((data || []).map(item => ({
        id: `seed-${item.id}`,
        prayer: item.prayer,
        response: item.response,
        category: item.category || 'Community',
      })))
    }
    void loadPrayers()
    return () => { active = false }
  }, [])
  const all = real.filter(item => item && typeof item.prayer === 'string' && typeof item.response === 'string')
  if (all.length === 0) return <div className="prayer-wall-empty" role="status">The prayer wall is awaiting its first published prayer.</div>
  return preview ? <FadingPrayerPreview prayers={all} /> : <div className="prayer-grid" aria-label="Public prayer messages">
    {all.map(item => <PrayerCard key={item.id} item={item} />)}
  </div>
}
function PrayerCard({ item }: { item: WallPrayer | undefined }) {
  if (!item) return null
  return <article className="wall-card">
    <span className="wall-tag">{item.category}</span>
    <p className="wall-prayer">“{item.prayer}”</p>
    <div className="wall-reply"><strong>Ivan replies</strong><p>{item.response}</p></div>
  </article>
}
function FadingPrayerPreview({ prayers }: { prayers: WallPrayer[] }) {
  const [slots, setSlots] = useState([0, 1, 2])
  const [fadingSlot, setFadingSlot] = useState<number | null>(null)

  useEffect(() => {
    if (prayers.length <= 3 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Change one of the three cards each tick. Do NOT pause on hover:
    // the visitor's cursor may be sitting on the wall all the time.
    let slotToChange = 0
    let nextPrayer = 3
    let fadeTimeout: ReturnType<typeof setTimeout> | undefined
    const interval = window.setInterval(() => {
      const targetSlot = slotToChange
      slotToChange = (slotToChange + 1) % 3
      setFadingSlot(targetSlot)
      fadeTimeout = window.setTimeout(() => {
        setSlots(previous => previous.map((index, position) =>
          position === targetSlot ? (nextPrayer++ % prayers.length) : index
        ))
        setFadingSlot(null)
      }, 450)
    }, 3200)

    return () => {
      window.clearInterval(interval)
      if (fadeTimeout) window.clearTimeout(fadeTimeout)
    }
  }, [prayers.length])

  if (!prayers.length) return null
  return <div className="prayer-fade-grid" aria-label="Public prayer messages">
    {slots.slice(0, Math.min(3, prayers.length)).map((index, slot) => <div key={slot} className={`prayer-fade-slot ${fadingSlot === slot ? 'is-fading' : ''}`}>
      <PrayerCard item={prayers[index % prayers.length]} />
    </div>)}
  </div>
}
function PrayersPage() {
  return <main className="content-page prayers-page"><a className="back-link" href="/"><ArrowLeft size={15}/> Back to the chips</a><section className="page-hero"><p className="eyebrow">THE WALL OF PRAYERS</p><h1>Heaven has a comment section.</h1><p>Real prayers appear only with the submitter's permission and after Ivan approves them.</p></section><PrayerWall/><a className="welcome-cta" href="/#prayer-options">ADD YOUR PRAYER <ArrowRight size={18}/></a></main>
}


