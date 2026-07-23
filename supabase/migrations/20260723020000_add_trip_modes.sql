alter table trips
add column if not exists visibility text not null default 'personal'
  check (visibility in ('personal', 'group')),
add column if not exists member_limit integer check (member_limit is null or member_limit between 1 and 99),
add column if not exists archived_at timestamptz;
