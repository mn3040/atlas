import type { TravelMode } from './distance'

export interface AppSettings {
  compactTimeline: boolean
  confirmBeforeDelete: boolean
  defaultTravelMode: TravelMode
}

export const APP_SETTINGS_EVENT = 'atlas-settings-change'

const KEY = 'atlas:settings'
const DEFAULT_SETTINGS: AppSettings = {
  compactTimeline: false,
  confirmBeforeDelete: true,
  defaultTravelMode: 'car',
}

export function getAppSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveAppSettings(settings: AppSettings): void {
  window.localStorage.setItem(KEY, JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent<AppSettings>(APP_SETTINGS_EVENT, { detail: settings }))
}

export function shouldConfirmBeforeDelete(): boolean {
  return getAppSettings().confirmBeforeDelete
}
