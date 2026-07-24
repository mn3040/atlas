-- Run this in the Supabase SQL editor for your project.
-- Adds trip expense tracking with per-member splits (Budget Hub).

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  category text not null default 'other' check (category in ('transport', 'lodging', 'food', 'activities', 'shopping', 'other')),
  paid_by uuid not null references auth.users(id) on delete cascade,
  spent_on date not null default current_date,
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Per-member share of an expense. Rows are recreated on every edit rather
-- than diffed, since a single expense only ever has a handful of shares.
create table if not exists expense_shares (
  expense_id uuid not null references expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  share_amount numeric(10, 2) not null check (share_amount >= 0),
  primary key (expense_id, user_id)
);

create index if not exists expenses_trip_id_idx on expenses (trip_id);
create index if not exists expense_shares_expense_id_idx on expense_shares (expense_id);

alter table expenses enable row level security;
alter table expense_shares enable row level security;

drop policy if exists "members can view expenses" on expenses;
create policy "members can view expenses"
  on expenses for select
  using (is_trip_member(trip_id));

drop policy if exists "editors can create expenses" on expenses;
create policy "editors can create expenses"
  on expenses for insert
  with check (
    created_by = auth.uid()
    and trip_role(trip_id) in ('owner', 'editor')
    and is_trip_member(trip_id)
  );

drop policy if exists "editors can update expenses" on expenses;
create policy "editors can update expenses"
  on expenses for update
  using (trip_role(trip_id) in ('owner', 'editor'))
  with check (trip_role(trip_id) in ('owner', 'editor'));

drop policy if exists "editors can delete expenses" on expenses;
create policy "editors can delete expenses"
  on expenses for delete
  using (trip_role(trip_id) in ('owner', 'editor'));

drop policy if exists "members can view expense shares" on expense_shares;
create policy "members can view expense shares"
  on expense_shares for select
  using (
    exists (
      select 1 from expenses
      where expenses.id = expense_shares.expense_id
        and is_trip_member(expenses.trip_id)
    )
  );

drop policy if exists "editors can create expense shares" on expense_shares;
create policy "editors can create expense shares"
  on expense_shares for insert
  with check (
    exists (
      select 1 from expenses
      where expenses.id = expense_shares.expense_id
        and trip_role(expenses.trip_id) in ('owner', 'editor')
    )
  );

drop policy if exists "editors can update expense shares" on expense_shares;
create policy "editors can update expense shares"
  on expense_shares for update
  using (
    exists (
      select 1 from expenses
      where expenses.id = expense_shares.expense_id
        and trip_role(expenses.trip_id) in ('owner', 'editor')
    )
  )
  with check (
    exists (
      select 1 from expenses
      where expenses.id = expense_shares.expense_id
        and trip_role(expenses.trip_id) in ('owner', 'editor')
    )
  );

drop policy if exists "editors can delete expense shares" on expense_shares;
create policy "editors can delete expense shares"
  on expense_shares for delete
  using (
    exists (
      select 1 from expenses
      where expenses.id = expense_shares.expense_id
        and trip_role(expenses.trip_id) in ('owner', 'editor')
    )
  );
