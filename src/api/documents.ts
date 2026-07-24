import { supabase } from './supabaseClient'
import type { DocumentType, TripDocument } from '../types/trip'

const BUCKET = 'trip-documents'

export const MAX_DOCUMENT_FILE_BYTES = 12 * 1024 * 1024
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
])

interface TripDocumentRow {
  id: string
  trip_id: string
  uploaded_by: string
  type: DocumentType
  title: string
  document_number: string | null
  issuing_country: string | null
  expiry_date: string | null
  notes: string | null
  file_path: string | null
  file_name: string | null
  mime_type: string | null
  created_at: string
}

const SELECT_COLUMNS =
  'id,trip_id,uploaded_by,type,title,document_number,issuing_country,expiry_date,notes,file_path,file_name,mime_type,created_at'

function mapDocument(row: TripDocumentRow): TripDocument {
  return {
    id: row.id,
    tripId: row.trip_id,
    uploadedBy: row.uploaded_by,
    type: row.type,
    title: row.title,
    documentNumber: row.document_number,
    issuingCountry: row.issuing_country,
    expiryDate: row.expiry_date,
    notes: row.notes,
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  }
}

export function isMissingDocumentsTable(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase()
  return (
    message.includes('trip_documents') ||
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    message.includes('bucket not found')
  )
}

export async function fetchDocuments(tripId: string): Promise<TripDocument[]> {
  const { data, error } = await supabase
    .from('trip_documents')
    .select(SELECT_COLUMNS)
    .eq('trip_id', tripId)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data as TripDocumentRow[]).map(mapDocument)
}

export interface DocumentInput {
  type: DocumentType
  title: string
  documentNumber: string | null
  issuingCountry: string | null
  expiryDate: string | null
  notes: string | null
}

export function validateDocumentFile(file: File): string | null {
  if (file.size > MAX_DOCUMENT_FILE_BYTES) {
    return `"${file.name}" is too large. Documents must be under 12 MB.`
  }
  if (file.type && !ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
    return `"${file.name}" isn't a supported file type. Upload a PDF, JPEG, PNG, WEBP, or HEIC.`
  }
  return null
}

async function uploadFile(tripId: string, file: File): Promise<{ path: string; name: string; mimeType: string }> {
  const validationError = validateDocumentFile(file)
  if (validationError) throw new Error(validationError)

  const path = `${tripId}/${crypto.randomUUID()}-${file.name}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error
  return { path, name: file.name, mimeType: file.type || 'application/octet-stream' }
}

export async function createDocument(
  tripId: string,
  userId: string,
  input: DocumentInput,
  file: File | null,
): Promise<TripDocument> {
  const uploaded = file ? await uploadFile(tripId, file) : null

  const { data, error } = await supabase
    .from('trip_documents')
    .insert({
      trip_id: tripId,
      uploaded_by: userId,
      type: input.type,
      title: input.title,
      document_number: input.documentNumber,
      issuing_country: input.issuingCountry,
      expiry_date: input.expiryDate,
      notes: input.notes,
      file_path: uploaded?.path ?? null,
      file_name: uploaded?.name ?? null,
      mime_type: uploaded?.mimeType ?? null,
    })
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw error
  return mapDocument(data as TripDocumentRow)
}

export async function updateDocument(
  documentId: string,
  tripId: string,
  input: DocumentInput,
  file: File | null,
  previousFilePath: string | null,
): Promise<TripDocument> {
  const uploaded = file ? await uploadFile(tripId, file) : null
  if (uploaded && previousFilePath) {
    await supabase.storage.from(BUCKET).remove([previousFilePath])
  }

  const patch: Record<string, unknown> = {
    type: input.type,
    title: input.title,
    document_number: input.documentNumber,
    issuing_country: input.issuingCountry,
    expiry_date: input.expiryDate,
    notes: input.notes,
  }
  if (uploaded) {
    patch.file_path = uploaded.path
    patch.file_name = uploaded.name
    patch.mime_type = uploaded.mimeType
  }

  const { data, error } = await supabase.from('trip_documents').update(patch).eq('id', documentId).select(SELECT_COLUMNS).single()

  if (error) throw error
  return mapDocument(data as TripDocumentRow)
}

export async function deleteDocument(documentId: string, filePath: string | null): Promise<void> {
  const { error } = await supabase.from('trip_documents').delete().eq('id', documentId)
  if (error) throw error
  if (filePath) await supabase.storage.from(BUCKET).remove([filePath])
}

export async function getDocumentSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60)
  if (error) throw error
  return data.signedUrl
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '')
  return String(error ?? '')
}
