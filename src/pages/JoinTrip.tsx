import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, UserRound } from 'lucide-react'
import { joinTripByToken } from '../api/groupTrips'
import { TopNav } from '../components/TopNav'
import { useSession } from '../hooks/useSession'
import { useProfile } from '../hooks/useProfile'
import { sanitizeName } from '../utils/textGuards'

const AVATAR_COLORS = ['#22dd85', '#f7ff88', '#5bd7f3', '#ff715b', '#bca5ed', '#fefefe']

export default function JoinTrip() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { profile, loading, save } = useProfile(session)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [avatarColor, setAvatarColor] = useState(profile?.avatarColor ?? AVATAR_COLORS[0])
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setDisplayName((current) => current || profile.displayName)
    setAvatarColor((current) => current || profile.avatarColor)
  }, [profile])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token) {
      setError('Invite link is missing a token.')
      return
    }
    if (!session) return

    setJoining(true)
    setError(null)
    try {
      await save({ displayName: sanitizeName(displayName, 48) || 'Traveler', avatarColor })
      const tripId = await joinTripByToken(token)
      navigate(`/trips/${tripId}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join this trip.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <TopNav />
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-8">
        <form onSubmit={handleSubmit} className="w-full rounded-lg border border-border bg-surface p-5">
          <div className="mb-5 text-center">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-green">Atlas invite</p>
            <h1 className="text-xl font-extrabold text-text">Join the group itinerary</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">
              Choose the name and color people will see on your votes. Atlas does not ask for contacts, phone numbers, or extra personal details.
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-text">Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 48))}
              className="min-h-11 w-full rounded-md border border-border bg-ink px-3 text-base font-semibold text-text placeholder:text-text-dim focus:border-paper focus:outline-none"
              placeholder={loading ? 'Loading...' : profile?.displayName ?? 'Traveler'}
            />
          </label>

          <div className="mt-4">
            <span className="mb-2 block text-xs font-bold text-text">Vote color</span>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className="flex h-10 items-center justify-center rounded-md border"
                  style={{ background: color, borderColor: avatarColor === color ? '#ffffff' : 'var(--color-border)' }}
                  aria-label={`Use ${color}`}
                >
                  {avatarColor === color && <Check size={14} color={color === '#f7ff88' || color === '#fefefe' ? '#070606' : '#ffffff'} />}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="mt-3 rounded-md border border-line-4/40 bg-line-4/10 px-3 py-2 text-sm font-semibold text-line-4">{error}</p>}

          <button
            type="submit"
            disabled={!session || joining}
            className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-paper px-4 text-sm font-extrabold text-ink hover:bg-paper-dim disabled:cursor-wait disabled:opacity-60"
          >
            <UserRound size={15} />
            {joining ? 'Joining...' : 'Join trip'}
          </button>
          <Link to="/" className="mt-3 block text-center text-xs font-bold text-text-dim hover:text-text">
            Back to trips
          </Link>
        </form>
      </main>
    </div>
  )
}
