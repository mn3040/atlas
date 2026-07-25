import type { Expense, ExpenseCategory, ExpenseShare } from '../types/trip'

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'lodging', label: 'Lodging' },
  { id: 'food', label: 'Food' },
  { id: 'transport', label: 'Transport' },
  { id: 'activities', label: 'Activities' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'other', label: 'Other' },
]

export function categoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((entry) => entry.id === category)?.label ?? 'Other'
}

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  lodging: 'var(--color-line-1)',
  food: 'var(--color-line-2)',
  transport: 'var(--color-line-3)',
  activities: 'var(--color-line-4)',
  shopping: 'var(--color-line-5)',
  other: 'var(--color-purple)',
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

/**
 * Splits an amount evenly across participants in whole cents, handing the
 * leftover cent(s) from rounding to the first participant so shares always
 * sum exactly to the original amount.
 */
export function splitEqually(amount: number, participantIds: string[]): ExpenseShare[] {
  if (participantIds.length === 0) return []
  const totalCents = Math.round(amount * 100)
  const baseCents = Math.floor(totalCents / participantIds.length)
  let remainder = totalCents - baseCents * participantIds.length

  return participantIds.map((userId) => {
    const cents = baseCents + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
    return { expenseId: '', userId, shareAmount: cents / 100 }
  })
}

export interface MemberBalance {
  userId: string
  paid: number
  owed: number
  net: number
}

export function computeBalances(expenses: Expense[], memberIds: string[]): Record<string, MemberBalance> {
  const balances: Record<string, MemberBalance> = {}
  for (const userId of memberIds) balances[userId] = { userId, paid: 0, owed: 0, net: 0 }

  for (const expense of expenses) {
    const payer = (balances[expense.paidBy] ??= { userId: expense.paidBy, paid: 0, owed: 0, net: 0 })
    payer.paid += expense.amount
    for (const share of expense.shares) {
      const member = (balances[share.userId] ??= { userId: share.userId, paid: 0, owed: 0, net: 0 })
      member.owed += share.shareAmount
    }
  }

  for (const balance of Object.values(balances)) balance.net = round2(balance.paid - balance.owed)
  return balances
}

export interface Transfer {
  from: string
  to: string
  amount: number
}

/**
 * Greedy largest-debtor/largest-creditor matching. Not the theoretical
 * minimum number of transfers in every case, but simple, deterministic, and
 * always correct -- good enough for trip-sized groups.
 */
export function simplifyDebts(balances: Record<string, MemberBalance>): Transfer[] {
  const debtors = Object.values(balances)
    .filter((balance) => balance.net < -0.005)
    .map((balance) => ({ userId: balance.userId, amount: -balance.net }))
    .sort((a, b) => b.amount - a.amount)
  const creditors = Object.values(balances)
    .filter((balance) => balance.net > 0.005)
    .map((balance) => ({ userId: balance.userId, amount: balance.net }))
    .sort((a, b) => b.amount - a.amount)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = round2(Math.min(debtor.amount, creditor.amount))
    if (amount > 0.005) transfers.push({ from: debtor.userId, to: creditor.userId, amount })
    debtor.amount = round2(debtor.amount - amount)
    creditor.amount = round2(creditor.amount - amount)
    if (debtor.amount <= 0.005) i += 1
    if (creditor.amount <= 0.005) j += 1
  }
  return transfers
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
