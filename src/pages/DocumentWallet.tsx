import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  BadgeCheck,
  ChevronLeft,
  ExternalLink,
  FileText,
  Pencil,
  Plane,
  Plus,
  ShieldCheck,
  Stamp,
  Trash2,
  Upload,
} from 'lucide-react'
import { fetchTrip } from '../api/trips'
import { fetchTripMembers } from '../api/groupTrips'
import {
  createDocument,
  deleteDocument,
  fetchDocuments,
  getDocumentSignedUrl,
  isMissingDocumentsTable,
  updateDocument,
  validateDocumentFile,
} from '../api/documents'
import type { DocumentInput } from '../api/documents'
import { TopNav } from '../components/TopNav'
import { TripSubNav } from '../components/TripSubNav'
import { useSession } from '../hooks/useSession'
import { shouldConfirmBeforeDelete } from '../utils/settings'
import type { DocumentType, Trip, TripDocument, TripMemberWithProfile } from '../types/trip'

const DOCUMENT_TYPES: { id: DocumentType; label: string; icon: typeof FileText }[] = [
  { id: 'passport', label: 'Passport', icon: Stamp },
  { id: 'visa', label: 'Visa', icon: BadgeCheck },
  { id: 'boarding_pass', label: 'Boarding pass', icon: Plane },
  { id: 'confirmation', label: 'Confirmation', icon: FileText },
  { id: 'insurance', label: 'Insurance', icon: ShieldCheck },
  { id: 'other', label: 'Other', icon: FileText },
]

const inputClass =
  'min-h-11 w-full rounded-md border border-border bg-ink px-3 py-2 text-base text-text placeholder:text-text-dim focus:border-paper focus:outline-none sm:text-sm'

function typeMeta(type: DocumentType) {
  return DOCUMENT_TYPES.find((entry) => entry.id === type) ?? DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1]
}

function expiryStatus(expiryDate: string | null): { label: string; tone: 'expired' | 'soon' | 'ok' | 'none' } {
  if (!expiryDate) return { label: 'No expiry on file', tone: 'none' }
  const days = Math.floor((new Date(`${expiryDate}T00:00:00`).getTime() - Date.now()) / 86_400_000)
  const formatted = new Date(`${expiryDate}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  if (days < 0) return { label: `Expired ${formatted}`, tone: 'expired' }
  if (days <= 90) return { label: `Expires ${formatted} · ${days}d`, tone: 'soon' }
  return { label: `Expires ${formatted}`, tone: 'ok' }
}

export default function DocumentWallet() {
  const { tripId } = useParams<{ tripId: string }>()
  const { session } = useSession()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<TripMemberWithProfile[]>([])
  const [documents, setDocuments] = useState<TripDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<TripDocument | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      setNeedsMigration(false)
      try {
        const [tripData, memberData] = await Promise.all([fetchTrip(tripId!), fetchTripMembers(tripId!)])
        if (cancelled) return
        setTrip(tripData)
        setMembers(memberData)
        try {
          setDocuments(await fetchDocuments(tripId!))
        } catch (err) {
          if (isMissingDocumentsTable(err)) setNeedsMigration(true)
          else throw err
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load this trip.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tripId])

  const viewerRole = members.find((member) => member.userId === session?.user.id)?.role ?? 'viewer'
  const canEdit = viewerRole === 'owner' || viewerRole === 'editor'

  async function refreshDocuments() {
    if (!tripId) return
    setDocuments(await fetchDocuments(tripId))
  }

  async function handleSave(input: DocumentInput, file: File | null) {
    if (!tripId || !session) return
    if (editingDocument) {
      await updateDocument(editingDocument.id, tripId, input, file, editingDocument.filePath)
    } else {
      await createDocument(tripId, session.user.id, input, file)
    }
    setFormOpen(false)
    setEditingDocument(null)
    await refreshDocuments()
  }

  async function handleDelete(document: TripDocument) {
    if (shouldConfirmBeforeDelete() && !confirm(`Delete "${document.title}"? This removes it from the trip wallet.`)) return
    await deleteDocument(document.id, document.filePath)
    await refreshDocuments()
  }

  async function handleView(document: TripDocument) {
    if (!document.filePath) return
    setActionError(null)
    try {
      const url = await getDocumentSignedUrl(document.filePath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not open this file.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink">
        <TopNav />
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-7">
          <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-surface-3" />
          <div className="mb-5 h-6 w-40 animate-pulse rounded-full bg-surface-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-24 animate-pulse overflow-hidden rounded-md border border-border bg-surface">
                <div className="w-20 shrink-0 border-r-2 border-dashed border-border-strong bg-surface-3/40" />
                <div className="flex-1 space-y-2 p-3.5">
                  <div className="h-3 w-2/3 rounded-full bg-surface-3" />
                  <div className="h-3 w-1/2 rounded-full bg-surface-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loadError || !trip || !tripId) {
    return (
      <div className="min-h-screen bg-ink">
        <TopNav />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-text-dim">
          {loadError ?? 'Trip not found.'}
        </div>
      </div>
    )
  }

  const sorted = [...documents].sort((a, b) => {
    if (!a.expiryDate) return 1
    if (!b.expiryDate) return -1
    return a.expiryDate.localeCompare(b.expiryDate)
  })

  return (
    <div className="min-h-screen bg-ink">
      <TopNav />
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-7">
        <Link to={`/trips/${tripId}`} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-text-dim hover:text-text">
          <ChevronLeft size={14} /> {trip.name}
        </Link>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-3xs font-bold uppercase tracking-[0.24em] text-green">Document wallet</p>
            <h1 className="font-display text-xl font-extrabold text-text">{trip.name}</h1>
          </div>
          <TripSubNav tripId={tripId} />
        </div>

        <p className="atlas-reveal mb-5 border-l-4 border-green bg-surface px-3 py-2 text-xs leading-relaxed text-text-dim">
          Only people on this trip can see what's stored here. Files are served through short-lived links, never a
          public URL — keep passport and visa numbers here only if that trade-off works for your group.
        </p>

        {needsMigration && (
          <p className="atlas-reveal mb-5 rounded-md border border-paper/40 bg-paper/10 px-3 py-2 text-xs font-semibold text-paper">
            Run the latest Supabase migration (add_trip_documents.sql) to enable the document wallet.
          </p>
        )}

        {actionError && <p className="mb-4 text-xs font-semibold text-line-4">{actionError}</p>}

        {!needsMigration && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-3xs font-bold uppercase tracking-[0.24em] text-text-dimmer">
                {documents.length} document{documents.length === 1 ? '' : 's'}
              </p>
              {canEdit && !formOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDocument(null)
                    setFormOpen(true)
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-paper px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper-dim"
                >
                  <Plus size={14} /> Add document
                </button>
              )}
            </div>

            {formOpen && (
              <DocumentForm
                document={editingDocument}
                onCancel={() => {
                  setFormOpen(false)
                  setEditingDocument(null)
                }}
                onSave={handleSave}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center text-text-dim sm:col-span-2">
                  <Stamp size={22} className="text-text-dimmer" />
                  <p className="text-xs">No documents yet. Add a passport, visa, or booking confirmation to keep it with the trip.</p>
                </div>
              )}
              {sorted.map((document) => {
                const meta = typeMeta(document.type)
                const status = expiryStatus(document.expiryDate)
                const Icon = meta.icon
                return (
                  <div
                    key={document.id}
                    className="atlas-ticket-stub atlas-cinematic-card flex overflow-hidden rounded-md border border-border bg-surface"
                  >
                    <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1.5 border-r-2 border-dashed border-border-strong py-3">
                      <Icon size={20} className="text-paper" />
                      <span className="text-center text-3xs font-extrabold uppercase leading-tight tracking-[0.1em] text-text-dimmer">
                        {meta.label}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 p-3.5">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-bold text-text">{document.title}</p>
                        {canEdit && (
                          <div className="flex shrink-0 items-center gap-1 text-text-dim">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDocument(document)
                                setFormOpen(true)
                              }}
                              aria-label="Edit document"
                              className="hover:text-text"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(document)}
                              aria-label="Delete document"
                              className="hover:text-line-4"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {document.documentNumber && (
                        <p className="mb-0.5 font-mono text-xs text-text-dim">No. {document.documentNumber}</p>
                      )}
                      {document.issuingCountry && <p className="mb-1.5 text-xs text-text-dim">{document.issuingCountry}</p>}

                      <p
                        className="mb-2 font-mono text-2xs font-bold"
                        style={{
                          color:
                            status.tone === 'expired'
                              ? 'var(--color-line-4)'
                              : status.tone === 'soon'
                                ? 'var(--color-paper)'
                                : 'var(--color-text-dimmer)',
                        }}
                      >
                        {status.label}
                      </p>

                      {document.notes && <p className="mb-2 text-xs leading-relaxed text-text-dim">{document.notes}</p>}

                      {document.filePath && (
                        <button
                          type="button"
                          onClick={() => handleView(document)}
                          className="flex items-center gap-1 text-xs font-bold text-green hover:text-paper"
                        >
                          <ExternalLink size={12} /> View file
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DocumentForm({
  document,
  onCancel,
  onSave,
}: {
  document: TripDocument | null
  onCancel: () => void
  onSave: (input: DocumentInput, file: File | null) => Promise<void>
}) {
  const [type, setType] = useState<DocumentType>(document?.type ?? 'passport')
  const [title, setTitle] = useState(document?.title ?? '')
  const [documentNumber, setDocumentNumber] = useState(document?.documentNumber ?? '')
  const [issuingCountry, setIssuingCountry] = useState(document?.issuingCountry ?? '')
  const [expiryDate, setExpiryDate] = useState(document?.expiryDate ?? '')
  const [notes, setNotes] = useState(document?.notes ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Give this document a title.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSave(
        {
          type,
          title: title.trim(),
          documentNumber: documentNumber.trim() || null,
          issuingCountry: issuingCountry.trim() || null,
          expiryDate: expiryDate || null,
          notes: notes.trim() || null,
        },
        file,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this document.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="atlas-reveal mb-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Type</span>
          <select value={type} onChange={(event) => setType(event.target.value as DocumentType)} className={inputClass}>
            {DOCUMENT_TYPES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Alex's passport" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Document number (optional)</span>
          <input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} className={inputClass} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Issuing country (optional)</span>
          <input value={issuingCountry} onChange={(event) => setIssuingCountry(event.target.value)} className={inputClass} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Expiry date (optional)</span>
          <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className={inputClass} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">
            {document?.fileName ? 'Replace file' : 'Attach file (optional)'}
          </span>
          <label className={`${inputClass} flex cursor-pointer items-center gap-2 text-text-dim`}>
            <Upload size={14} />
            {file?.name ?? document?.fileName ?? 'Choose a file'}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null
                if (selected) {
                  const validationError = validateDocumentFile(selected)
                  if (validationError) {
                    setError(validationError)
                    event.target.value = ''
                    return
                  }
                }
                setError('')
                setFile(selected)
              }}
            />
          </label>
          <span className="mt-1 block text-3xs text-text-dimmer">PDF, JPEG, PNG, WEBP, or HEIC — up to 12 MB.</span>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-bold text-text">Notes (optional)</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="Keep in carry-on" />
        </label>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-line-4">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-3.5 py-2 text-xs font-bold text-text-dim hover:text-text">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-paper px-4 py-2 text-xs font-bold text-ink hover:bg-paper-dim disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? 'Saving...' : document ? 'Save changes' : 'Add document'}
        </button>
      </div>
    </form>
  )
}
