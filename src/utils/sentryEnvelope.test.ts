import { describe, expect, it, vi } from 'vitest'
import { captureSentryException } from './sentryEnvelope'

const dsn = 'https://public-key@o123.ingest.sentry.io/456'

describe('captureSentryException', () => {
  it('posts an error event to the Sentry envelope endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    await captureSentryException(new Error('deliberate verification error'), {
      dsn,
      environment: 'production',
      release: 'commit-sha',
      fetcher,
    })

    expect(fetcher).toHaveBeenCalledWith(
      'https://o123.ingest.sentry.io/api/456/envelope/',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/x-sentry-envelope' },
        keepalive: true,
      }),
    )
    const body = String(fetcher.mock.calls[0][1].body)
    expect(body).toContain(dsn)
    expect(body).toContain('deliberate verification error')
    expect(body).toContain('"environment":"production"')
    expect(body).toContain('"release":"commit-sha"')
  })

  it('skips invalid DSNs without throwing', async () => {
    const fetcher = vi.fn()

    await expect(
      captureSentryException(new Error('not sent'), {
        dsn: 'not-a-dsn',
        environment: 'production',
        fetcher,
      }),
    ).resolves.toBeUndefined()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('swallows transport errors so reporting never masks the original failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network failed'))

    await expect(
      captureSentryException(new Error('still handled'), {
        dsn,
        environment: 'production',
        fetcher,
      }),
    ).resolves.toBeUndefined()
  })
})
