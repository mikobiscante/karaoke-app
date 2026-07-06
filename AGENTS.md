# Karaoke SingGing — AGENTS.md

**This file is self-updating.** If you discover something important about this project that future agents should know — a new command, a setup quirk, a convention, or a change in architecture — add or update the relevant section below. Keep entries concise and repo-specific.

## Tech stack

- **Next.js Pages Router** (plain JS, no TypeScript, no App Router)
- **Tailwind CSS v4** — uses `@import "tailwindcss"` in CSS, no `tailwind.config.js`
- **Firebase Realtime Database v9** (modular SDK)
- **YouTube IFrame** via `react-youtube`, search proxy at `pages/api/search.js`

## Commands

| Action | Command |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Prod start | `npm run start` |

No lint, test, format, typecheck, or CI — none are set up.

## Environment

`.env.local` must contain Firebase client config (all `NEXT_PUBLIC_*`) and `YOUTUBE_API_KEY`.

**Critical:** The key `NEXT_PUBLIC_FIREBASE_DATABASE_URL` must be spelled exactly that way — the Firebase config object expects `databaseURL`.

## App structure

- **`pages/index.js`** — create room (8-char UUID) / join room
- **`pages/room/[id].js`** — core app. Host view by default; mobile view when `?mobile=true` query param is present
- **`pages/api/search.js`** — YouTube Data API v3 proxy (appends "karaoke" to query)
- **`utils/firebase.js`** — Firebase init (singleton via `getApps()`). Exports `db` eagerly; `initAuth()`/`initAnalytics()` are lazy, client-only dynamic imports
- **`components/`** — `HostControls`, `MobileControls`, `Player`, `QRCodeDisplay`, `ScoreDisplay`, `SiteHeader`, `AdSlot`
- **`style/globals.css`** — Tailwind v4 entry (`@import "tailwindcss"`)

PostCSS uses a single plugin: `@tailwindcss/postcss`.

## Firebase Realtime DB schema

```
rooms/{roomId}/
  queue/          — list of { videoId, title, thumbnail, addedAt }
  currentSong     — { videoId, title, thumbnail } or null
  playState       — "playing" | "paused"
  skipRequestNoScore/ — { requestedAt: timestamp } (mobile writes, host reads)
```

## Conventions

- **Mobile vs Host:** determined solely by `?mobile=true` query param
- **Room ID:** `uuidv4().slice(0, 8)`
- **Lazy client-only imports:** `MobileControls`, `HostControls`, `QRCodeCanvas` use `dynamic(() => import(...), { ssr: false })`
- **Firebase Auth & Analytics:** never imported at module level; called via lazy `initAuth()`/`initAnalytics()` guarded by `typeof window === "undefined"`
- **Scoring:** random 80–100 when YT video ends (state 0), DOM-based confetti (CSS animations, no library)
- **Idle redirect:** both views redirect to `/` after 60 min of inactivity (only while paused)
- **Player opts:** `autoplay: 0, controls: 1, modestbranding: 1, rel: 0`. Host uses `loadVideoById` + `playVideo()` with retry
- **No `next.config.js`** — Next.js defaults
