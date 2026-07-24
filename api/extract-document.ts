import type { IncomingMessage, ServerResponse } from 'node:http'
import { captureSentryException } from '../src/utils/sentryEnvelope'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Use POST to extract a document.' })
    return
  }

  const contentType = String(req.headers['content-type'] ?? '').toLowerCase()
  if (!contentType.includes('pdf')) {
    sendJson(res, 415, { error: 'Only PDF extraction is supported here.' })
    return
  }

  try {
    const buffer = await readRequestBody(req, 12 * 1024 * 1024)
    const text = await extractPdfText(buffer)
    sendJson(res, 200, { text })
  } catch (error) {
    await captureServerError(error)
    const message = error instanceof Error ? error.message : 'Could not extract that PDF.'
    sendJson(res, 400, { error: message })
  }
}

async function captureServerError(error: unknown): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production' || !process.env.VITE_SENTRY_DSN) return
  await captureSentryException(error, {
    dsn: process.env.VITE_SENTRY_DSN,
    environment: 'production',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  })
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  ensurePdfJsCompatibility()
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    disableRange: true,
    disableStream: true,
    isImageDecoderSupported: false,
    isOffscreenCanvasSupported: false,
    useSystemFonts: true,
    useWasm: false,
  }).promise
  const pages: string[] = []

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    pages.push(pdfTextContentToLines(content.items))
  }

  return pages.join('\n')
}

function pdfTextContentToLines(items: unknown[]): string {
  const lines: string[] = []
  let currentLine: string[] = []
  let currentY: number | null = null

  for (const item of items) {
    if (!isPdfTextItem(item)) continue
    const text = item.str.trim()
    if (!text) continue
    const y: number | null = typeof item.transform?.[5] === 'number' ? item.transform[5] : currentY
    if (currentY != null && y != null && Math.abs(y - currentY) > 4) {
      lines.push(currentLine.join(' '))
      currentLine = []
    }
    currentLine.push(text)
    currentY = y
    if (item.hasEOL) {
      lines.push(currentLine.join(' '))
      currentLine = []
      currentY = null
    }
  }

  if (currentLine.length > 0) lines.push(currentLine.join(' '))
  return lines.join('\n')
}

function isPdfTextItem(item: unknown): item is { str: string; transform?: number[]; hasEOL?: boolean } {
  return Boolean(item && typeof item === 'object' && 'str' in item && typeof (item as { str?: unknown }).str === 'string')
}

function ensurePdfJsCompatibility(): void {
  type PromiseWithResolvers = PromiseConstructor & {
    withResolvers?: <T>() => {
      promise: Promise<T>
      resolve: (value: T | PromiseLike<T>) => void
      reject: (reason?: unknown) => void
    }
  }

  const promiseConstructor = Promise as PromiseWithResolvers
  if (typeof promiseConstructor.withResolvers === 'function') return

  promiseConstructor.withResolvers = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    return { promise, resolve, reject }
  }
}

function readRequestBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('That PDF is too large. Try a file under 12 MB.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}
