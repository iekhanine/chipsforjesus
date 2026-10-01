import { useMemo, useState } from 'react'
import JesusAdmin from './JesusAdmin'
import Members from './Members'
import { CreateAccountPage, ForgotPasswordPage, LoginPage, ResetPasswordPage } from './AuthPages'
import { supabase } from './lib/supabase'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Church,
  Coins,
  HeartHandshake,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

type PurchaseKind = 'chip' | 'pray'

type Page = 'home' | 'how' | 'fine-print' | 'admin' | 'login' | 'create-account' | 'members' | 'forgot-password' | 'reset-password'

const clamp = (value: number) => Math.max(1, Math.min(50, value))

function currentPage(): Page {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
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
        : page === 'admin' ? <JesusAdmin />
        : page === 'login' ? <LoginPage />
        : page === 'create-account' ? <CreateAccountPage />
        : page === 'members' ? <Members />
        : page === 'forgot-password' ? <ForgotPasswordPage />
        : page === 'reset-password' ? <ResetPasswordPage />
        : <HomePage />}
      <Footer />
    </div>
  )
}

function Header({ page }: { page: Page }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Chips for Jesus home">
        <span className="brand-mark"><Coins size={21} /></span>
        <span>Chips for Jesus</span>
      </a>
      <nav aria-label="Primary navigation">
        {page === 'admin' ? (
          <a href="/">Back to site</a>
        ) : (
          <>
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
          prayerRequest: kind === 'chip' ? prayerRequest : undefined,
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

      <section className="offers offers-first" aria-label="Prayer options">
        <article className="offer-card featured">
          <div className="offer-icon"><Sparkles size={24} /></div>
          <p className="eyebrow">OPTION ONE</p>
          <h2>Buy a Prayer Chip</h2>
          <p className="offer-copy">
            You buy a chip. You can tell me what is going on, or leave it blank. I will take the request seriously and say a prayer for you.
          </p>

          <label className="field-label" htmlFor="prayer-request">What should I pray about? <span>Optional</span></label>
          <textarea
            id="prayer-request"
            maxLength={450}
            value={prayerRequest}
            onChange={(event) => setPrayerRequest(event.target.value)}
            placeholder="Job interview, family, health, your fantasy football team..."
          />
          <div className="field-meta">{prayerRequest.length}/450</div>

          <QuantityControl value={chipQty} onChange={setChipQty} label="chips" />
          <button className="primary-button" disabled={loading !== null} onClick={() => checkout('chip')}>
            {loading === 'chip' ? 'Opening Stripe...' : `Buy ${chipQty} ${chipQty === 1 ? 'chip' : 'chips'} for $${chipQty}`}
            <ArrowRight size={17} />
          </button>
        </article>

        <article className="offer-card dark-card">
          <div className="offer-icon"><HeartHandshake size={24} /></div>
          <p className="eyebrow">OPTION TWO</p>
          <h2>Pray for Ivan</h2>
          <p className="offer-copy">
            Think I need more help than you do? Fair. Spend a dollar and put the prayer back on me.
          </p>

          <blockquote>
            “Maybe enough of you will eventually get through to somebody.”
          </blockquote>

          <QuantityControl value={prayQty} onChange={setPrayQty} label="prayers" dark />
          <button className="secondary-button" disabled={loading !== null} onClick={() => checkout('pray')}>
            {loading === 'pray' ? 'Opening Stripe...' : `Pray for Ivan ${prayQty}× for $${prayQty}`}
            <ArrowRight size={17} />
          </button>
        </article>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="hero middle-hero">
        <div className="hero-copy">
          <p className="eyebrow">A VERY SMALL RELIGIOUS TRANSACTION</p>
          <h1>Buy a chip.<br /><em>Get a prayer.</em></h1>
          <p className="lede">
            One dollar buys one prayer chip. Tell me what you want me to pray about and I will genuinely take a moment to pray for you.
          </p>
          <div className="hero-note">
            <ShieldCheck size={18} />
            <span>Not a church. Not a charity. Just a very small internet transaction involving prayer.</span>
          </div>
        </div>

        <div className="hero-card">
          <span className="hero-card-label">CURRENT THEOLOGICAL STATUS</span>
          <div className="status-row"><span>Prayer requests accepted</span><strong>YES</strong></div>
          <div className="status-row"><span>Price per chip</span><strong>$1</strong></div>
          <div className="status-row"><span>Official divine affiliation</span><strong>NONE</strong></div>
          <p>Results may vary. Eternity remains outside our service-level agreement.</p>
        </div>
      </section>

      <section className="manifesto">
        <Church size={30} />
        <div>
          <p className="eyebrow">THE WEIRDLY SINCERE PART</p>
          <h2>If you need a prayer, I will pray for you.</h2>
          <p>
            If something matters enough that you want another person to stop what they are doing and spend a minute thinking about you, I can do that. You do not need to prove anything, explain your beliefs, or make the request funny.
          </p>
        </div>
      </section>
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
          The site is intentionally ridiculous. The prayer requests are not. Here is exactly what happens when you buy a chip or decide Ivan needs the prayer more than you do.
        </p>
      </section>

      <section className="steps page-steps">
        <div><span>01</span><h3>Pick a side</h3><p>Buy a prayer chip for yourself or someone else, or spend the dollar praying for Ivan.</p></div>
        <div><span>02</span><h3>Pay one dollar</h3><p>Checkout is handled securely by Stripe. You can buy more than one chip if you are feeling ambitious.</p></div>
        <div><span>03</span><h3>The prayer happens</h3><p>If you submit a prayer request, Ivan reads it and takes a sincere moment to pray for what you asked about.</p></div>
      </section>

      <section className="content-card">
        <p className="eyebrow">WHAT A CHIP IS</p>
        <h2>It is not a physical poker chip in the mail.</h2>
        <p>
          A Prayer Chip is a $1 novelty service. Buying one represents one prayer request. You can leave the request blank, write something serious, or keep it light. Nothing needs to be public.
        </p>
      </section>

      <section className="content-card dark-content-card">
        <p className="eyebrow">THE OTHER DIRECTION</p>
        <h2>What does “Pray for Ivan” mean?</h2>
        <p>
          It means exactly what it sounds like. You spend a dollar, and the prayer is yours to make for Ivan. There is no claim that buying a prayer makes it stronger, faster, or more likely to receive divine technical support.
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
          <p>Chips for Jesus is an independent novelty project operated by Ivan Khanine.</p>
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
      <span className="footer-links"><a href="/how-it-works">How it works</a><a href="/fine-print">Fine print</a><a href="/members">My chips</a></span>
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
