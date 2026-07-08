# Safari Autoplay Fix

**Created:** 2026-07-08
**Status:** Complete

## Objective

Fix Safari browser autoplay issue when skipping or advancing to the next song by removing redundant/conflicting effects and manual play attempts while ensuring clean autoplay via a single consolidated effect.

## Steps

- [ ] Remove duplicate `useEffect` at lines 144–156 (redundant `loadVideoById` + `setTimeout` play)
- [ ] Remove duplicate `useEffect` at lines 232–246 (redundant `loadVideoById` + `setTimeout` play)
- [ ] Consolidate remaining `useEffect` (lines 125–142): add 500ms fallback play delay, add `playsinline: 1` to playerVars
- [ ] Remove all manual `setTimeout` + `tryPlayWithRetries` calls in:
  - `advanceQueue()` (lines 314–323)
  - `handleSkipNoScore()` (lines 553–562)
  - `startScoreSequence()` (lines 431–439)
- [ ] Verify no regressions on Chrome/Firefox/Safari

## Files Affected

- `pages/room/[id].js`

## Notes

- Safari blocks autoplay unless triggered from a user gesture chain. The Firebase `set currentSong` + `set playState` triggers a state change that's not in a gesture chain, so the consolidated effect must use `loadVideoById` (which obeys `autoplay: 1` behavior) and a short fallback `setTimeout` play call.
- `playsinline: 1` is required for inline playback on iOS Safari.
- The three duplicate effects were racing against each other and against manual retry logic, creating a broken state in Safari where the YouTube iframe never cleanly loads the next video.
