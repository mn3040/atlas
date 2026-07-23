create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Traveler' check (char_length(display_name) between 1 and 48),
  avatar_color text not null default '#22dd85',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "users can view their own profile" on profiles;
create policy "users can view their own profile"
  on profiles for select
  using (user_id = auth.uid());

drop policy if exists "users can create their own profile" on profiles;
create policy "users can create their own profile"
  on profiles for insert
  with check (user_id = auth.uid());

drop policy if exists "users can update their own profile" on profiles;
create policy "users can update their own profile"
  on profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
