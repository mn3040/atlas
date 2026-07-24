import { supabase } from './supabaseClient'
import type { Expense, ExpenseCategory, ExpenseShare } from '../types/trip'

interface ExpenseShareRow {
  expense_id: string
  user_id: string
  share_amount: number
}

interface ExpenseRow {
  id: string
  trip_id: string
  description: string
  amount: number
  category: ExpenseCategory
  paid_by: string
  spent_on: string
  notes: string | null
  created_by: string
  created_at: string
  expense_shares: ExpenseShareRow[] | null
}

function mapShare(row: ExpenseShareRow): ExpenseShare {
  return { expenseId: row.expense_id, userId: row.user_id, shareAmount: row.share_amount }
}

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    tripId: row.trip_id,
    description: row.description,
    amount: row.amount,
    category: row.category,
    paidBy: row.paid_by,
    spentOn: row.spent_on,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    shares: (row.expense_shares ?? []).map(mapShare),
  }
}

export function isMissingExpensesTable(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase()
  return (
    message.includes('expenses') ||
    message.includes('expense_shares') ||
    message.includes('schema cache') ||
    message.includes('could not find the table')
  )
}

export async function fetchExpenses(tripId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id,trip_id,description,amount,category,paid_by,spent_on,notes,created_by,created_at,expense_shares(expense_id,user_id,share_amount)')
    .eq('trip_id', tripId)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as unknown as ExpenseRow[]).map(mapExpense)
}

export interface ExpenseInput {
  description: string
  amount: number
  category: ExpenseCategory
  paidBy: string
  spentOn: string
  notes: string | null
}

export async function createExpense(
  tripId: string,
  userId: string,
  input: ExpenseInput,
  shares: { userId: string; shareAmount: number }[],
): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      trip_id: tripId,
      description: input.description,
      amount: input.amount,
      category: input.category,
      paid_by: input.paidBy,
      spent_on: input.spentOn,
      notes: input.notes,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) throw error
  const expenseId = (data as { id: string }).id

  if (shares.length > 0) {
    const { error: shareError } = await supabase.from('expense_shares').insert(
      shares.map((share) => ({ expense_id: expenseId, user_id: share.userId, share_amount: share.shareAmount })),
    )
    if (shareError) throw shareError
  }

  return fetchExpense(expenseId)
}

export async function updateExpense(
  expenseId: string,
  input: ExpenseInput,
  shares: { userId: string; shareAmount: number }[],
): Promise<Expense> {
  const { error } = await supabase
    .from('expenses')
    .update({
      description: input.description,
      amount: input.amount,
      category: input.category,
      paid_by: input.paidBy,
      spent_on: input.spentOn,
      notes: input.notes,
    })
    .eq('id', expenseId)

  if (error) throw error

  const { error: deleteError } = await supabase.from('expense_shares').delete().eq('expense_id', expenseId)
  if (deleteError) throw deleteError

  if (shares.length > 0) {
    const { error: shareError } = await supabase.from('expense_shares').insert(
      shares.map((share) => ({ expense_id: expenseId, user_id: share.userId, share_amount: share.shareAmount })),
    )
    if (shareError) throw shareError
  }

  return fetchExpense(expenseId)
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (error) throw error
}

async function fetchExpense(expenseId: string): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id,trip_id,description,amount,category,paid_by,spent_on,notes,created_by,created_at,expense_shares(expense_id,user_id,share_amount)')
    .eq('id', expenseId)
    .single()

  if (error) throw error
  return mapExpense(data as unknown as ExpenseRow)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '')
  return String(error ?? '')
}
