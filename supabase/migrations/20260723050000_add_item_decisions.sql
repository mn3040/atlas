create table if not exists item_decisions (
  trip_id uuid not null references trips(id) on delete cascade,
  day_id uuid not null references days(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  decided_by uuid not null references auth.users(id) on delete cascade,
  decided_at timestamptz not null default now(),
  primary key (day_id)
);

create index if not exists item_decisions_trip_id_idx on item_decisions (trip_id);
create index if not exists item_decisions_item_id_idx on item_decisions (item_id);

alter table item_decisions enable row level security;

drop policy if exists "members can view item decisions" on item_decisions;
create policy "members can view item decisions"
  on item_decisions for select
  using (is_trip_member(trip_id));

drop policy if exists "editors can create item decisions" on item_decisions;
create policy "editors can create item decisions"
  on item_decisions for insert
  with check (
    decided_by = auth.uid()
    and trip_role(trip_id) in ('owner', 'editor')
    and exists (
      select 1
      from items
      where items.id = item_decisions.item_id
        and items.trip_id = item_decisions.trip_id
        and items.day_id = item_decisions.day_id
    )
  );

drop policy if exists "editors can update item decisions" on item_decisions;
create policy "editors can update item decisions"
  on item_decisions for update
  using (trip_role(trip_id) in ('owner', 'editor'))
  with check (
    decided_by = auth.uid()
    and trip_role(trip_id) in ('owner', 'editor')
    and exists (
      select 1
      from items
      where items.id = item_decisions.item_id
        and items.trip_id = item_decisions.trip_id
        and items.day_id = item_decisions.day_id
    )
  );

drop policy if exists "editors can delete item decisions" on item_decisions;
create policy "editors can delete item decisions"
  on item_decisions for delete
  using (trip_role(trip_id) in ('owner', 'editor'));
