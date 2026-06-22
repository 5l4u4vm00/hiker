# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Convention

This project is written in **English only**. Do not use Chinese (or any other language) anywhere in the codebase, including:

- Source code identifiers, comments, and docstrings
- Documentation and README files
- **Git commit messages** (subject and body)
- Pull request titles and descriptions
- Log messages, error messages, and user-facing strings
- Configuration files and inline notes

## Commands

```bash
npm install
npx expo prebuild          # generate native ios/ and android/ projects (required once)
npx expo run:ios           # build + run on iOS device/simulator
npx expo run:android       # build + run on Android device/emulator
npm run typecheck          # tsc --noEmit (strict mode)
npm run lint               # expo lint (eslint-config-expo)
```

This app **cannot run in Expo Go**: MapLibre and the background location task are native modules, so a development build (`expo run:*`) is mandatory. `expo start` alone is not enough. There is no test suite.

## Architecture

Offline-first hiking app (Expo / React Native, TypeScript). All data lives on-device in SQLite; there is no backend or account. Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.

### The recording data flow (most important to understand)

GPS track recording spans three layers that must stay consistent. **SQLite is the single source of truth; the Zustand store is UI-facing live state.**

- `src/tracking/locationTask.ts` — defines the background location task (`LOCATION_TASK`). It runs in **its own JS context**, so it cannot read the Zustand store; it reads the active track from the DB (`getActiveTrack`) and appends points (`addTrackPoints`). The task is registered by *importing the module* (`import '@/tracking/locationTask'` in `src/app/_layout.tsx`) — do not remove that side-effect import.
- `src/tracking/recorder.ts` — the controller. Orchestrates `expo-location` updates, the DB repositories, and the store for start/pause/resume/stop/discard. `stopRecording` computes final stats from persisted points; `restoreRecording` (called at startup) re-attaches an in-progress track after an app restart so recording survives being killed.
- `src/state/recordingStore.ts` — Zustand store holding `trackId`, `status`, and live `stats`. Stats are **recomputed from persisted points**, not accumulated in memory. The Map screen (`src/app/(tabs)/index.tsx`) polls the DB every 3s (`refreshLiveStats`) to drive the live UI.

`computeStats` and the `formatDistance/Duration/Elevation/Pace` helpers live in `src/tracking/stats.ts`.

### Database

`src/db/client.ts` opens one shared lazy `hiker.db` handle and defines the full schema (`tracks`, `track_points`, `routes`, `waypoints`, `journal_entries`, `emergency_contacts`) inline as `CREATE TABLE IF NOT EXISTS` — there are **no migrations**, so schema changes to existing installs need manual handling. `createId()` generates ids. Repositories (`tracks.ts`, `routes.ts`, `journal.ts`, `contacts.ts`) map snake_case DB columns to the camelCase domain types in `src/db/types.ts`. Seed routes are loaded once at startup via `seedRoutesIfEmpty()` (`src/data/seedRoutes.ts`).

### Maps & offline tiles

`src/map/mapStyle.ts` holds the MapLibre style (MapTiler "Outdoor" raster tiles, keyed by the `EXPO_PUBLIC_MAPTILER_KEY` env var — see `.env.example`; MapTiler's terms permit bounded offline caching) plus GeoJSON helpers (`pointsToLineString`, `lastCoordinate`). `src/map/offlineTiles.ts` wraps MapLibre's `OfflineManager` to download/list/delete bounded tile packs; `regionForRoute` builds a per-route pack from the route's bounding box.

### Other modules

- `src/gpx/` — GPX import (`fast-xml-parser`) and export.
- `src/safety/` — SOS (`sos.ts`) and offline emergency reference (`emergencyInfo.ts`).
- `src/app/` — `expo-router` screens with **typed routes enabled**. Tabs in `(tabs)/`, dynamic detail screens at `route/[id].tsx` and `hike/[id].tsx`.

### Conventions

- File naming is mixed by area: components and hooks use kebab-case (`map-canvas.tsx`, `use-theme.ts`); db/map/tracking modules use camelCase (`offlineTiles.ts`, `seedRoutes.ts`). Match the surrounding directory.
- Platform-specific variants use `.web.tsx` / `.web.ts` suffixes (e.g. `animated-icon.web.tsx`, `use-color-scheme.web.ts`).
- The React Compiler is enabled (`experiments.reactCompiler` in `app.json`) — avoid manual memoization patterns that fight it.
