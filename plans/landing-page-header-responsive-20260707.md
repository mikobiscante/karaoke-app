# Plan: Landing page header responsive fix

**Created:** 2026-07-07 00:12
**Status:** Complete

## Objective

Fix the landing page header so the logo and title are pinned to the top of the page, with proper responsive sizing and alignment on all screen sizes.

## Steps

- [x] Identify current layout issues — header was floating in the middle due to `justify-center`
- [x] Restructure outer container to `flex-col` with header at top + hero centered in remaining space
- [x] Add responsive sizing (logo, title, badge, padding) across mobile/tablet/desktop
- [x] Add overflow safety classes (`shrink-0`, `min-w-0`)
- [x] Verify build succeeds

## Files Affected

- `pages/index.js` — restructured outer layout, added responsive classes

## Notes

Build passes with Next.js 16.2.10 / Turbopack.
