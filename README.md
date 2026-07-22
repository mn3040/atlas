# Atlas

Plan trips visually. Organize every day. Discover what travelers actually recommend.

## Stack

React + TypeScript + Vite + Tailwind CSS, TomTom Maps SDK for Web, Google Places (search, photos, ratings,
Google Maps links), Supabase (Postgres, Auth, Realtime), deployed on Vercel.

## Local setup

```bash
npm install
cp .env.example .env   # fill in Supabase, TomTom, and Google Maps credentials
npm run dev
```

- **TomTom** (trip map): free key at [developer.tomtom.com](https://developer.tomtom.com/) →
  `VITE_TOMTOM_API_KEY`. Without it, the map pane shows an explanatory empty state instead of failing.
- **Google Maps** (place search/autocomplete, photos, ratings, "View on Google Maps" links, flight airport
  search): create a key in the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis) with
  billing enabled and the **Places API (New)** enabled → `VITE_GOOGLE_MAPS_API_KEY`. Restrict the key to your
  site's HTTP referrers (it ships in the browser bundle, same as the TomTom key). Without it, the location
  search inputs show an explanatory disabled state instead of failing. Google's Places API is metered/billed
  per request past the monthly free tier — see [Places API pricing](https://developers.google.com/maps/billing-and-pricing/pricing#places-pricing).

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql) — this creates `trips`, `trip_members`, `days`, `items` (flights/stays/activities), their RLS policies, and the trigger that adds a trip's creator as its `owner` member. It starts with `drop table if exists`, so it's safe to re-run.
3. Copy the project URL and **anon / publishable key** (Project Settings → API Keys) into `.env`. Don't use a personal access token (`sbp_...`) here — that's for the Supabase CLI/Management API, not client apps, and would be exposed publicly since it ships in the browser bundle.
4. Enable **Authentication → Sign In / Providers → Anonymous Sign-ins**. There's no login screen — the app signs each visitor in anonymously on load so RLS (`auth.uid()`) still applies, without any visible auth step.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new) — the Vite build is auto-detected (`npm run build`, output `dist/`).
3. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TOMTOM_API_KEY`, and `VITE_GOOGLE_MAPS_API_KEY` as Environment Variables in the Vercel project settings (same values as your local `.env`).
4. Every push to the connected branch redeploys automatically.

## Project structure

```
src/
  api/         Supabase client, typed data-access functions, Google Places search/details
  components/  Shared UI components (top nav, Google-backed place search input)
  pages/       Route-level pages (Dashboard, TripDetail)
  itinerary/   Timeline (DayLine/ItemStation), day selector, add/edit item modal, booking detail
  maps/        TomTom trip map (pins + flight paths), day pager, travel mode picker, transit card, zoom control
  calendar/    Month calendar view
  hooks/       Auth session hook (silent anonymous sign-in)
  types/       Shared TypeScript types
  utils/       Category/type icons, day-line color palette, distance/travel-time estimates, item action labels, flag emoji
supabase/
  schema.sql   Postgres schema + RLS policies
```
