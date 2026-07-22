import { useState } from 'react'
import { supabase } from '../api/supabaseClient'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-display text-5xl font-semibold tracking-tight text-text">
          ATLAS
        </p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
          Plan the route, not just the pins
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-3">
          <label htmlFor="email" className="block font-mono text-xs uppercase tracking-wide text-text-dim">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-text placeholder:text-text-dim focus:border-line-2 focus:outline-none focus:ring-2 focus:ring-line-2/40"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-md bg-paper px-4 py-3 font-medium text-ink transition-colors hover:bg-paper-dim disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending link…' : 'Send magic link'}
          </button>
        </form>

        {status === 'sent' && (
          <p className="mt-4 text-sm text-line-5">
            Check {email} for a sign-in link.
          </p>
        )}
        {status === 'error' && (
          <p className="mt-4 text-sm text-line-4">{errorMessage}</p>
        )}
      </div>
    </div>
  )
}
