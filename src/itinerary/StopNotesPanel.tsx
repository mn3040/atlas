import { useState } from 'react'
import { MessageCircle, Trash2, X } from 'lucide-react'
import type { Item, ItemNote } from '../types/trip'

export function StopNotesPanel({
  item,
  notes,
  currentUserId,
  canModerate,
  posting,
  error,
  onClose,
  onAddNote,
  onDeleteNote,
}: {
  item: Item
  notes: ItemNote[]
  currentUserId: string | null
  canModerate: boolean
  posting: boolean
  error: string | null
  onClose: () => void
  onAddNote: (body: string) => void
  onDeleteNote: (id: string) => void
}) {
  const [draft, setDraft] = useState('')

  function submit() {
    const body = draft.trim()
    if (!body) return
    onAddNote(body)
    setDraft('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center">
      <button className="absolute inset-0 cursor-default" aria-label="Close stop notes" onClick={onClose} />
      <section className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-green">
              <MessageCircle size={12} /> Stop notes
            </p>
            <h2 className="truncate text-sm font-extrabold text-text">{item.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-dim hover:bg-surface-3 hover:text-text"
            aria-label="Close stop notes"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {notes.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-dim">
              No notes yet — leave one for the group (e.g. "who's driving to this one?").
            </p>
          ) : (
            notes.map((note) => {
              const canDelete = canModerate || note.userId === currentUserId
              return (
                <div key={note.id} className="group flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold uppercase text-ink"
                    style={{ background: note.avatarColor }}
                  >
                    {initials(note.displayName)}
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-border bg-ink px-3 py-2">
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-2xs font-bold text-text">{note.displayName}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-3xs text-text-dimmer">{formatNoteTime(note.createdAt)}</span>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDeleteNote(note.id)}
                            className="text-text-dimmer opacity-100 hover:text-line-4 md:opacity-0 md:group-hover:opacity-100"
                            aria-label="Delete note"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-text-dim">{note.body}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {error && (
          <p className="mx-4 mb-2 rounded-md border border-line-4/40 bg-line-4/10 px-3 py-2 text-xs font-semibold text-line-4">
            {error}
          </p>
        )}

        <div className="flex items-end gap-2 border-t border-border p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Leave a note for the group..."
            rows={1}
            maxLength={2000}
            className="max-h-28 min-h-[38px] flex-1 resize-none rounded-md border border-border bg-ink px-2.5 py-2 text-xs text-text placeholder:text-text-dimmer focus:border-paper focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={posting || !draft.trim()}
            className="h-[38px] shrink-0 rounded-md bg-green px-3 text-xs font-extrabold text-ink disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </section>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function formatNoteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
