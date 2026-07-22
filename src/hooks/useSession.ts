import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../api/supabaseClient'

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        if (!cancelled) {
          setSession(data.session)
          setLoading(false)
        }
        return
      }

      const { data: signInData, error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('Anonymous sign-in failed:', error.message)
      }
      if (!cancelled) {
        setSession(signInData.session ?? null)
        setLoading(false)
      }
    }

    ensureSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
