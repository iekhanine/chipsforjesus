import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, Check, KeyRound, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import { supabase } from './lib/supabase'

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: `Server returned an invalid response (${response.status}).` }
  }
}

function rememberCheckout(sessionId: string, email: string) {
  window.localStorage.setItem('c4j_pending_checkout', sessionId)
  window.localStorage.setItem('c4j_pending_checkout_email', email.toLowerCase())
}

async function googleSignIn(redirectPath: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${redirectPath}` },
  })
  if (error) throw error
}

function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <main className="auth-page">
      <a className="back-link" href="/"><ArrowLeft size={15} /> Back to the chips</a>
      <section className="auth-card">
        <div className="admin-seal">J</div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  )
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace('/members')
    })
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (signInError) return setError(signInError.message)
    window.location.assign('/members')
  }

  async function google() {
    setBusy(true)
    setError('')
    try {
      await googleSignIn('/members')
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Could not open Google sign-in.')
    }
  }

  if (!supabase) return <MissingSupabase />

  return (
    <AuthShell eyebrow="MEMBER LOGIN" title="Welcome back.">
      <p className="auth-lede">See your chips, prayer progress, and purchase history.</p>
      <button className="google-button" disabled={busy} onClick={google}><LogIn size={17} /> Continue with Google</button>
      <div className="auth-divider"><span>or</span></div>
      <form className="auth-form" onSubmit={submit}>
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="primary-button" disabled={busy}><LogIn size={17} /> {busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <div className="auth-links"><a href="/forgot-password">Forgot password?</a><a href="/">Need chips first?</a></div>
      {error && <div className="error-box auth-error">{error}</div>}
    </AuthShell>
  )
}

export function CreateAccountPage() {
  const sessionId = useMemo(() => new URLSearchParams(window.location.search).get('session_id') || '', [])
  const [purchase, setPurchase] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let live = true
    async function load() {
      if (!sessionId) {
        setError('No completed Stripe purchase was supplied.')
        setLoading(false)
        return
      }
      try {
        const response = await fetch(`/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`)
        const data = await readJson(response)
        if (!response.ok) throw new Error(data.error || 'Could not verify the purchase.')
        if (!live) return
        setPurchase(data)
        rememberCheckout(sessionId, data.email)

        if (supabase) {
          const { data: authData } = await supabase.auth.getSession()
          const signedInEmail = authData.session?.user.email?.toLowerCase()
          if (signedInEmail && signedInEmail === data.email.toLowerCase()) {
            window.location.replace('/members')
            return
          }
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : 'Could not verify the purchase.')
      } finally {
        if (live) setLoading(false)
      }
    }
    load()
    return () => { live = false }
  }, [sessionId])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !purchase) return
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    if (password !== confirm) return setError('The passwords do not match.')

    setBusy(true)
    setError('')
    setMessage('')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: purchase.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/members`,
        data: purchase.name ? { full_name: purchase.name } : undefined,
      },
    })
    setBusy(false)

    if (signUpError) return setError(signUpError.message)
    if (data.session) {
      window.location.assign('/members')
      return
    }
    setMessage('Account created. Check your email to confirm it, then you will land on My Chips.')
  }

  async function google() {
    if (!purchase) return
    setBusy(true)
    setError('')
    rememberCheckout(sessionId, purchase.email)
    try {
      await googleSignIn('/members')
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Could not open Google sign-in.')
    }
  }

  if (!supabase) return <MissingSupabase />

  return (
    <AuthShell eyebrow="PAYMENT RECEIVED" title="Your chip is in. Now claim it.">
      {loading ? <div className="admin-empty">Verifying your Stripe purchase...</div> : error && !purchase ? (
        <><div className="error-box auth-error">{error}</div><a className="primary-link-button" href="/">Back to Chips for Jesus</a></>
      ) : purchase ? (
        <>
          <div className="purchase-confirmation"><Check size={18} /><div><strong>{purchase.quantity} {purchase.kind === 'chip' ? (purchase.quantity === 1 ? 'chip' : 'chips') : (purchase.quantity === 1 ? 'prayer' : 'prayers')} purchased</strong><span>{purchase.email}</span></div></div>
          <p className="auth-lede">Create an account with the same email Stripe used. Your purchase history will attach automatically.</p>
          <button className="google-button" disabled={busy} onClick={google}><LogIn size={17} /> Continue with Google</button>
          <div className="auth-divider"><span>or create a password</span></div>
          <form className="auth-form" onSubmit={create}>
            <label>Email<input value={purchase.email} disabled /></label>
            <label>Password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label>Confirm password<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
            <button className="primary-button" disabled={busy}><UserPlus size={17} /> {busy ? 'Creating account...' : 'Create my account'}</button>
          </form>
          <div className="auth-links"><a href="/login">Already have an account? Sign in</a></div>
          {message && <div className="admin-login-sent"><Check size={18} /> {message}</div>}
          {error && <div className="error-box auth-error">{error}</div>}
        </>
      ) : null}
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (resetError) return setError(resetError.message)
    setSent(true)
  }

  if (!supabase) return <MissingSupabase />

  return (
    <AuthShell eyebrow="PASSWORD RESET" title="Forgot your password?">
      <p className="auth-lede">Enter the email on your Chips for Jesus account. We will send a secure reset link.</p>
      {sent ? <div className="admin-login-sent"><Check size={18} /> If an account exists for that email, a reset link is on the way.</div> : (
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="primary-button" disabled={busy}><KeyRound size={17} /> {busy ? 'Sending...' : 'Send reset link'}</button>
        </form>
      )}
      <div className="auth-links"><a href="/login">Back to login</a></div>
      {error && <div className="error-box auth-error">{error}</div>}
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)))
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    if (password !== confirm) return setError('The passwords do not match.')
    setBusy(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) return setError(updateError.message)
    window.location.assign('/members')
  }

  if (!supabase) return <MissingSupabase />

  return (
    <AuthShell eyebrow="PASSWORD RESET" title="Choose a new password.">
      {!ready ? <div className="admin-empty">Opening your secure reset session...</div> : (
        <form className="auth-form" onSubmit={submit}>
          <label>New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label>Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <button className="primary-button" disabled={busy}><ShieldCheck size={17} /> {busy ? 'Updating...' : 'Update password'}</button>
        </form>
      )}
      {error && <div className="error-box auth-error">{error}</div>}
    </AuthShell>
  )
}

function MissingSupabase() {
  return (
    <main className="auth-page">
      <section className="auth-card"><p className="eyebrow">ACCOUNT</p><h1>Supabase is not configured.</h1><p className="auth-lede">Add the existing OneTime Labs Supabase public URL and key to this project.</p></section>
    </main>
  )
}
