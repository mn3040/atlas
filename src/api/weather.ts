export interface WeatherSummary {
  date: string
  label: string
  tempHighC: number
  tempLowC: number
  tempHighF: number
  tempLowF: number
  precipitationMm: number
  windKmh: number
  isDateFallback: boolean
}

interface OpenMeteoDaily {
  time?: string[]
  weather_code?: number[]
  temperature_2m_max?: number[]
  temperature_2m_min?: number[]
  precipitation_sum?: number[]
  wind_speed_10m_max?: number[]
}

interface OpenMeteoResponse {
  daily?: OpenMeteoDaily
}

export async function fetchWeatherForPoint({
  lat,
  lng,
  date,
  signal,
}: {
  lat: number
  lng: number
  date: string
  signal?: AbortSignal
}): Promise<WeatherSummary> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toFixed(4))
  url.searchParams.set('longitude', lng.toFixed(4))
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '16')

  const response = await fetch(url.toString(), { signal })
  if (!response.ok) throw new Error('Weather is unavailable right now.')

  const payload = (await response.json()) as OpenMeteoResponse
  const daily = payload.daily
  if (!daily?.time?.length) throw new Error('Weather is unavailable for this stop.')

  const exactIndex = daily.time.indexOf(date)
  const index = exactIndex >= 0 ? exactIndex : 0
  const tempHighC = round(daily.temperature_2m_max?.[index] ?? 0)
  const tempLowC = round(daily.temperature_2m_min?.[index] ?? 0)

  return {
    date: daily.time[index],
    label: labelForWeatherCode(daily.weather_code?.[index] ?? 0),
    tempHighC,
    tempLowC,
    tempHighF: celsiusToFahrenheit(tempHighC),
    tempLowF: celsiusToFahrenheit(tempLowC),
    precipitationMm: round(daily.precipitation_sum?.[index] ?? 0),
    windKmh: round(daily.wind_speed_10m_max?.[index] ?? 0),
    isDateFallback: exactIndex < 0,
  }
}

function celsiusToFahrenheit(value: number): number {
  return Math.round((value * 9) / 5 + 32)
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function labelForWeatherCode(code: number): string {
  if ([0, 1].includes(code)) return 'Clear'
  if ([2, 3].includes(code)) return 'Cloudy'
  if ([45, 48].includes(code)) return 'Fog'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow'
  if ([95, 96, 99].includes(code)) return 'Storms'
  return 'Forecast'
}
