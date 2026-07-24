import { captureSentryException } from './sentryEnvelope'

const dsn = import.meta.env.VITE_SENTRY_DSN

export function captureClientError(error: unknown, context?: { source?: string }): void {
  if (!import.meta.env.PROD || !dsn) return
  void captureSentryException(withSource(error, context?.source), {
    dsn,
    environment: 'production',
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA,
  })
}

export function installGlobalErrorMonitoring(): () => void {
  if (!import.meta.env.PROD || !dsn) return () => undefined

  const onError = (event: ErrorEvent) => {
    captureClientError(event.error ?? event.message, { source: 'window.error' })
  }
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    captureClientError(event.reason, { source: 'window.unhandledrejection' })
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }
}

function withSource(error: unknown, source?: string): unknown {
  if (!source || !(error instanceof Error)) return error
  error.name = `${error.name || 'Error'} (${source})`
  return error
}
