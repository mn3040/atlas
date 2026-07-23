create table if not exists trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists trip_invites_trip_id_idx on trip_invites (trip_id);

alter table trip_invites enable row level security;

drop policy if exists "members can view trip invites" on trip_invites;
create policy "members can view trip invites"
  on trip_invites for select
  using (is_trip_member(trip_id));

drop policy if exists "editors can create trip invites" on trip_invites;
create policy "editors can create trip invites"
  on trip_invites for insert
  with check (
    created_by = auth.uid()
    and trip_role(trip_id) in ('owner', 'editor')
  );

drop policy if exists "editors can revoke trip invites" on trip_invites;
create policy "editors can revoke trip invites"
  on trip_invites for update
  using (trip_role(trip_id) in ('owner', 'editor'))
  with check (trip_role(trip_id) in ('owner', 'editor'));

create or replace function join_trip_by_token(invite_token text)
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
