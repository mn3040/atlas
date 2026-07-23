import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Settings, UserRound, X } from 'lucide-react'
import { useSession } from '../hooks/useSession'
import { useProfile } from '../hooks/useProfile'
import { TRAVEL_MODES } from '../utils/distance'
import type { TravelMode } from '../utils/distance'
import { getAppSettings, saveAppSettings } from '../utils/settings'
import type { AppSettings } from '../utils/settings'
import type { Profile } from '../types/trip'

const AVATAR_COLORS = ['#22dd85', '#f7ff88', '#5bd7f3', '#ff715b', '#bca5ed', '#fefefe']

export function TopNav() {
  const { session } = useSession()
  const { profile, loading: profileLoading, error: profileError, save: saveProfile } = useProfile(session)
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings())
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('atlas-compact', settings.compactTimeline)
  }, [settings.compactTimeline])

  function update(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveAppSettings(next)
  }

  return (
    <div className="atlas-topnav flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-7 sm:py-3.5">
      <Link to="/" className="flex items-center gap-2.5">
        <img src="/atlas-mark.svg" alt="Atlas" className="atlas-brand-mark h-8 w-8 rounded-lg" />
        <div>
          <span className="block text-[15px] font-extrabold tracking-[0.32em] text-text">ATLAS</span>
          <span className="hidden text-[9px] font-bold uppercase tracking-[0.24em] text-green sm:block">Plan your adventure</span>
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-text-dim sm:inline">Itinerary</span>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-text hover:border-green"
          aria-label="Open traveler profile"
          title="Traveler profile"
        >
          <Avatar profile={profile} loading={profileLoading} />
          <span className="hidden max-w-24 truncate text-xs font-bold sm:inline">
            {profile?.displayName ?? 'Traveler'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-dim hover:border-paper hover:text-paper"
          aria-label="Open itinerary settings"
          title="Itinerary settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {profileOpen && session && (
        <ProfileModal
          profile={profile}
          error={profileError}
          onClose={() => setProfileOpen(false)}
          onSave={async (input) => {
            await saveProfile(input)
            setProfileOpen(false)
          }}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-start sm:justify-end sm:p-4">
          <button className="absolute inset-0 cursor-default" aria-label="Close settings" onClick={() => setOpen(false)} />
          <section className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-paper">Itinerary settings</p>
                <h2 className="text-lg font-extrabold text-text">Workspace controls</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
                aria-label="Close settings"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-text">Default route mode</span>
                <select
                  value={settings.defaultTravelMode}
                  onChange={(event) => update({ defaultTravelMode: event.target.value as TravelMode })}
                  className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text focus:border-paper focus:outline-none"
                >
                  {TRAVEL_MODES.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>

              <SettingToggle
                checked={settings.compactTimeline}
                label="Compact timeline"
                description="Tightens itinerary cards when you are reviewing dense trips."
                onChange={(checked) => update({ compactTimeline: checked })}
              />

              <SettingToggle
                checked={settings.confirmBeforeDelete}
                label="Confirm before deleting"
                description="Keeps a confirmation step before removing trips or itinerary items."
                onChange={(checked) => update({ confirmBeforeDelete: checked })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function Avatar({ profile, loading }: { profile: Profile | null; loading: boolean }) {
  const label = profile?.displayName?.trim() || 'Traveler'
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold"
      style={{
        background: profile?.avatarColor ?? 'var(--color-surface-3)',
        color: profile?.avatarColor === '#f7ff88' || profile?.avatarColor === '#fefefe' ? '#070606' : '#fefefe',
      }}
    >
      {loading ? <UserRound size={12} /> : initials || <UserRound size={12} />}
    </span>
  )
}

function ProfileModal({
  profile,
  error,
  onClose,
  onSave,
}: {
  profile: Profile | null
  error: string | null
  onClose: () => void
  onSave: (input: { displayName: string; avatarColor: string }) => Promise<void>
}) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? 'Traveler')
  const [avatarColor, setAvatarColor] = useState(profile?.avatarColor ?? AVATAR_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({ displayName, avatarColor })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-start sm:justify-end sm:p-4">
      <button className="absolute inset-0 cursor-default" aria-label="Close profile" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-green">Traveler profile</p>
            <h2 className="text-lg font-extrabold text-text">How you show up</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
            aria-label="Close profile"
          >
            <X size={16} />
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value.slice(0, 48))}
            className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-paper focus:outline-none"
            placeholder="Traveler"
          />
        </label>

        <div className="mt-4">
          <span className="mb-2 block text-xs font-bold text-text">Profile color</span>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAvatarColor(color)}
                className="flex h-9 items-center justify-center rounded-md border"
                style={{ background: color, borderColor: avatarColor === color ? '#ffffff' : 'var(--color-border)' }}
                aria-label={`Use ${color}`}
              >
                {avatarColor === color && <Check size={14} color={color === '#f7ff88' || color === '#fefefe' ? '#070606' : '#ffffff'} />}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 border-l-4 border-green bg-ink px-3 py-2 text-xs leading-relaxed text-text-dim">
          Atlas only uses this name and color to label your own trips now, and group votes later. No public profile,
          phone number, contacts, precise location history, or demographic fields.
        </p>

        {(error || saveError) && <p className="mt-3 text-sm font-semibold text-line-4">{saveError ?? error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-5 w-full rounded-md bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-paper-dim disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </div>
  )
}

function SettingToggle({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean
  label: string
  description: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-md border border-border bg-ink px-3 py-3 text-left hover:border-border-strong"
      aria-pressed={checked}
    >
      <span>
        <span className="block text-sm font-bold text-text">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">{description}</span>
      </span>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
        style={{
          background: checked ? 'var(--color-green)' : 'transparent',
          borderColor: checked ? 'var(--color-green)' : 'var(--color-border-strong)',
          color: checked ? 'var(--color-ink)' : 'var(--color-text-dim)',
        }}
      >
        {checked && <Check size={14} />}
      </span>
    </button>
  )
}
