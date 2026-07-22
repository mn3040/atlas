-- Run this in the Supabase SQL editor for your project.
-- Core Phase 0 schema: trips, days, stops, and membership for collaboration.

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

create table stops (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  lat double precision not null,
  lng double precision not null,
  start_time time,
  notes text,
  "order" integer not null default 0
);

-- Row Level Security: users can only see/edit trips they're a member of.

alter table trips enable row level security;
alter table trip_members enable row level security;
alter table days enable row level security;
alter table stops enable row level security;

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

create policy "members can view stops"
  on stops for select
  using (
    exists (
      select 1 from days
      join trip_members on trip_members.trip_id = days.trip_id
      where days.id = stops.day_id
        and trip_members.user_id = auth.uid()
    )
  );

create policy "editors and owners can modify stops"
  on stops for all
  using (
    exists (
      select 1 from days
      join trip_members on trip_members.trip_id = days.trip_id
      where days.id = stops.day_id
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
