-- Run this in the Supabase SQL editor for your project.
-- Adds the Document Wallet: passports, visas, confirmations, etc. stored
-- per trip, with files in a private Storage bucket.

create table if not exists trip_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  type text not null default 'other' check (type in ('passport', 'visa', 'boarding_pass', 'confirmation', 'insurance', 'other')),
  title text not null,
  document_number text,
  issuing_country text,
  expiry_date date,
  notes text,
  -- Path within the 'trip-documents' storage bucket, formatted
  -- '<trip_id>/<uuid>-<filename>'. Null when the entry has no attached file.
  file_path text,
  file_name text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists trip_documents_trip_id_idx on trip_documents (trip_id);

alter table trip_documents enable row level security;

drop policy if exists "members can view trip documents" on trip_documents;
create policy "members can view trip documents"
  on trip_documents for select
  using (is_trip_member(trip_id));

drop policy if exists "editors can create trip documents" on trip_documents;
create policy "editors can create trip documents"
  on trip_documents for insert
  with check (
    uploaded_by = auth.uid()
    and trip_role(trip_id) in ('owner', 'editor')
    and is_trip_member(trip_id)
  );

drop policy if exists "editors can update trip documents" on trip_documents;
create policy "editors can update trip documents"
  on trip_documents for update
  using (trip_role(trip_id) in ('owner', 'editor'))
  with check (trip_role(trip_id) in ('owner', 'editor'));

drop policy if exists "editors can delete trip documents" on trip_documents;
create policy "editors can delete trip documents"
  on trip_documents for delete
  using (trip_role(trip_id) in ('owner', 'editor'));

-- Private bucket -- files are only ever reached through short-lived signed
-- URLs generated on demand, never a public link (documents may hold
-- passport/visa numbers).
insert into storage.buckets (id, name, public)
values ('trip-documents', 'trip-documents', false)
on conflict (id) do nothing;

-- Objects are uploaded by the app as '<trip_id>/<uuid>-<filename>', so the
-- first path segment is always the owning trip's id. This relies on the app
-- being the only writer to this bucket with that path format.
drop policy if exists "trip documents: members can view files" on storage.objects;
create policy "trip documents: members can view files"
  on storage.objects for select
  using (
    bucket_id = 'trip-documents'
    and is_trip_member((split_part(name, '/', 1))::uuid)
  );

drop policy if exists "trip documents: editors can upload files" on storage.objects;
create policy "trip documents: editors can upload files"
  on storage.objects for insert
  with check (
    bucket_id = 'trip-documents'
    and trip_role((split_part(name, '/', 1))::uuid) in ('owner', 'editor')
  );

drop policy if exists "trip documents: editors can delete files" on storage.objects;
create policy "trip documents: editors can delete files"
  on storage.objects for delete
  using (
    bucket_id = 'trip-documents'
    and trip_role((split_part(name, '/', 1))::uuid) in ('owner', 'editor')
  );
