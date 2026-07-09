# Plan: Room Deletion + Redirect for Non-Existent Rooms

**Created:** 2026-07-09 13:08
**Status:** Complete

## Objective

Ensure rooms are deleted from Firebase on exit and after 1hr of inactivity, and that any user opening a non-existent (expired/deleted) generated room URL is redirected to the main page. Mobile clients must also live-update and auto-redirect when a room disappears.

## Steps

- [x] Pre-create the room in Firebase inside `createRoom` (pages/index.js) before navigating, so the host existence check never false-redirects a freshly created room.
- [x] Replace the mobile-only `get()` existence check in pages/room/[id].js with a universal `onValue` watcher on `rooms/${id}` that redirects to `/` whenever the room node is missing (initial load + live deletion) for both host and mobile views.
- [x] Keep HostControls "Exit Room" deletion (already removes the room then redirects) — host-only button per user request.
- [x] Keep existing 1hr idle cleanup (host idle removal + pages/api/cleanup.js cron).
- [x] Verify with `npm run build`.

## Files Affected

- `pages/index.js` — added `set` import; `createRoom` now pre-creates the room (`_createdAt`, `lastActiveAt`, `currentSong: null`, `playState: "paused"`, `queue: null`) before `router.push`.
- `pages/room/[id].js` — replaced the mobile-only mount `get()` check (old lines 145-150) with a single `onValue` watcher that redirects both views to `/` when the room is absent (initial or live deletion).

## Notes

- Mobile has no exit button (host-only, per user decision). When the host exits or the room is deleted by idle/cleanup, the universal watcher in `[id].js` auto-redirects any open mobile view to `/` and keeps it in sync via its existing queue/currentSong/playState subscriptions.
- Pre-creating the room in `createRoom` (awaited `set` before navigation) prevents a race where the new host page's existence watcher would otherwise briefly see a missing room and false-redirect.
- Build passes clean.
