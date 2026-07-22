-- Run this in the Supabase SQL editor for your project.
-- Replaces any earlier version of this schema — safe to run fresh since no
-- production data depends on the old `stops` table yet.

drop table if exists stops cascade;
drop table if exists days cascade;
drop table if exists trip_members cascade;
drop table if exists trips cascade;

create table trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create table trip_members (
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  primary key (trip_id, user_id)
);

create table days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  date date not null
);

-- One table covers every kind of thing on a trip: flights, stays, and
-- activities. Type-specific columns are nullable and only used by their type.
create table items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  day_id uuid references days(id) on delete set null,
  type text not null check (type in ('activity', 'flight', 'stay')),
  category text check (category in ('food', 'attraction', 'transport', 'shopping', 'nature', 'other')),

  name text not null,
  notes text,

  -- Primary location: the activity's place, the flight's departure airport,
  -- or the stay's address.
  lat double precision not null,
  lng double precision not null,
  location_label text,

  -- Secondary location: only used by flights, for the arrival airport.
  lat2 double precision,
  lng2 double precision,
  location2_label text,

  -- Activity/flight: the single day it happens. Stay: check-in date.
  start_date date not null,
  -- Stay: check-out date. Flight: arrival date if it lands the next day.
  end_date date,

  start_time time,
  end_time time,
  flight_number text,

  position integer not null default 0
);

alter table trips enable row level security;
alter table trip_members enable row level security;
alter table days enable row level security;
alter table items enable row level security;

create policy "members can view their trips"
  on trips for select
  using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = trips.id
        and trip_members.user_id = auth.uid()
    )
  );

create policy "owners can insert trips"
  on trips for insert
  with check (owner_id = auth.uid());

create policy "editors and owners can update trips"
  on trips for update
  using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = trips.id
        and trip_members.user_id = auth.uid()
        and trip_members.role in ('owner', 'editor')
    )
  );

create policy "members can view trip membership"
  on trip_members for select
  using (
    exists (
      select 1 from trip_members as tm
      where tm.trip_id = trip_members.trip_id
        and tm.user_id = auth.uid()
    )
  );

create policy "members can view days"
  on days for select
  using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = days.trip_id
        and trip_members.user_id = auth.uid()
    )
  );

create policy "editors and owners can modify days"
  on days for all
  using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = days.trip_id
        and trip_members.user_id = auth.uid()
        and trip_members.role in ('owner', 'editor')
    )
  );

create policy "members can view items"
  on items for select
  using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = items.trip_id
        and trip_members.user_id = auth.uid()
    )
  );

create policy "editors and owners can modify items"
  on items for all
  using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = items.trip_id
        and trip_members.user_id = auth.uid()
        and trip_members.role in ('owner', 'editor')
    )
  );

-- Automatically add the creator as an 'owner' member when a trip is created.

create function handle_new_trip()
returns trigger as $$
begin
  insert into trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_trip_created
  after insert on trips
  for each row execute function handle_new_trip();
