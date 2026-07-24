import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_SETTINGS_EVENT, getAppSettings, saveAppSettings, shouldConfirmBeforeDelete } from './settings'

beforeEach(() => {
  window.localStorage.clear()
})

describe('getAppSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(getAppSettings()).toEqual({
      compactTimeline: false,
      confirmBeforeDelete: true,
      defaultTravelMode: 'car',
    })
  })

  it('merges stored settings over the defaults', () => {
    saveAppSettings({ compactTimeline: true, confirmBeforeDelete: false, defaultTravelMode: 'walk' })
    expect(getAppSettings()).toEqual({
      compactTimeline: true,
      confirmBeforeDelete: false,
      defaultTravelMode: 'walk',
    })
  })

  it('falls back to defaults instead of throwing on corrupt stored JSON', () => {
    window.localStorage.setItem('atlas:settings', '{not valid json')
    expect(() => getAppSettings()).not.toThrow()
    expect(getAppSettings().confirmBeforeDelete).toBe(true)
  })

  it('fills in missing keys from a partially-stored settings object', () => {
    window.localStorage.setItem('atlas:settings', JSON.stringify({ compactTimeline: true }))
    expect(getAppSettings()).toEqual({
      compactTimeline: true,
      confirmBeforeDelete: true,
      defaultTravelMode: 'car',
    })
  })
})

describe('saveAppSettings', () => {
  it('persists settings so a later getAppSettings call sees them', () => {
    saveAppSettings({ compactTimeline: true, confirmBeforeDelete: true, defaultTravelMode: 'train' })
    expect(getAppSettings().defaultTravelMode).toBe('train')
  })

  it('dispatches an APP_SETTINGS_EVENT with the new settings as detail', () => {
    const handler = vi.fn()
    window.addEventListener(APP_SETTINGS_EVENT, handler)
    const settings = { compactTimeline: false, confirmBeforeDelete: false, defaultTravelMode: 'bike' as const }

    saveAppSettings(settings)

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual(settings)
    window.removeEventListener(APP_SETTINGS_EVENT, handler)
  })
})

describe('shouldConfirmBeforeDelete', () => {
  it('defaults to true', () => {
    expect(shouldConfirmBeforeDelete()).toBe(true)
  })

  it('reflects the stored confirmBeforeDelete setting', () => {
    saveAppSettings({ compactTimeline: false, confirmBeforeDelete: false, defaultTravelMode: 'car' })
    expect(shouldConfirmBeforeDelete()).toBe(false)
  })
})
