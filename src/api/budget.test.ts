import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('./supabaseClient', () => ({
  supabase: { from: fromMock },
}))

import { createExpense, deleteExpense, fetchExpenses, isMissingExpensesTable, updateExpense } from './budget'

// Mirrors supabase-js's PostgrestFilterBuilder: every filter/select method
// returns the same chainable, and the chain itself is awaitable (thenable),
// so both `.eq().order().order()` and `.eq().single()` resolve correctly.
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

const expenseRow = {
  id: 'expense-1',
  trip_id: 'trip-1',
  description: 'Dinner',
  amount: 60,
  category: 'food',
  paid_by: 'user-1',
  spent_on: '2026-03-02',
  notes: null,
  created_by: 'user-1',
  created_at: '2026-03-02T00:00:00Z',
  expense_shares: [
    { expense_id: 'expense-1', user_id: 'user-1', share_amount: 30 },
    { expense_id: 'expense-1', user_id: 'user-2', share_amount: 30 },
  ],
}

const mappedExpense = {
  id: 'expense-1',
  tripId: 'trip-1',
  description: 'Dinner',
  amount: 60,
  category: 'food',
  paidBy: 'user-1',
  spentOn: '2026-03-02',
  notes: null,
  createdBy: 'user-1',
  createdAt: '2026-03-02T00:00:00Z',
  shares: [
    { expenseId: 'expense-1', userId: 'user-1', shareAmount: 30 },
    { expenseId: 'expense-1', userId: 'user-2', shareAmount: 30 },
  ],
}

beforeEach(() => {
  fromMock.mockReset()
})

describe('fetchExpenses', () => {
  it('maps snake_case rows (with nested shares) to camelCase Expense objects', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: [expenseRow], error: null }))

    const expenses = await fetchExpenses('trip-1')

    expect(fromMock).toHaveBeenCalledWith('expenses')
    expect(expenses).toEqual([mappedExpense])
  })

  it('throws when the query errors', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: new Error('boom') }))

    await expect(fetchExpenses('trip-1')).rejects.toThrow('boom')
  })
})

describe('createExpense', () => {
  it('inserts the expense, then its shares, then refetches the full row', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'expense-1' }, error: null })
    const sharesBuilder = { insert: vi.fn(() => Promise.resolve({ error: null })) }
    const refetchBuilder = makeQueryBuilder({ data: expenseRow, error: null })

    fromMock
      .mockReturnValueOnce(insertBuilder) // expenses insert
      .mockReturnValueOnce(sharesBuilder) // expense_shares insert
      .mockReturnValueOnce(refetchBuilder) // fetchExpense refetch

    const result = await createExpense(
      'trip-1',
      'user-1',
      { description: 'Dinner', amount: 60, category: 'food', paidBy: 'user-1', spentOn: '2026-03-02', notes: null },
      [
        { userId: 'user-1', shareAmount: 30 },
        { userId: 'user-2', shareAmount: 30 },
      ],
    )

    expect(fromMock).toHaveBeenNthCalledWith(1, 'expenses')
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: 'trip-1', created_by: 'user-1', description: 'Dinner' }),
    )
    expect(fromMock).toHaveBeenNthCalledWith(2, 'expense_shares')
    expect(sharesBuilder.insert).toHaveBeenCalledWith([
      { expense_id: 'expense-1', user_id: 'user-1', share_amount: 30 },
      { expense_id: 'expense-1', user_id: 'user-2', share_amount: 30 },
    ])
    expect(result).toEqual(mappedExpense)
  })

  it('skips the shares insert when there are no shares', async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: 'expense-1' }, error: null })
    const refetchBuilder = makeQueryBuilder({ data: expenseRow, error: null })
    fromMock.mockReturnValueOnce(insertBuilder).mockReturnValueOnce(refetchBuilder)

    await createExpense(
      'trip-1',
      'user-1',
      { description: 'Dinner', amount: 60, category: 'food', paidBy: 'user-1', spentOn: '2026-03-02', notes: null },
      [],
    )

    expect(fromMock).toHaveBeenCalledTimes(2)
  })

  it('throws when the expense insert errors', async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: new Error('insert failed') }))

    await expect(
      createExpense(
        'trip-1',
        'user-1',
        { description: 'Dinner', amount: 60, category: 'food', paidBy: 'user-1', spentOn: '2026-03-02', notes: null },
        [],
      ),
    ).rejects.toThrow('insert failed')
  })
})

describe('updateExpense', () => {
  it('updates the expense, replaces its shares, then refetches', async () => {
    const updateBuilder = makeQueryBuilder({ data: null, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const sharesBuilder = { insert: vi.fn(() => Promise.resolve({ error: null })) }
    const refetchBuilder = makeQueryBuilder({ data: expenseRow, error: null })

    fromMock
      .mockReturnValueOnce(updateBuilder) // expenses update
      .mockReturnValueOnce(deleteBuilder) // expense_shares delete
      .mockReturnValueOnce(sharesBuilder) // expense_shares insert
      .mockReturnValueOnce(refetchBuilder) // fetchExpense refetch

    const result = await updateExpense(
      'expense-1',
      { description: 'Dinner (split)', amount: 60, category: 'food', paidBy: 'user-1', spentOn: '2026-03-02', notes: null },
      [{ userId: 'user-1', shareAmount: 60 }],
    )

    expect(fromMock).toHaveBeenNthCalledWith(1, 'expenses')
    expect(fromMock).toHaveBeenNthCalledWith(2, 'expense_shares')
    expect(fromMock).toHaveBeenNthCalledWith(3, 'expense_shares')
    expect(sharesBuilder.insert).toHaveBeenCalledWith([{ expense_id: 'expense-1', user_id: 'user-1', share_amount: 60 }])
    expect(result).toEqual(mappedExpense)
  })

  it('throws when the update errors', async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: new Error('update failed') }))

    await expect(
      updateExpense(
        'expense-1',
        { description: 'Dinner', amount: 60, category: 'food', paidBy: 'user-1', spentOn: '2026-03-02', notes: null },
        [],
      ),
    ).rejects.toThrow('update failed')
  })
})

describe('deleteExpense', () => {
  it('deletes the expense by id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValueOnce(builder)

    await deleteExpense('expense-1')

    expect(fromMock).toHaveBeenCalledWith('expenses')
    expect(builder.delete).toHaveBeenCalled()
  })

  it('throws when the delete errors', async () => {
    fromMock.mockReturnValueOnce(makeQueryBuilder({ data: null, error: new Error('delete failed') }))

    await expect(deleteExpense('expense-1')).rejects.toThrow('delete failed')
  })
})

describe('isMissingExpensesTable', () => {
  it('recognizes missing-table style errors', () => {
    expect(isMissingExpensesTable(new Error('relation "expenses" does not exist'))).toBe(true)
    expect(isMissingExpensesTable(new Error('Could not find the table expense_shares in schema cache'))).toBe(true)
    expect(isMissingExpensesTable(new Error('permission denied for table trips'))).toBe(false)
  })
})
