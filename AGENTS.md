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
  _createdAt      — timestamp (written by host on room page mount)
  lastActiveAt    — timestamp (updated on user interaction / Firebase writes via touchRoom())
```

## Conventions

- **Mobile vs Host:** determined solely by `?mobile=true` query param
- **Room ID:** `uuidv4().slice(0, 8)`
- **Lazy client-only imports:** `MobileControls`, `HostControls`, `QRCodeCanvas` use `dynamic(() => import(...), { ssr: false })`
- **Firebase Auth & Analytics:** never imported at module level; called via lazy `initAuth()`/`initAnalytics()` guarded by `typeof window === "undefined"`
- **Scoring:** random 80–100 when YT video ends (state 0), DOM-based confetti (CSS animations, no library)
- **Idle redirect + cleanup:** both views redirect to `/` after 60 min of inactivity (only while paused). On idle timeout, the room is deleted from Firebase via `remove()`. A `touchRoom()` helper writes `lastActiveAt` on every user interaction + Firebase subscription change
- **Room existence validation:** `pages/index.js` checks `get(ref(db, \`rooms/${code}\`))` before navigating joiners; mobile room page also validates existence on mount and redirects to `/` if not found
- **Cleanup API:** `pages/api/cleanup.js` — POST endpoint (no auth) that iterates all rooms, skips playing rooms, and deletes rooms where `lastActiveAt` or `_createdAt` is > 1 hour old. Intended to be called by an external cron service (e.g., cron-job.org) every 15 min
- **Player opts:** `autoplay: 0, controls: 1, modestbranding: 1, rel: 0`. Host uses `loadVideoById` + `playVideo()` with retry
- **No `next.config.js`** — Next.js defaults

## plans/ — Plan workflow

Plans live in `plans/` as consolidated markdown files. The CLI tool `scripts/vibe-plan.js` manages them.

### Commands

| Action | Command |
|---|---|
| Create a plan | `node scripts/vibe-plan.js new "Plan title"` |
| List all plans | `node scripts/vibe-plan.js list` |
| Show a plan | `node scripts/vibe-plan.js show <name>` |

### Auto-naming

Filenames are auto-generated as `<slugified-title>-YYYYMMDD.md`. If a duplicate exists, a counter is appended.

### Plan format

Each plan file contains:
- **Title**, **Created** timestamp, **Status** (Draft / In Progress / Complete)
- **Objective** — what the plan aims to achieve
- **Steps** — checklist of actionable items
- **Files Affected** — list of files to modify
- **Notes** — relevant context, blockers, references

### Agent workflow

1. **Planning:** When asked to plan a feature, research it then save the consolidated plan using `node scripts/vibe-plan.js new "<title>"`. Fill in Objective, Steps, Files Affected, and Notes.
2. **Execution:** In build mode, reference the plan file directly (e.g., `plans/2026-07-07_something.md`) — the agent reads the file and follows each step, checking them off as it goes. Update the `**Status:**` header to "In Progress" then "Complete" as you work.
3. **Auto-update AGENTS.md:** After marking a plan **Complete**, append its title, objective, files affected, and key notes to the **Executed Plans** section at the bottom of `AGENTS.md`. This keeps a running log of every plan executed.

No plan should be created outside `plans/`.

## Responsive patterns

- **Landing page:** single-column on mobile (`grid-cols-1`), switches to 2-column at `lg:` breakpoint
- **Host room video section:** uses `flex-1 min-h-0` instead of hardcoded `calc()` — adapts to any header height
- **HostControls:** buttons wrap with `flex-wrap`, compact padding/text on mobile via `text-xs`, `px-2`, `py-1.5` with `lg:` overrides
- **MobileControls search results:** flex items use `min-w-0` on text wrapper + `shrink-0` on thumbnails/buttons + `break-words` on titles to prevent horizontal overflow. Results container uses `overflow-y-auto overflow-x-hidden`
- **Score popover:** `width: 420px` with `max-width: 90%` and `85vw` on small screens

## Executed Plans

### 2026-07-08 — Safari Autoplay Fix
- **Objective:** Fix Safari browser autoplay issue when skipping/advancing songs by removing duplicate effects and manual retry logic
- **Files Affected:** `pages/room/[id].js`
- **Notes:** Consolidated to a single `useEffect` with `loadVideoById`, 500ms fallback, and `playsinline: 1` for iOS Safari. Removed 3 duplicate effects and all manual `setTimeout` + `tryPlayWithRetries` calls in `advanceQueue()`, `handleSkipNoScore()`, and `startScoreSequence()`.

### 2026-07-08 — MobileControls UI Optimization
- **Objective:** Optimize spacing and UX in `components/MobileControls.js` to maximize usable screen real estate on mobile devices and improve tactile interaction feedback
- **Files Affected:** `components/MobileControls.js`
- **Notes:** Reduced container/card/button padding, tightened section gaps and title margins, compacted result/queue items, added `active:scale-95` tactile feedback to all interactive buttons, and moved the coffee footer inside the card with a `border-t` divider. On a 375px phone, ~16px of horizontal padding was reclaimed (~5% more content width).

### 2026-07-08 — YouTube Player in Mobile View
- **Objective:** Add a YouTube video player to the mobile view so users can watch songs while controlling them from their phone
- **Files Affected:** `components/MobileControls.js`
- **Notes:** Added `YouTube` (react-youtube) import, `playerRef`, two `useEffect` blocks (playState sync + currentSong load), and a responsive `aspect-video` player div rendered conditionally at the top of the card when `currentSong` is set. Player uses `playsinline: 1` for iOS compatibility, matching host player opts. Build compiles cleanly.
