# Atlas

Atlas is a cinematic itinerary planner for building trips around places, days, routes, and group decisions.

The core loop: import or create a trip, shape the day-by-day itinerary, see every stop on the map, vote on what matters, then export a polished trip plan.

## Features

**Itinerary**
- Visual day-by-day itinerary with activities, flights, and stays.
- Mobile-first trip detail screen with map on top and a draggable itinerary sheet below.
- TomTom map pins that update when locations are added, edited, removed, or filtered.
- Animated flight markers from departure to arrival.
- Real booking/search links for activities, flights, and stays.
- Schedule warnings for overlaps, tight transfers, long transfers, and impractical route modes.
- Multi-country trip support derived from itinerary stop countries.

**Import & export**
- PDF/DOCX/TXT/Markdown itinerary import with editable review before saving.
- Mobile Safari PDF import fallback through a Vercel serverless extractor.
- Beautiful themed PDF export for the full trip.

**Group trips**
- Invite links, lightweight traveler profiles, and must-see voting.
- Realtime group vote updates through Supabase Realtime.
- Decision mode for ranking day options and locking final group picks.

**Budget & documents**
- Budget hub for tracking and splitting trip expenses across travelers.
- Document wallet for passports, visas, and booking confirmations.

**Other**
- Sample trips for validating multi-day, multi-activity itineraries.

## Stack

React + TypeScript + Vite + Tailwind CSS, TomTom Maps SDK for Web, Nominatim/OpenStreetMap place search, Supabase (Postgres/Auth/Realtime), and Vercel.

## Brand Identity

Atlas uses a dark expedition-control aesthetic, favoring cinematic motion over static dashboards: staggered page reveals, glowing route rails, animated map pins, floating brand artwork, mobile bottom-sheet motion, and slow flight movement from departure to arrival.

| Name | Hex |
| --- | --- |
| Ink | `#070606` |
| Deep map teal | `#083740` |
| Paper highlight | `#F7FF88` |
| Atlas green | `#22DD85` |
| Clean white | `#FEFEFE` |

Brand assets live in `public/atlas-mark.svg` and `public/assets/`.

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

Fill in `.env`:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_TOMTOM_API_KEY=
```

TomTom powers the live map and route fetching. Without `VITE_TOMTOM_API_KEY`, the app shows a friendly map empty state instead of crashing. Place search uses Nominatim/OpenStreetMap; Google Maps links are generated as location search links, not raw coordinate dumps.

## Supabase Setup

1. Create a Supabase project.
2. Enable Authentication → Sign In / Providers → Anonymous sign-ins.
3. Run `supabase/schema.sql` in the SQL editor for a fresh setup.
4. Run every migration in `supabase/migrations/`, in order — they add item country codes, traveler profiles, personal/group trip modes, must-see votes, invite links, locked group decisions, expenses, and trip documents.
5. In Supabase Realtime, enable realtime publication for `item_votes` and `item_decisions`.

Atlas intentionally keeps the collaboration profile minimal: display name, avatar color, anonymous auth id, votes, and locked decisions. It does not collect phone numbers, contacts, demographic data, or background location history.

## Testing

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

A GitHub Actions workflow (`.github/workflows/test.yml`) runs lint, a type check, and the test suite on every push and pull request to `main`.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Build command `npm run build`; output directory `dist/`.
3. Add the same environment variables from `.env` to Vercel.
4. Keep `vercel.json` — it preserves API routes and routes direct trip links back to the React app.

The mobile PDF import fallback runs as a Vercel serverless function at `api/extract-document.ts`, extracting PDF text server-side when mobile Safari can't run browser-side PDF parsing reliably.

## Project Structure

```text
api/          Vercel serverless functions
public/       Logo and brand assets
src/api/      Supabase, place search, routing, votes, decisions, budget, documents
src/components/
src/hooks/
src/itinerary/
src/maps/
src/pages/
src/types/
src/utils/
supabase/     Schema and migrations
```

## Quality Checks

```bash
npm run build
npm run lint
npm test
```
