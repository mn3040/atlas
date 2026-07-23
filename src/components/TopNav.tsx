import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Settings, X } from 'lucide-react'
import { TRAVEL_MODES } from '../utils/distance'
import type { TravelMode } from '../utils/distance'
import { getAppSettings, saveAppSettings } from '../utils/settings'
import type { AppSettings } from '../utils/settings'

export function TopNav() {
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('atlas-compact', settings.compactTimeline)
  }, [settings.compactTimeline])

  function update(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveAppSettings(next)
  }

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border bg-ink px-7 py-3.5">
      <Link to="/" className="flex items-center gap-2.5">
        <img src="/atlas-mark.svg" alt="Atlas" className="h-8 w-8 rounded-lg" />
        <div>
          <span className="block text-[15px] font-extrabold tracking-[0.32em] text-text">ATLAS</span>
          <span className="block text-[9px] font-bold uppercase tracking-[0.24em] text-green">Plan your adventure</span>
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-text-dim sm:inline">Itinerary</span>
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

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/45 p-4">
          <button className="absolute inset-0 cursor-default" aria-label="Close settings" onClick={() => setOpen(false)} />
          <section className="relative w-full max-w-sm border border-border bg-surface p-5 shadow-2xl">
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
