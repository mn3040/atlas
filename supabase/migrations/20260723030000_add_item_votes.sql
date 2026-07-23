create table if not exists item_votes (
  trip_id uuid not null references trips(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null default 'must_see' check (vote in ('must_see')),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index if not exists item_votes_trip_id_idx on item_votes (trip_id);

alter table item_votes enable row level security;

drop policy if exists "members can view item votes" on item_votes;
create policy "members can view item votes"
  on item_votes for select
  using (is_trip_member(trip_id));

drop policy if exists "members can create their own item votes" on item_votes;
create policy "members can create their own item votes"
  on item_votes for insert
  with check (
    user_id = auth.uid()
    and is_trip_member(trip_id)
    and exists (
      select 1 from items
      where items.id = item_votes.item_id
        and items.trip_id = item_votes.trip_id
    )
  );

drop policy if exists "members can update their own item votes" on item_votes;
create policy "members can update their own item votes"
  on item_votes for update
  using (user_id = auth.uid() and is_trip_member(trip_id))
  with check (
    user_id = auth.uid()
    and is_trip_member(trip_id)
    and exists (
      select 1 from items
      where items.id = item_votes.item_id
        and items.trip_id = item_votes.trip_id
    )
  );

drop policy if exists "members can delete their own item votes" on item_votes;
create policy "members can delete their own item votes"
  on item_votes for delete
  using (user_id = auth.uid() and is_trip_member(trip_id));

drop policy if exists "members can view profiles for shared trips" on profiles;
create policy "members can view profiles for shared trips"
  on profiles for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from trip_members viewer
      join trip_members subject on subject.trip_id = viewer.trip_id
      where viewer.user_id = auth.uid()
        and subject.user_id = profiles.user_id
    )
  );
