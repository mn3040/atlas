# Atlas

Plan trips visually. Organize every day. Discover what travelers actually recommend.

## Stack

React + TypeScript + Vite + Tailwind CSS, MapLibre GL (OpenFreeMap tiles), Nominatim (place search), Supabase (Postgres, Auth, Realtime), deployed on Vercel.

## Local setup

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql) — this creates `trips`, `trip_members`, `days`, `items` (flights/stays/activities), their RLS policies, and the trigger that adds a trip's creator as its `owner` member. It starts with `drop table if exists`, so it's safe to re-run.
3. Copy the project URL and **anon / publishable key** (Project Settings → API Keys) into `.env`. Don't use a personal access token (`sbp_...`) here — that's for the Supabase CLI/Management API, not client apps, and would be exposed publicly since it ships in the browser bundle.
4. Enable **Authentication → Sign In / Providers → Anonymous Sign-ins**. There's no login screen — the app signs each visitor in anonymously on load so RLS (`auth.uid()`) still applies, without any visible auth step.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new) — the Vite build is auto-detected (`npm run build`, output `dist/`).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Environment Variables in the Vercel project settings (same values as your local `.env`).
4. Every push to the connected branch redeploys automatically.

## Project structure

```
src/
  api/         Supabase client, typed data-access functions, place search (Nominatim)
  components/  Shared UI components (place search input)
  pages/       Route-level pages (Dashboard, TripDetail)
  itinerary/   Line-map timeline, add-item modal, stays list
  maps/        MapLibre trip map (pins + flight paths)
  calendar/    Month calendar view
  hooks/       Auth session hook (silent anonymous sign-in)
  types/       Shared TypeScript types
  utils/       Category/type icons, day-line color palette
supabase/
  schema.sql   Postgres schema + RLS policies
```
