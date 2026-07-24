-- Run this in the Supabase SQL editor for your project.
-- Enforces the same size/type limits on the trip-documents bucket server-side
-- that the app already checks client-side, so the constraint holds even if
-- a request bypasses the app.

update storage.buckets
set
  file_size_limit = 12582912,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'trip-documents';
