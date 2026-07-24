export interface SentryCaptureOptions {
  dsn: string
  environment: string
  release?: string
  fetcher?: typeof fetch
}

interface SentryDsnParts {
  envelopeUrl: string
  dsn: string
}

export function captureSentryException(error: unknown, options: SentryCaptureOptions): Promise<void> {
  const dsn = parseSentryDsn(options.dsn)
  if (!dsn) return Promise.resolve()

  const fetcher = options.fetcher ?? fetch
  if (typeof fetcher !== 'function') return Promise.resolve()

  const eventId = makeEventId()
  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    environment: options.environment,
    release: options.release,
    exception: {
      values: [exceptionValue(error)],
    },
  }
  const envelope = [
    JSON.stringify({ dsn: dsn.dsn, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n')

  return fetcher(dsn.envelopeUrl, {
    method: 'POST',
    body: envelope,
    keepalive: true,
    headers: { 'content-type': 'application/x-sentry-envelope' },
  })
    .then(() => undefined)
    .catch(() => undefined)
}

function parseSentryDsn(value: string): SentryDsnParts | null {
  try {
    const url = new URL(value)
    const projectId = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean).at(-1)
    if (!projectId || !url.username || !url.host) return null
    return {
      dsn: value,
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    }
  } catch {
    return null
  }
}

function exceptionValue(error: unknown) {
  if (error instanceof Error) {
    return {
      type: error.name || 'Error',
      value: error.message || 'Unknown error',
      stacktrace: stacktrace(error.stack),
    }
  }
  return { type: 'Error', value: typeof error === 'string' ? error : safeStringify(error) }
}

function stacktrace(stack?: string) {
  if (!stack) return undefined
  const frames = stack
    .split('\n')
    .slice(1)
    .map((line) => ({ function: line.trim() }))
    .reverse()
  return frames.length > 0 ? { frames } : undefined
}

function makeEventId(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto?.getRandomValues?.(bytes)
  if (bytes.some((byte) => byte !== 0)) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32)
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) || 'Unknown error'
  } catch {
    return String(value)
  }
}
