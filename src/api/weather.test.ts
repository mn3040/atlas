import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWeatherForPoint } from './weather'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function mockFetchOnce(response: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  globalThis.fetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch
}

describe('fetchWeatherForPoint', () => {
  it('maps the Open-Meteo response for the exact requested date', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-03-01', '2026-03-02'],
          weather_code: [0, 61],
          temperature_2m_max: [20, 15],
          temperature_2m_min: [10, 5],
          precipitation_sum: [0, 5.2],
          wind_speed_10m_max: [12, 30],
        },
      }),
    })

    const weather = await fetchWeatherForPoint({ lat: 48.86, lng: 2.35, date: '2026-03-02' })

    expect(weather.date).toBe('2026-03-02')
    expect(weather.label).toBe('Rain')
    expect(weather.tempHighC).toBe(15)
    expect(weather.tempLowC).toBe(5)
    expect(weather.isDateFallback).toBe(false)
  })

  it('converts Celsius to Fahrenheit correctly', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-03-01'],
          weather_code: [0],
          temperature_2m_max: [0],
          temperature_2m_min: [-10],
          precipitation_sum: [0],
          wind_speed_10m_max: [0],
        },
      }),
    })

    const weather = await fetchWeatherForPoint({ lat: 0, lng: 0, date: '2026-03-01' })
    expect(weather.tempHighF).toBe(32)
    expect(weather.tempLowF).toBe(14)
  })

  it('falls back to the first available day and flags it when the exact date is not in the forecast', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-03-05'],
          weather_code: [2],
          temperature_2m_max: [18],
          temperature_2m_min: [9],
          precipitation_sum: [0],
          wind_speed_10m_max: [5],
        },
      }),
    })

    const weather = await fetchWeatherForPoint({ lat: 0, lng: 0, date: '2026-01-01' })
    expect(weather.date).toBe('2026-03-05')
    expect(weather.isDateFallback).toBe(true)
  })

  it('maps each documented weather code range to its label', async () => {
    const cases: [number, string][] = [
      [1, 'Clear'],
      [3, 'Cloudy'],
      [45, 'Fog'],
      [55, 'Drizzle'],
      [65, 'Rain'],
      [75, 'Snow'],
      [95, 'Storms'],
      [999, 'Forecast'],
    ]
    for (const [code, label] of cases) {
      mockFetchOnce({
        ok: true,
        json: async () => ({
          daily: {
            time: ['2026-03-01'],
            weather_code: [code],
            temperature_2m_max: [10],
            temperature_2m_min: [5],
            precipitation_sum: [0],
            wind_speed_10m_max: [0],
          },
        }),
      })
      const weather = await fetchWeatherForPoint({ lat: 0, lng: 0, date: '2026-03-01' })
      expect(weather.label).toBe(label)
    }
  })

  it('throws a friendly error when the HTTP response is not ok', async () => {
    mockFetchOnce({ ok: false, status: 500, json: async () => ({}) })
    await expect(fetchWeatherForPoint({ lat: 0, lng: 0, date: '2026-03-01' })).rejects.toThrow(
      'Weather is unavailable right now.',
    )
  })

  it('throws a friendly error when the response has no daily data', async () => {
    mockFetchOnce({ ok: true, json: async () => ({}) })
    await expect(fetchWeatherForPoint({ lat: 0, lng: 0, date: '2026-03-01' })).rejects.toThrow(
      'Weather is unavailable for this stop.',
    )
  })

  it('rounds temperature/precipitation/wind to one decimal place', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-03-01'],
          weather_code: [0],
          temperature_2m_max: [20.449],
          temperature_2m_min: [10.05],
          precipitation_sum: [1.234],
          wind_speed_10m_max: [12.99],
        },
      }),
    })
    const weather = await fetchWeatherForPoint({ lat: 0, lng: 0, date: '2026-03-01' })
    expect(weather.tempHighC).toBe(20.4)
    expect(weather.precipitationMm).toBe(1.2)
    expect(weather.windKmh).toBe(13)
  })
})
