import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { fetchTrip } from '../api/trips'
import { fetchTripMembers } from '../api/groupTrips'
import { createExpense, deleteExpense, fetchExpenses, isMissingExpensesTable, updateExpense } from '../api/budget'
import type { ExpenseInput } from '../api/budget'
import { TopNav } from '../components/TopNav'
import { TripSubNav } from '../components/TripSubNav'
import { useSession } from '../hooks/useSession'
import { shouldConfirmBeforeDelete } from '../utils/settings'
import {
  EXPENSE_CATEGORIES,
  categoryLabel,
  computeBalances,
  formatCurrency,
  simplifyDebts,
  splitEqually,
} from '../utils/budget'
import type { Expense, ExpenseCategory, Trip, TripMemberWithProfile } from '../types/trip'

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  lodging: 'var(--color-line-1)',
  food: 'var(--color-line-2)',
  transport: 'var(--color-line-3)',
  activities: 'var(--color-line-4)',
  shopping: 'var(--color-line-5)',
  other: 'var(--color-purple)',
}

const inputClass =
  'min-h-11 w-full rounded-md border border-border bg-ink px-3 py-2 text-base text-text placeholder:text-text-dim focus:border-paper focus:outline-none sm:text-sm'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function nameFor(members: TripMemberWithProfile[], userId: string): string {
  return members.find((member) => member.userId === userId)?.displayName ?? 'Traveler'
}

function colorFor(members: TripMemberWithProfile[], userId: string): string {
  return members.find((member) => member.userId === userId)?.avatarColor ?? '#22dd85'
}

export default function BudgetHub() {
  const { tripId } = useParams<{ tripId: string }>()
  const { session } = useSession()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<TripMemberWithProfile[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

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
          setExpenses(await fetchExpenses(tripId!))
        } catch (err) {
          if (isMissingExpensesTable(err)) setNeedsMigration(true)
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
  const isGroup = trip?.visibility === 'group' && members.length > 1

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalsByCategory = EXPENSE_CATEGORIES.map((entry) => ({
    ...entry,
    amount: expenses.filter((expense) => expense.category === entry.id).reduce((sum, expense) => sum + expense.amount, 0),
  })).filter((entry) => entry.amount > 0)

  const balances = isGroup
    ? computeBalances(
        expenses,
        members.map((member) => member.userId),
      )
    : {}
  const transfers = isGroup ? simplifyDebts(balances) : []

  async function refreshExpenses() {
    if (!tripId) return
    setExpenses(await fetchExpenses(tripId))
  }

  async function handleSave(input: ExpenseInput, participantIds: string[]) {
    if (!tripId || !session) return
    const shares = splitEqually(input.amount, participantIds).map((share) => ({
      userId: share.userId,
      shareAmount: share.shareAmount,
    }))
    if (editingExpense) {
      await updateExpense(editingExpense.id, input, shares)
    } else {
      await createExpense(tripId, session.user.id, input, shares)
    }
    setFormOpen(false)
    setEditingExpense(null)
    await refreshExpenses()
  }

  async function handleDelete(expense: Expense) {
    if (shouldConfirmBeforeDelete() && !confirm(`Delete "${expense.description}"? This removes it from the trip budget.`)) return
    await deleteExpense(expense.id)
    await refreshExpenses()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink">
        <TopNav />
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-7">
          <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-surface-3" />
          <div className="mb-5 h-6 w-40 animate-pulse rounded-full bg-surface-3" />
          <div className="mb-5 animate-pulse rounded-lg border border-border bg-surface p-4 sm:p-5">
            <div className="mb-3 h-3 w-20 rounded-full bg-surface-3" />
            <div className="mb-3 h-8 w-32 rounded-full bg-surface-3" />
            <div className="h-3 w-full rounded-full bg-ink" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md border border-border bg-surface" />
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

  return (
    <div className="min-h-screen bg-ink">
      <TopNav />
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-7">
        <Link to={`/trips/${tripId}`} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-text-dim hover:text-text">
          <ChevronLeft size={14} /> {trip.name}
        </Link>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-3xs font-bold uppercase tracking-[0.24em] text-green">Budget hub</p>
            <h1 className="font-display text-xl font-extrabold text-text">{trip.name}</h1>
          </div>
          <TripSubNav tripId={tripId} />
        </div>

        {needsMigration && (
          <p className="atlas-reveal mb-5 rounded-md border border-paper/40 bg-paper/10 px-3 py-2 text-xs font-semibold text-paper">
            Run the latest Supabase migration (add_expenses.sql) to enable the budget hub.
          </p>
        )}

        {!needsMigration && (
          <>
            {/* Ledger strip -- the hero: a running total as a segmented bar
                colored by category, instead of a plain stat block. */}
            <section className="atlas-reveal mb-5 rounded-lg border border-border bg-surface p-4 sm:p-5">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="mb-1 text-3xs font-bold uppercase tracking-[0.24em] text-text-dimmer">Trip spend</p>
                  <p className="font-mono text-3xl font-extrabold text-text">{formatCurrency(total)}</p>
                </div>
                <Wallet size={28} className="text-text-dimmer" />
              </div>

              {total > 0 ? (
                <>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink">
                    {totalsByCategory.map((entry) => (
                      <div
                        key={entry.id}
                        style={{ width: `${(entry.amount / total) * 100}%`, background: CATEGORY_COLORS[entry.id] }}
                        title={`${entry.label}: ${formatCurrency(entry.amount)}`}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {totalsByCategory.map((entry) => (
                      <span key={entry.id} className="flex items-center gap-1.5 text-xs font-semibold text-text-dim">
                        <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[entry.id] }} />
                        {entry.label} · {formatCurrency(entry.amount)}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-text-dim">No expenses logged yet.</p>
              )}
            </section>

            {isGroup && (
              <section className="atlas-reveal atlas-reveal-delay-1 mb-5 rounded-lg border border-border bg-surface p-4 sm:p-5">
                <p className="mb-3 text-3xs font-bold uppercase tracking-[0.24em] text-text-dimmer">Balances</p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {members.map((member) => {
                    const net = balances[member.userId]?.net ?? 0
                    const owed = net > 0.005
                    const owes = net < -0.005
                    return (
                      <span
                        key={member.userId}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-ink px-2.5 py-1.5 text-xs font-bold"
                        style={{ color: owed ? 'var(--color-green)' : owes ? 'var(--color-line-4)' : 'var(--color-text-dim)' }}
                      >
                        {member.displayName}
                        {owed && ` is owed ${formatCurrency(net)}`}
                        {owes && ` owes ${formatCurrency(-net)}`}
                        {!owed && !owes && ' is settled up'}
                      </span>
                    )
                  })}
                </div>

                {transfers.length > 0 && (
                  <div className="space-y-1.5 border-t border-border pt-3">
                    {transfers.map((transfer, index) => (
                      <p key={index} className="text-xs font-semibold text-text">
                        <span style={{ color: colorFor(members, transfer.from) }}>{nameFor(members, transfer.from)}</span>
                        {' owes '}
                        <span style={{ color: colorFor(members, transfer.to) }}>{nameFor(members, transfer.to)}</span>
                        {' '}
                        <span className="font-mono">{formatCurrency(transfer.amount)}</span>
                      </p>
                    ))}
                  </div>
                )}
              </section>
            )}

            <div className="mb-3 flex items-center justify-between">
              <p className="text-3xs font-bold uppercase tracking-[0.24em] text-text-dimmer">Expenses</p>
              {canEdit && !formOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingExpense(null)
                    setFormOpen(true)
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-paper px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper-dim"
                >
                  <Plus size={14} /> Add expense
                </button>
              )}
            </div>

            {formOpen && (
              <ExpenseForm
                members={members}
                expense={editingExpense}
                onCancel={() => {
                  setFormOpen(false)
                  setEditingExpense(null)
                }}
                onSave={handleSave}
              />
            )}

            <div className="space-y-2">
              {expenses.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center text-text-dim">
                  <Wallet size={22} className="text-text-dimmer" />
                  <p className="text-xs">No expenses yet. Add the first one to start tracking the trip budget.</p>
                </div>
              )}
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="atlas-cinematic-card flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3.5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ background: CATEGORY_COLORS[expense.category] }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-text">{expense.description}</p>
                      <p className="truncate text-xs text-text-dim">
                        {categoryLabel(expense.category)} · Paid by {nameFor(members, expense.paidBy)} ·{' '}
                        <span className="font-mono">
                          {new Date(`${expense.spentOn}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-extrabold text-text">{formatCurrency(expense.amount)}</span>
                    {canEdit && (
                      <div className="flex items-center gap-1 text-text-dim">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpense(expense)
                            setFormOpen(true)
                          }}
                          aria-label="Edit expense"
                          className="hover:text-text"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(expense)}
                          aria-label="Delete expense"
                          className="hover:text-line-4"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ExpenseForm({
  members,
  expense,
  onCancel,
  onSave,
}: {
  members: TripMemberWithProfile[]
  expense: Expense | null
  onCancel: () => void
  onSave: (input: ExpenseInput, participantIds: string[]) => Promise<void>
}) {
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'other')
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? members[0]?.userId ?? '')
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? todayIso())
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    () => new Set(expense ? expense.shares.map((share) => share.userId) : members.map((member) => member.userId)),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function toggleParticipant(userId: string) {
    setParticipantIds((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!description.trim()) {
      setError('Add a description.')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than 0.')
      return
    }
    if (participantIds.size === 0) {
      setError('Pick at least one person to split this with.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSave(
        { description: description.trim(), amount: parsedAmount, category, paidBy, spentOn, notes: notes.trim() || null },
        Array.from(participantIds),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this expense.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="atlas-reveal mb-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-bold text-text">Description</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} placeholder="Dinner at the harbor" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Amount</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
            placeholder="0.00"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)} className={inputClass}>
            {EXPENSE_CATEGORIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Paid by</span>
          <select value={paidBy} onChange={(event) => setPaidBy(event.target.value)} className={inputClass}>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-text">Date</span>
          <input type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} className={inputClass} />
        </label>

        {members.length > 1 && (
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-text">Split with</span>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => toggleParticipant(member.userId)}
                  aria-pressed={participantIds.has(member.userId)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                    participantIds.has(member.userId) ? 'border-green bg-green/10 text-green' : 'border-border text-text-dim'
                  }`}
                >
                  {member.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-bold text-text">Notes (optional)</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="Split evenly, receipt in email" />
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
          {submitting ? 'Saving...' : expense ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </form>
  )
}
