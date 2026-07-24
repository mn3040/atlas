-- Stop notes: short comments anchored to a single item ("who's driving to
-- this one?"), not a trip-wide chat feed. Realtime-subscribed the same way
-- item_votes/item_decisions are.
create table if not exists item_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists item_notes_trip_id_idx on item_notes (trip_id);
create index if not exists item_notes_item_id_idx on item_notes (item_id);

alter table item_notes enable row level security;

drop policy if exists "members can view item notes" on item_notes;
create policy "members can view item notes"
  on item_notes for select
  using (is_trip_member(trip_id));

drop policy if exists "members can create their own item notes" on item_notes;
create policy "members can create their own item notes"
  on item_notes for insert
  with check (
    user_id = auth.uid()
    and is_trip_member(trip_id)
    and exists (
      select 1 from items
      where items.id = item_notes.item_id
        and items.trip_id = item_notes.trip_id
    )
  );

drop policy if exists "authors can delete their own item notes" on item_notes;
create policy "authors can delete their own item notes"
  on item_notes for delete
  using (user_id = auth.uid());

drop policy if exists "editors can delete any item note" on item_notes;
create policy "editors can delete any item note"
  on item_notes for delete
  using (trip_role(trip_id) in ('owner', 'editor'));
