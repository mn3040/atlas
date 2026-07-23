-- Run this in the Supabase SQL editor for your project.
-- Replaces any earlier version of this schema — safe to run fresh since no
-- production data depends on the old tables yet.

drop table if exists items cascade;
drop table if exists item_votes cascade;
drop table if exists trip_invites cascade;
drop table if exists stops cascade;
drop table if exists days cascade;
drop table if exists trip_members cascade;
drop table if exists trips cascade;
drop table if exists profiles cascade;
drop function if exists is_trip_member(uuid);
drop function if exists trip_role(uuid);
drop function if exists join_trip_by_token(text);
drop function if exists handle_new_trip();

create table trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  -- ISO 3166-1 alpha-2, e.g. 'KZ' — drives the flag shown next to the trip dates.
  country_code text,
  visibility text not null default 'personal' check (visibility in ('personal', 'group')),
  member_limit integer check (member_limit is null or member_limit between 1 and 99),
  archived_at timestamptz,
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

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Traveler' check (char_length(display_name) between 1 and 48),
  avatar_color text not null default '#22dd85',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  date date not null,
  label text
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
  country_code text,

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

  -- Free-form display text for the timeline card, e.g. "$95.00 per night",
  -- "Avg $18.00 per person", "Free entry", "Included in Flight Ticket".
  price_label text,
  photo_url text,

  -- Google Places — set when the item's location was picked from Google
  -- Places search, so cards can link out and show a real photo/rating.
  google_place_id text,
  google_maps_url text,
  google_rating numeric(2, 1),
  google_user_ratings_total integer,

  -- Booking detail — only used when type = 'stay'.
  room_type text,
  guests integer,
  nightly_rate numeric(10, 2),
  taxes_fees numeric(10, 2),
  confirmation_number text,
  rating smallint check (rating between 1 and 5),

  position integer not null default 0
);

create table item_votes (
  trip_id uuid not null references trips(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null default 'must_see' check (vote in ('must_see')),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index item_votes_trip_id_idx on item_votes (trip_id);

create table trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index trip_invites_trip_id_idx on trip_invites (trip_id);

-- Helper functions used by RLS policies below.
--
-- These run as SECURITY DEFINER so their internal queries against
-- trip_members bypass RLS. Without this, a policy on trip_members that
-- queries trip_members to check membership recurses into itself --
-- Postgres has no way to evaluate "can this row be read" without first
-- evaluating the same policy on the rows the check itself reads.

create function is_trip_member(_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from trip_members
    where trip_id = _trip_id and user_id = auth.uid()
  );
$$;

create function trip_role(_trip_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from trip_members
  where trip_id = _trip_id and user_id = auth.uid()
  limit 1;
$$;

alter table trips enable row level security;
alter table trip_members enable row level security;
alter table profiles enable row level security;
alter table days enable row level security;
alter table items enable row level security;
alter table item_votes enable row level security;
alter table trip_invites enable row level security;

create policy "members can view their trips"
  on trips for select
  using (owner_id = auth.uid() or is_trip_member(id));

create policy "owners can insert trips"
  on trips for insert
  with check (owner_id = auth.uid());

create policy "editors and owners can update trips"
  on trips for update
  using (trip_role(id) in ('owner', 'editor'));

create policy "owners can delete trips"
  on trips for delete
  using (trip_role(id) = 'owner');

create policy "members can view trip membership"
  on trip_members for select
  using (is_trip_member(trip_id));

create policy "users can view their own profile"
  on profiles for select
  using (user_id = auth.uid());

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

create policy "users can create their own profile"
  on profiles for insert
  with check (user_id = auth.uid());

create policy "users can update their own profile"
  on profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "members can view days"
  on days for select
  using (is_trip_member(trip_id));

create policy "editors and owners can modify days"
  on days for all
  using (trip_role(trip_id) in ('owner', 'editor'));

create policy "members can view items"
  on items for select
  using (is_trip_member(trip_id));

create policy "editors and owners can modify items"
  on items for all
  using (trip_role(trip_id) in ('owner', 'editor'));

create policy "members can view item votes"
  on item_votes for select
  using (is_trip_member(trip_id));

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

create policy "members can delete their own item votes"
  on item_votes for delete
  using (user_id = auth.uid() and is_trip_member(trip_id));

create policy "members can view trip invites"
  on trip_invites for select
  using (is_trip_member(trip_id));

create policy "editors can create trip invites"
  on trip_invites for insert
  with check (
    created_by = auth.uid()
    and trip_role(trip_id) in ('owner', 'editor')
  );

create policy "editors can revoke trip invites"
  on trip_invites for update
  using (trip_role(trip_id) in ('owner', 'editor'))
  with check (trip_role(trip_id) in ('owner', 'editor'));

create function join_trip_by_token(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_trip_id uuid;
  trip_limit integer;
  member_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select trip_invites.trip_id, trips.member_limit
    into invite_trip_id, trip_limit
  from trip_invites
  join trips on trips.id = trip_invites.trip_id
  where trip_invites.token = invite_token
    and trip_invites.revoked_at is null
    and (trip_invites.expires_at is null or trip_invites.expires_at > now())
    and trips.visibility = 'group'
  limit 1;

  if invite_trip_id is null then
    raise exception 'Invite is invalid or expired';
  end if;

  select count(*) into member_count
  from trip_members
  where trip_id = invite_trip_id;

  if trip_limit is not null and member_count >= trip_limit and not is_trip_member(invite_trip_id) then
    raise exception 'This trip is already full';
  end if;

  insert into trip_members (trip_id, user_id, role)
  values (invite_trip_id, auth.uid(), 'viewer')
  on conflict (trip_id, user_id) do nothing;

  return invite_trip_id;
end;
$$;

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
