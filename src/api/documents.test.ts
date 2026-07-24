import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, storageFromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  storageFromMock: vi.fn(),
}))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock, storage: { from: storageFromMock } },
}))

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_FILE_BYTES,
  createDocument,
  deleteDocument,
  fetchDocuments,
  getDocumentSignedUrl,
  isMissingDocumentsTable,
  updateDocument,
  validateDocumentFile,
} from './documents'

// Mirrors supabase-js's PostgrestFilterBuilder: chainable methods return the
// same object, and the object itself is awaitable (thenable).
function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.insert = vi.fn(chain)
  builder.update = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  ;(builder as unknown as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return builder
}

function makeFile(overrides: { size?: number; name?: string; type?: string } = {}): File {
  return {
    size: overrides.size ?? 1024,
    name: overrides.name ?? 'passport.pdf',
    type: overrides.type ?? 'application/pdf',
  } as unknown as File
}

const documentRow = {
  id: 'doc-1',
  trip_id: 'trip-1',
  uploaded_by: 'user-1',
  type: 'passport',
  title: "Alex's passport",
  document_number: 'X1234567',
  issuing_country: 'US',
  expiry_date: '2030-01-01',
  notes: null,
  file_path: 'trip-1/uuid-passport.pdf',
  file_name: 'passport.pdf',
  mime_type: 'application/pdf',
  created_at: '2026-03-01T00:00:00Z',
}

const mappedDocument = {
  id: 'doc-1',
  tripId: 'trip-1',
  uploadedBy: 'user-1',
  type: 'passport',
  title: "Alex's passport",
  documentNumber: 'X1234567',
  issuingCountry: 'US',
  expiryDate: '2030-01-01',
  notes: null,
  filePath: 'trip-1/uuid-passport.pdf',
  fileName: 'passport.pdf',
  mimeType: 'application/pdf',
  createdAt: '2026-03-01T00:00:00Z',
}

beforeEach(() => {
  fromMock.mockReset()
  storageFromMock.mockReset()
})

describe('validateDocumentFile', () => {
  it('accepts a file within the size cap and an allowed mime type', () => {
    expect(validateDocumentFile(makeFile())).toBeNull()
  })

  it('accepts every type in the allowlist', () => {
    for (const type of ALLOWED_DOCUMENT_MIME_TYPES) {
      expect(validateDocumentFile(makeFile({ type }))).toBeNull()
    }
  })

  it('rejects a file over the size cap', () => {
    const error = validateDocumentFile(makeFile({ size: MAX_DOCUMENT_FILE_BYTES + 1 }))
    expect(error).toMatch(/too large/i)
  })

  it('rejects an unsupported mime type', () => {
    const error = validateDocumentFile(makeFile({ type: 'application/zip' }))
    expect(error).toMatch(/supported file type/i)
  })

  it('does not reject a missing mime type (some browsers omit it)', () => {
    expect(validateDocumentFile(makeFile({ type: '' }))).toBeNull()
  })
})

describe('fetchDocuments', () => {
  it('maps snake_case rows to camelCase TripDocument objects', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: [documentRow], error: null }))

    const documents = await fetchDocuments('trip-1')

    expect(fromMock).toHaveBeenCalledWith('trip_documents')
    expect(documents).toEqual([mappedDocument])
  })

  it('throws when the query errors', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: new Error('boom') }))

    await expect(fetchDocuments('trip-1')).rejects.toThrow('boom')
  })
})

describe('createDocument', () => {
  it('creates a document without a file', async () => {
    const insertBuilder = makeQueryBuilder({ data: documentRow, error: null })
    fromMock.mockReturnValueOnce(insertBuilder)

    const result = await createDocument(
      'trip-1',
      'user-1',
      {
        type: 'passport',
        title: "Alex's passport",
        documentNumber: 'X1234567',
        issuingCountry: 'US',
        expiryDate: '2030-01-01',
        notes: null,
      },
      null,
    )

    expect(storageFromMock).not.toHaveBeenCalled()
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: 'trip-1', uploaded_by: 'user-1', file_path: null }),
    )
    expect(result).toEqual(mappedDocument)
  })

  it('uploads the file first, then stores its path on the row', async () => {
    const uploadMock = vi.fn(() => Promise.resolve({ error: null }))
    storageFromMock.mockReturnValue({ upload: uploadMock })
    const insertBuilder = makeQueryBuilder({ data: documentRow, error: null })
    fromMock.mockReturnValueOnce(insertBuilder)

    await createDocument(
      'trip-1',
      'user-1',
      { type: 'passport', title: 'Passport', documentNumber: null, issuingCountry: null, expiryDate: null, notes: null },
      makeFile({ name: 'passport.pdf' }),
    )

    expect(storageFromMock).toHaveBeenCalledWith('trip-documents')
    expect(uploadMock).toHaveBeenCalledWith(expect.stringMatching(/^trip-1\/.+-passport\.pdf$/), expect.anything())
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: expect.stringContaining('trip-1/'), file_name: 'passport.pdf' }),
    )
  })

  it('rejects an oversized file before ever touching storage', async () => {
    await expect(
      createDocument(
        'trip-1',
        'user-1',
        { type: 'passport', title: 'Passport', documentNumber: null, issuingCountry: null, expiryDate: null, notes: null },
        makeFile({ size: MAX_DOCUMENT_FILE_BYTES + 1 }),
      ),
    ).rejects.toThrow(/too large/i)

    expect(storageFromMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('rejects an unsupported file type before ever touching storage', async () => {
    await expect(
      createDocument(
        'trip-1',
        'user-1',
        { type: 'passport', title: 'Passport', documentNumber: null, issuingCountry: null, expiryDate: null, notes: null },
        makeFile({ type: 'application/zip' }),
      ),
    ).rejects.toThrow(/supported file type/i)

    expect(storageFromMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('throws when the storage upload errors', async () => {
    storageFromMock.mockReturnValue({ upload: vi.fn(() => Promise.resolve({ error: new Error('upload failed') })) })

    await expect(
      createDocument(
        'trip-1',
        'user-1',
        { type: 'passport', title: 'Passport', documentNumber: null, issuingCountry: null, expiryDate: null, notes: null },
        makeFile(),
      ),
    ).rejects.toThrow('upload failed')

    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('updateDocument', () => {
  it('replaces the previous file: uploads the new one, then removes the old path', async () => {
    const uploadMock = vi.fn(() => Promise.resolve({ error: null }))
    const removeMock = vi.fn(() => Promise.resolve({ error: null }))
    storageFromMock.mockReturnValue({ upload: uploadMock, remove: removeMock })
    const updateBuilder = makeQueryBuilder({ data: documentRow, error: null })
    fromMock.mockReturnValueOnce(updateBuilder)

    await updateDocument(
      'doc-1',
      'trip-1',
      { type: 'passport', title: 'Passport', documentNumber: null, issuingCountry: null, expiryDate: null, notes: null },
      makeFile({ name: 'new.pdf' }),
      'trip-1/old-path.pdf',
    )

    expect(uploadMock).toHaveBeenCalled()
    expect(removeMock).toHaveBeenCalledWith(['trip-1/old-path.pdf'])
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ file_name: 'new.pdf' }),
    )
  })

  it('leaves the file fields untouched when no new file is given', async () => {
    const updateBuilder = makeQueryBuilder({ data: documentRow, error: null })
    fromMock.mockReturnValueOnce(updateBuilder)

    await updateDocument(
      'doc-1',
      'trip-1',
      { type: 'passport', title: 'Updated title', documentNumber: null, issuingCountry: null, expiryDate: null, notes: null },
      null,
      'trip-1/old-path.pdf',
    )

    expect(storageFromMock).not.toHaveBeenCalled()
    const patch = updateBuilder.update.mock.calls[0][0]
    expect(patch).not.toHaveProperty('file_path')
    expect(patch).not.toHaveProperty('file_name')
  })

  it('rejects an oversized replacement file before removing the old one', async () => {
    const removeMock = vi.fn()
    storageFromMock.mockReturnValue({ remove: removeMock })

    await expect(
      updateDocument(
        'doc-1',
        'trip-1',
        { type: 'passport', title: 'Passport', documentNumber: null, issuingCountry: null, expiryDate: null, notes: null },
        makeFile({ size: MAX_DOCUMENT_FILE_BYTES + 1 }),
        'trip-1/old-path.pdf',
      ),
    ).rejects.toThrow(/too large/i)

    expect(removeMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('deleteDocument', () => {
  it('deletes the row and removes the file when a path exists', async () => {
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValueOnce(deleteBuilder)
    const removeMock = vi.fn(() => Promise.resolve({ error: null }))
    storageFromMock.mockReturnValue({ remove: removeMock })

    await deleteDocument('doc-1', 'trip-1/old-path.pdf')

    expect(fromMock).toHaveBeenCalledWith('trip_documents')
    expect(removeMock).toHaveBeenCalledWith(['trip-1/old-path.pdf'])
  })

  it('skips storage removal when there is no file path', async () => {
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValueOnce(deleteBuilder)

    await deleteDocument('doc-1', null)

    expect(storageFromMock).not.toHaveBeenCalled()
  })

  it('throws when the row delete errors', async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: new Error('delete failed') }))

    await expect(deleteDocument('doc-1', null)).rejects.toThrow('delete failed')
  })
})

describe('getDocumentSignedUrl', () => {
  it('returns the signed url for a file path', async () => {
    storageFromMock.mockReturnValue({
      createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'https://signed.example/doc' }, error: null })),
    })

    const url = await getDocumentSignedUrl('trip-1/passport.pdf')

    expect(url).toBe('https://signed.example/doc')
  })

  it('throws when signing errors', async () => {
    storageFromMock.mockReturnValue({
      createSignedUrl: vi.fn(() => Promise.resolve({ data: null, error: new Error('signing failed') })),
    })

    await expect(getDocumentSignedUrl('trip-1/passport.pdf')).rejects.toThrow('signing failed')
  })
})

describe('isMissingDocumentsTable', () => {
  it('recognizes missing-table and missing-bucket style errors', () => {
    expect(isMissingDocumentsTable(new Error('relation "trip_documents" does not exist'))).toBe(true)
    expect(isMissingDocumentsTable(new Error('Bucket not found'))).toBe(true)
    expect(isMissingDocumentsTable(new Error('permission denied for table trips'))).toBe(false)
  })
})
