import { describe, expect, it } from 'vitest'
import { categoryLabel, computeBalances, formatCurrency, simplifyDebts, splitEqually } from './budget'
import type { Expense } from '../types/trip'

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'expense-1',
    tripId: 'trip-1',
    description: 'Dinner',
    amount: 0,
    category: 'food',
    paidBy: 'traveler-1',
    spentOn: '2026-03-02',
    notes: null,
    createdBy: 'traveler-1',
    createdAt: '2026-03-02T00:00:00Z',
    shares: [],
    ...overrides,
  }
}

describe('splitEqually', () => {
  it('splits an amount evenly across participants', () => {
    expect(splitEqually(60, ['traveler-1', 'traveler-2', 'traveler-3'])).toEqual([
      { expenseId: '', userId: 'traveler-1', shareAmount: 20 },
      { expenseId: '', userId: 'traveler-2', shareAmount: 20 },
      { expenseId: '', userId: 'traveler-3', shareAmount: 20 },
    ])
  })

  it('keeps cent rounding exact for uneven splits', () => {
    const shares = splitEqually(10, ['traveler-1', 'traveler-2', 'traveler-3'])

    expect(shares).toEqual([
      { expenseId: '', userId: 'traveler-1', shareAmount: 3.34 },
      { expenseId: '', userId: 'traveler-2', shareAmount: 3.33 },
      { expenseId: '', userId: 'traveler-3', shareAmount: 3.33 },
    ])
    expect(shares.reduce((sum, share) => sum + share.shareAmount, 0)).toBeCloseTo(10, 2)
  })

  it('returns no shares when there are no participants', () => {
    expect(splitEqually(25, [])).toEqual([])
  })
})

describe('computeBalances', () => {
  it('calculates paid, owed, and net amounts for custom shares', () => {
    const balances = computeBalances(
      [
        expense({
          amount: 100,
          paidBy: 'traveler-1',
          shares: [
            { expenseId: 'expense-1', userId: 'traveler-1', shareAmount: 25 },
            { expenseId: 'expense-1', userId: 'traveler-2', shareAmount: 75 },
          ],
        }),
      ],
      ['traveler-1', 'traveler-2'],
    )

    expect(balances['traveler-1']).toEqual({ userId: 'traveler-1', paid: 100, owed: 25, net: 75 })
    expect(balances['traveler-2']).toEqual({ userId: 'traveler-2', paid: 0, owed: 75, net: -75 })
  })

  it('keeps travelers with zero expenses in the balance sheet', () => {
    const balances = computeBalances(
      [
        expense({
          amount: 45,
          paidBy: 'traveler-1',
          shares: [
            { expenseId: 'expense-1', userId: 'traveler-1', shareAmount: 22.5 },
            { expenseId: 'expense-1', userId: 'traveler-2', shareAmount: 22.5 },
          ],
        }),
      ],
      ['traveler-1', 'traveler-2', 'traveler-3'],
    )

    expect(balances['traveler-3']).toEqual({ userId: 'traveler-3', paid: 0, owed: 0, net: 0 })
  })

  it('adds balances for expense participants outside the supplied member list', () => {
    const balances = computeBalances(
      [
        expense({
          amount: 20,
          paidBy: 'traveler-4',
          shares: [{ expenseId: 'expense-1', userId: 'traveler-1', shareAmount: 20 }],
        }),
      ],
      ['traveler-1'],
    )

    expect(balances['traveler-4']).toEqual({ userId: 'traveler-4', paid: 20, owed: 0, net: 20 })
  })
})

describe('simplifyDebts', () => {
  it('creates deterministic settle-up transfers from balances', () => {
    const transfers = simplifyDebts({
      'traveler-1': { userId: 'traveler-1', paid: 120, owed: 40, net: 80 },
      'traveler-2': { userId: 'traveler-2', paid: 0, owed: 50, net: -50 },
      'traveler-3': { userId: 'traveler-3', paid: 0, owed: 30, net: -30 },
    })

    expect(transfers).toEqual([
      { from: 'traveler-2', to: 'traveler-1', amount: 50 },
      { from: 'traveler-3', to: 'traveler-1', amount: 30 },
    ])
  })

  it('ignores tiny floating-point leftovers after rounding', () => {
    expect(
      simplifyDebts({
        'traveler-1': { userId: 'traveler-1', paid: 10, owed: 10.004, net: -0 },
        'traveler-2': { userId: 'traveler-2', paid: 10, owed: 9.996, net: 0 },
      }),
    ).toEqual([])
  })
})

describe('budget display helpers', () => {
  it('formats USD currency for the budget hub', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  it('falls back to Other for unknown categories', () => {
    expect(categoryLabel('transport')).toBe('Transport')
    expect(categoryLabel('other')).toBe('Other')
  })
})
