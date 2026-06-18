# Hiker

An offline-first mobile app for hikers, focused on Taiwan trails. Record your
hike, follow routes, stay safe, and keep a logbook — all working without a signal
on the mountain. Built with Expo (React Native) and MapLibre + OpenStreetMap.

All data is stored **on-device** (SQLite). There is no backend or account in this
version; a cloud sync layer can be added later without changing the data model.

## Features

- **Map & track recording** — live GPS tracking with a background location task,
  route polyline, and live stats (distance, duration, ascent, pace). Recording
  survives the app being backgrounded or restarted.
- **Offline maps** — download bounded regions (Yushan, Xueshan, Hehuanshan,
  Yangmingshan presets) as offline tile packs from **Settings**.
- **Routes** — browse seeded Taiwan trails, search, view a route with its map and
  elevation/difficulty, and **import GPX** files.
- **Journal** — every recorded hike is saved with stats, notes, and lifetime
  totals. Export any hike as **GPX**.
- **Safety** — one-tap **SOS** that sends your live coordinates to your emergency
  contacts (SMS/share) or calls 119, plus offline Taiwan emergency numbers and
  safety tips.

## Tech stack

| Concern         | Library                               |
| --------------- | ------------------------------------- |
| Framework       | Expo / React Native (TypeScript)      |
| Navigation      | `expo-router`                         |
| Maps            | `@maplibre/maplibre-react-native`     |
| Location        | `expo-location` + `expo-task-manager` |
| Local database  | `expo-sqlite`                         |
| Files / sharing | `expo-file-system`, `expo-sharing`    |
| State           | `zustand`                             |
| GPX parsing     | `fast-xml-parser`                     |

## Requirements

MapLibre and the background location task are **native modules**, so this app
cannot run in Expo Go. You need a development build:

- Node 18+ and npm
- Xcode (iOS) and/or Android Studio (Android)

## Getting started

```bash
npm install

# Generate native projects (ios/ and android/)
npx expo prebuild

# Run on a device or simulator
npx expo run:ios
# or
npx expo run:android
```

Other scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## Important notes

- The default map style uses the public **OpenStreetMap raster tiles**, which are
  fine for development but **not** for production or bulk/offline downloading
  (against the OSM tile usage policy). For production, point
  `src/map/mapStyle.ts` at your own tile server or a licensed provider.
- Background location requires the user to grant "Always" location permission.

## Project structure

```
src/
  app/                  # expo-router screens
    (tabs)/             # Map, Routes, Journal, Safety, Settings
    route/[id].tsx      # Route detail
    hike/[id].tsx       # Hike detail (stats, notes, GPX export)
  components/           # Reusable UI (MapCanvas, StatCard, PrimaryButton, ...)
  db/                   # SQLite client + repositories (tracks, routes, journal, contacts)
  tracking/             # Background task, recorder controller, stats/geo helpers
  map/                  # Map style + offline tile management
  gpx/                  # GPX import/export
  safety/               # SOS + emergency reference
  state/                # zustand recording store
  data/                 # Seed routes
```

## Data model (SQLite)

`tracks`, `track_points`, `routes`, `waypoints`, `journal_entries`,
`emergency_contacts`. See `src/db/client.ts` for the schema and `src/db/types.ts`
for the domain types.

## Roadmap

- Turn-by-turn off-route warnings while navigating a route
- Curated Taiwan trail dataset (OSM extract)
- Photos and achievement badges in the journal
- Optional cloud sync + accounts (e.g. Supabase) for multi-device and sharing
