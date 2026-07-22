# Atlas

Plan trips visually. Organize every day. Discover what travelers actually recommend.

## Stack

React + TypeScript + Vite + Tailwind CSS, MapLibre GL (OpenFreeMap tiles), Supabase (Postgres, Auth, Realtime), deployed on Vercel.

## Local setup

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql) — this creates `trips`, `trip_members`, `days`, `stops`, their RLS policies, and the trigger that adds a trip's creator as its `owner` member.
3. Copy the project URL and anon key (Project Settings → API) into `.env`.
4. Sign-in uses Supabase's magic-link email auth — no password flow to configure.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new) — the Vite build is auto-detected (`npm run build`, output `dist/`).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Environment Variables in the Vercel project settings (same values as your local `.env`).
4. Every push to the connected branch redeploys automatically.

## Project structure

```
src/
  api/         Supabase client + typed data-access functions
  components/  Shared UI components
  pages/       Route-level pages (Dashboard, TripDetail, SignIn)
  itinerary/   Day/stop timeline (the line-map component)
  maps/        MapLibre trip map
  calendar/    Month calendar view
  hooks/       Zustand store, auth session hook
  types/       Shared TypeScript types
  utils/       Category icons, day-line color palette
supabase/
  schema.sql   Postgres schema + RLS policies
```
