import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchOrCreateProfile, updateProfile } from '../api/profiles'
import type { Profile } from '../types/trip'

export function useProfile(session: Session | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchOrCreateProfile(session.user.id)
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load profile.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  async function save(input: { displayName: string; avatarColor: string }) {
    if (!session) return null
    setError(null)
    const next = await updateProfile(session.user.id, input)
    setProfile(next)
    return next
  }

  return { profile, loading, error, save }
}
