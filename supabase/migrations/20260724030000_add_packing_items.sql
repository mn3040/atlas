-- Run this in the Supabase SQL editor for your project.
-- Adds the trip Packing List: a shared checklist seeded from trip length,
-- destination weather, and the activity types already on the itinerary.

create table if not exists packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  label text not null,
  category text not null default 'other' check (category in ('clothing', 'documents', 'toiletries', 'electronics', 'gear', 'other')),
  packed boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists packing_items_trip_id_idx on packing_items (trip_id);

alter table packing_items enable row level security;

drop policy if exists "members can view packing items" on packing_items;
create policy "members can view packing items"
  on packing_items for select
  using (is_trip_member(trip_id));

drop policy if exists "editors can create packing items" on packing_items;
create policy "editors can create packing items"
  on packing_items for insert
  with check (
    created_by = auth.uid()
    and trip_role(trip_id) in ('owner', 'editor')
    and is_trip_member(trip_id)
  );

drop policy if exists "editors can update packing items" on packing_items;
create policy "editors can update packing items"
  on packing_items for update
  using (trip_role(trip_id) in ('owner', 'editor'))
  with check (trip_role(trip_id) in ('owner', 'editor'));

drop policy if exists "editors can delete packing items" on packing_items;
create policy "editors can delete packing items"
  on packing_items for delete
  using (trip_role(trip_id) in ('owner', 'editor'));
