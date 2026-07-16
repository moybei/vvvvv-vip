# VIP — ViTrox Interesting Parking — Project Plan & Checkpoint

> This file is the persistent reference for this project. If you're picking
> this up in a new session (human or Claude), read this first before
> exploring the code.

## Context

An internal, fun-but-useful web app where ViTrox employees post photos of
annoying/funny parking violations seen around the company. Each post
("violation card") can have multiple photos, a description, and one or more
car plate numbers. Cards are browsed by day via a calendar. Since this is
company-internal content, only `@vitrox.com` Google accounts can sign in and
view anything.

## Stack decisions (and why)

- **Next.js 16 (App Router) + TypeScript + Tailwind v4** — one project for
  UI + API. Note: Next.js 16 renamed `middleware.ts` → **`proxy.ts`**
  (`src/proxy.ts`, exported function name `proxy`, same `config.matcher`
  convention). Don't reintroduce a `middleware.ts` file.
- **Supabase** (Postgres + Auth) instead of Neon/Auth.js — one account for
  those two, one set of env vars. Chosen over Prisma too: DB access goes
  through the `@supabase/supabase-js` client directly (see
  `src/lib/violations.ts`), no ORM/migration tool beyond the raw SQL file.
- **Cloudflare R2** (not Supabase Storage) for image files — switched after
  launch once we compared free-tier limits: Supabase Storage free tier is
  1GB storage / 5GB egress per month; R2's free tier is 10GB storage with
  **zero egress cost ever** (R2's whole selling point). At ~500-700KB per
  report this matters once usage grows. S3-compatible API via
  `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, see `src/lib/r2.ts`.
  Kept the bucket **private** (not R2's public-bucket option) specifically
  because these are photos of coworkers' cars — the app generates
  short-lived presigned URLs per request instead of exposing permanent
  public links.
- **Cloud hosting on Vercel** — no dependency on internal ViTrox IT infra,
  free/cheap tier is enough for an internal tool.
- **Google Sign-In restricted to `@vitrox.com`**, two layers:
  1. Google Cloud OAuth consent screen set to **Internal** (ViTrox has
     Google Workspace) — Google itself blocks non-org accounts before they
     ever reach the app.
  2. Defense-in-depth domain check in code (`src/lib/auth.ts`,
     `isAllowedEmail`), enforced in `src/proxy.ts` /
     `src/lib/supabase/proxy.ts` and again in `src/app/actions.ts` and the
     `/auth/callback` route.
- **Design**: traffic/hazard warning theme — yellow `#FFC72C` / red
  `#E0392B` / near-black, hazard-stripe accents used sparingly, off-white
  background, mobile-first responsive (single column → two-column on
  desktop). Theme tokens live in `src/app/globals.css`.
- **Images**: browser-side downscale (`browser-image-compression`) before
  upload, then server-side `sharp` pass (`src/lib/image.ts`) resizing to
  ~2500px longest side (full) + 480px (thumbnail), JPEG quality 85. Stored in
  a **private** Cloudflare R2 bucket; the app reads them back via
  short-lived presigned URLs, not public links, since this is internal
  company content people didn't consent to have publicly exposed.
- **Reporter tracking: DB-only, never rendered.** This flip-flopped once —
  originally tracked (`created_by_email`/`created_by_name`), then dropped
  entirely for privacy (`0002_remove_reporter_tracking.sql`), then brought
  back in a different shape (`0003_reporter_ownership_for_delete.sql`) once
  the user decided they need it to support "delete your own report, not
  others'". The current design: `violations.created_by_user_id` (uuid,
  references `auth.users`) is set on insert and used **only** for ownership
  checks — nothing in the UI ever displays who reported something, only
  whether the current viewer IS the reporter (which shows a Delete button).
  Enforced at two layers: an RLS delete policy (`created_by_user_id =
  auth.uid()`) as the real guarantee, plus an app-level check in
  `deleteViolation()` for a clean error message instead of a silent no-op.
- **Delete your own report, not others'.** Deleting removes the DB row
  (cascades to `violation_images`/`plate_numbers` via FK) and the
  corresponding R2 objects (`deleteFromR2()` in `src/lib/r2.ts`, via
  `DeleteObjectsCommand`). DB delete happens first, then R2 cleanup — if R2
  cleanup fails, the result is an orphaned file (harmless), not a broken UI
  pointing at a deleted DB row. No update/edit capability exists, only
  create and delete.
- **Plate numbers are normalized on entry**: `normalizePlate()`
  (`src/lib/plate.ts`) uppercases and strips all whitespace, applied both
  client-side (`UploadForm`) and server-side (`actions.ts`, defense in
  depth) — so "abc 1234" and "ABC1234" are stored identically and match for
  occurrence counting.
- **Plate occurrence count**: each plate chip shows a small red badge with
  how many times that normalized plate has been reported **across all
  history** (not just the current day) — a repeat-offender flag. Computed in
  `getPlateOccurrenceCounts()` in `src/lib/violations.ts`, only shown when
  count > 1 (first-time plates stay clean, no badge). See `PlateChip.tsx`.

## Data model

```
violations         (id, violation_date, description, created_at, created_by_user_id)  -- last col: ownership only, never displayed
violation_images   (id, violation_id FK, image_path, thumb_path, width, height, sort_order)
plate_numbers      (id, violation_id FK, plate_text)   -- plate_text always normalized (see above)
```

RLS: all three tables are readable/insertable only by signed-in
`@vitrox.com` accounts (`is_allowed_email()` SQL function in the migration).
`violations` additionally has a delete policy scoped to
`created_by_user_id = auth.uid()` — the only mutation besides insert. No
update policy exists (reports aren't editable). `violation_images`/
`plate_numbers` have no delete policy of their own; they're removed via FK
`ON DELETE CASCADE` when the parent `violations` row is deleted, which is
exempt from RLS on the child tables (cascade is a referential-integrity
action, not a direct DML statement).

Full DB schema + RLS: run in order —
`0001_init.sql` → `0002_remove_reporter_tracking.sql` →
`0003_reporter_ownership_for_delete.sql`. (0002 drops the reporter columns,
0003 adds a *different* one back — both need to run, in that order, so the
final column is `created_by_user_id`, not the original email/name pair.)

## File map

- `src/proxy.ts` — root request proxy, delegates to the helper below.
- `src/lib/supabase/proxy.ts` — session refresh + auth/domain gating logic
  used by the proxy.
- `src/lib/supabase/client.ts` / `server.ts` — browser/server Supabase
  clients (`@supabase/ssr`).
- `src/lib/auth.ts` — `isAllowedEmail()` domain check, reads
  `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` (defaults to `vitrox.com`).
- `src/lib/image.ts` — `processUploadedImage()`, the sharp resize step.
- `src/lib/r2.ts` — Cloudflare R2 upload + presigned URL helpers
  (`uploadToR2`, `getR2SignedUrl(s)`), S3-compatible API.
- `src/lib/plate.ts` — `normalizePlate()`, shared client+server.
- `src/lib/violations.ts` — data access layer: `getViolationsByDate`,
  `getViolationById`, `createViolation`, `deleteViolation` (fetches image
  paths + ownership, deletes DB row, then cleans up R2), plus
  `getPlateOccurrenceCounts` (private helper).
- `src/lib/types.ts` — shared TS types for the three tables + joined view
  (plates carry a computed `occurrenceCount`, not a DB column;
  `created_by_user_id` exists on `Violation` for ownership checks only).
- `src/app/actions.ts` — Server Actions: `createViolationAction`,
  `deleteViolationAction`, `signOutAction`.
- `src/app/(app)/` — authenticated route group (has the header):
  - `layout.tsx` — renders `Header`.
  - `page.tsx` — day view: `CalendarNav` at the top, `ViolationGrid` below,
    single column, reads `?date=`.
  - `upload/page.tsx` — report form.
  - `violations/[id]/page.tsx` — card detail / full gallery.
- `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`,
  `src/app/auth/auth-error/page.tsx` — outside the authenticated group, no
  header.
- `src/app/api/violations/summary/route.ts` — `GET ?month=YYYY-MM`, returns
  which dates have at least one violation (feeds the calendar's dots).
- `src/components/` — `CalendarNav` (compact "Today"/date button that
  expands a `DayPicker` popover on click — collapsed by default, closes on
  outside click/Escape/date select), `PlateChip` (plate + occurrence badge,
  shared by card + detail views), `DeleteButton` (confirm dialog, calls
  `deleteViolationAction`, only rendered on the detail page when
  `user.id === violation.created_by_user_id`), `Header`, `GoogleSignInButton`,
  `SignOutButton`, `UploadForm`, `ViolationCard`, `ViolationGrid`.

## Progress checkpoint

All planned build tasks are **done**, including a round of post-launch
changes the user requested after initial setup:

- [x] Scaffold Next.js + TypeScript + Tailwind
- [x] Supabase client/server helpers, schema, image resize util
- [x] Google auth with `@vitrox.com` domain restriction
- [x] API routes for violations (list-by-date via server component + direct
      query; create via Server Action; month summary via route handler)
- [x] Day-view UI with calendar navigation
- [x] Upload form + card detail view
- [x] Setup docs (`README.md`)
- [x] Migrated image storage from Supabase Storage → Cloudflare R2
- [x] Removed reporter identity tracking entirely (privacy) —
      `0002_remove_reporter_tracking.sql`
- [x] Plate number normalization (`normalizePlate`, strip spaces + uppercase)
- [x] Plate occurrence-count badge (repeat offenders, all-time count)
- [x] Calendar redesigned: compact "Today"/date button at the top that
      expands a popover, instead of an always-open sidebar calendar; cards
      moved to a single column below it
- [x] Fixed a likely real bug: `UploadForm` only added a plate to the
      submitted list when the user clicked "Add"/pressed Enter — typing a
      plate then hitting Submit directly silently dropped it. Now commits
      any pending input text at submit time.
- [x] Reporter tracking reinstated at the DB layer only (never rendered) —
      `created_by_user_id`, to support the delete feature below —
      `0003_reporter_ownership_for_delete.sql`
- [x] Delete-your-own-report feature: RLS delete policy + `deleteViolation`
      (DB row + cascade + R2 cleanup) + `DeleteButton` shown only to the
      report's own creator

Verified so far:
- `npm run build` and `npx eslint .` pass clean as of every change above
  (re-run after each round, most recently after the calendar redesign).
- **R2 connectivity verified directly**: wrote and ran a throwaway script
  that uploaded a test object to the real `vip-violation-images` bucket,
  generated a presigned URL, fetched it back, confirmed the content
  round-tripped correctly, then cleaned up the test object. R2 credentials
  in `.env.local` are correct and working.
- **Google OAuth is working** — inferred from a real error the user hit:
  a `POST /upload` reached our Server Action code and failed with "Body
  exceeded 1MB limit" (a Next.js request-size cap, since fixed — see below).
  Reaching that point at all means the user was signed in as an
  `@vitrox.com` account and the proxy let the authenticated request through.
- Fixed a real bug along the way: Next.js Server Actions default to a 1MB
  request body cap, too small for multi-photo uploads even after client-side
  compression. Raised to 25MB via `experimental.serverActions.bodySizeLimit`
  in `next.config.ts`. **This requires a full dev-server restart to take
  effect** — `next.config.ts` changes aren't picked up by Fast Refresh.
- Also fixed: the create-report error handler was silently swallowing
  exceptions with no logging at all (`src/app/actions.ts`) — added
  `console.error` so real failures show up in the terminal running
  `npm run dev` instead of only a generic message in the browser.

**Not yet verified (needs a human with real Google/Supabase access — an
agent should not do these on the user's behalf):**
- Running **all three** migrations against the real Supabase project, in
  order: `0001_init.sql` → `0002_remove_reporter_tracking.sql` →
  `0003_reporter_ownership_for_delete.sql`. Not confirmed any of these have
  been run yet — this is the top suspect for any "something went wrong
  saving/deleting the report" error, since the schema may not match what the
  code now expects.
- Whether the original "plate not shown on detail page" report was actually
  the missing-Add-click bug (now fixed) or something else — ask the user to
  retest with a fresh report, or check the `plate_numbers` table directly in
  Supabase's Table Editor for an existing violation's id if it recurs.
- A full end-to-end run: sign in, submit a report with photos + plates,
  confirm it saves and the plate shows on the detail page, confirm the
  occurrence badge shows "2" on a plate reported a second time, confirm
  Delete only appears on your own reports (not ones without a matching
  `created_by_user_id`, e.g. any created before migration 0003 — those will
  have `created_by_user_id = null` and won't be deletable by anyone through
  the UI, only via direct DB access), confirm deleting removes both the card
  and its images from the R2 bucket.
- If an earlier `0001_init.sql` run created a `violation-images` Supabase
  Storage bucket, it's unused now — safe to delete from the Supabase
  dashboard to reclaim quota, not urgent.

## Environment

`.env.local` has real values for all of: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (R2 confirmed working, see above).
There's also an `R2_TOKEN_VALUE` (a Cloudflare API bearer token, different
credential system from the S3-style keys) — unused by the app's code, kept
only because Cloudflare won't show it again if lost. `.env.local` is
git-ignored. `.env.local.example` is the tracked template — keep it
generic/placeholder, never put real values there.

`.claude/launch.json` is configured so `preview_start` can run `npm run dev`
for in-browser testing (port 3000, `autoPort: true` since 3000 is usually
already taken locally by the user's own separate `npm run dev`).

## Not in MVP scope (deliberately deferred)

Editing/deleting a report, comments/reactions, search by plate number. All
straightforward to add later on the existing schema — RLS just needs
update/delete policies added, and the append-only assumption in
`violations.ts` would need revisiting. Reporter identity is different from
these — that one is a deliberate permanent privacy decision, not deferred.

## Next steps for whoever picks this up

1. Confirm all three migrations have been run in Supabase's SQL editor, in
   order: `0001_init.sql` → `0002_remove_reporter_tracking.sql` →
   `0003_reporter_ownership_for_delete.sql`.
2. If `npm run dev` hasn't been restarted since the `next.config.ts` body
   size limit fix from earlier in this session, restart it now (Fast Refresh
   doesn't pick up config file changes).
3. Sign in with a real `@vitrox.com` account and submit a real report with
   photos + plates. Confirm the plate actually shows on the detail page. If
   anything fails, check the terminal for `createViolationAction failed:` /
   `deleteViolationAction failed:` — that'll have the real error now.
4. Report the same plate twice (different violations) and confirm the
   occurrence badge shows "2" on the repeat.
5. On a report you created, confirm the Delete button appears on the detail
   page, and that deleting it removes the card, its DB rows, and its images
   in the R2 bucket (spot-check the bucket in the Cloudflare dashboard).
6. Deploy to Vercel (`README.md` section 5) once local testing passes.
