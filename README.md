# VIP — ViTrox Interesting Parking

Internal wall-of-shame for annoying parking around ViTrox. Report a violation
with photos, plate number(s), and a description; browse past reports by day
via the calendar. Restricted to signed-in `@vitrox.com` Google accounts.

Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres +
Auth), Cloudflare R2 (image storage), deployed to Vercel.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **Project Settings → API**, copy the **Project URL** and the
   **anon / publishable key**.
3. Open the **SQL Editor** and run the migrations in `supabase/migrations/`
   **in order**:
   - [`0001_init.sql`](supabase/migrations/0001_init.sql) — creates the
     `violations`, `violation_images`, and `plate_numbers` tables and
     enables row-level security restricted to `@vitrox.com` accounts. If
     your company domain isn't `vitrox.com`, edit the `is_allowed_email()`
     function in that file before running it.
   - [`0002_remove_reporter_tracking.sql`](supabase/migrations/0002_remove_reporter_tracking.sql) —
     drops the columns that would have recorded who submitted each report.
   - [`0003_reporter_ownership_for_delete.sql`](supabase/migrations/0003_reporter_ownership_for_delete.sql) —
     adds back a `created_by_user_id` column and a matching delete policy,
     so someone can delete their own report but not anyone else's. This
     value is never shown anywhere in the UI — it's purely an internal
     ownership check, not a "reported by" feature.
   - [`0004_daily_image_sequence.sql`](supabase/migrations/0004_daily_image_sequence.sql) —
     adds an atomic counter function backing the per-day image naming scheme
     (see "How images are handled" below).

## 2. Create the Cloudflare R2 bucket

Image files (not the database rows) live in R2, not Supabase Storage — R2's
free tier is 10x the storage (10GB vs 1GB) with no egress cost.

1. Sign up / log in at [dash.cloudflare.com](https://dash.cloudflare.com).
   R2 requires a payment method on file even for the free tier, but you
   won't be charged unless you exceed 10GB.
2. **R2 Object Storage → Create bucket**. Name it e.g. `vip-violation-images`.
   Leave it private — do not enable public access.
3. **R2 → Manage API Tokens → Create API Token**, permission **Object Read
   & Write**, scoped to that bucket. Copy the **Access Key ID** and **Secret
   Access Key** (the secret is shown once).
4. Note your **Account ID** (R2 overview page, or the bucket's "S3 API"
   settings) — the endpoint is `https://<account-id>.r2.cloudflarestorage.com`.
5. You'll add these as `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` in step 4 below.

## 3. Set up Google sign-in

Because ViTrox uses Google Workspace, restrict the OAuth consent screen to
your organization — this is the main access control, enforced by Google
itself before anyone reaches the app:

1. In [Google Cloud Console](https://console.cloud.google.com), create a
   project (or use an existing one).
2. **APIs & Services → OAuth consent screen**: set **User type** to
   **Internal**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
   type **Web application**. Add this Authorized redirect URI (from your
   Supabase project's **Authentication → URL Configuration**, or
   `https://<project-ref>.supabase.co/auth/v1/callback`):
   - `https://<project-ref>.supabase.co/auth/v1/callback`
4. Copy the generated **Client ID** and **Client Secret**.
5. In the Supabase dashboard: **Authentication → Providers → Google**,
   paste in the Client ID/Secret and enable the provider.
6. In **Authentication → URL Configuration**, set the **Site URL** to your
   deployed domain (and add `http://localhost:3000` under **Redirect URLs**
   for local development).

The app also re-checks the signed-in email's domain itself
(`src/lib/auth.ts`, enforced in `src/lib/supabase/proxy.ts`) as a backstop —
useful if the consent screen setting ever changes.

## 4. Local development

```bash
cp .env.local.example .env.local
# fill in the Supabase and R2 values from steps 1-2 above

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected
to `/login`. Sign in with an `@vitrox.com` Google account.

## 5. Deploy to Vercel

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), import the repo.
3. Add the same environment variables from `.env.local` to the Vercel
   project (Project Settings → Environment Variables).
4. Deploy. Once you have the production URL, add it as the Supabase **Site
   URL** (step 3.6 above) and as an additional authorized redirect URI if
   you're using a custom domain-based Supabase Auth flow.

## How images are handled

Each photo is downscaled in the browser (`browser-image-compression`) and
then **uploads immediately, the moment it's picked** — not bundled together
at final submit — via `POST /api/upload-photo`, a plain Route Handler
(not a Server Action, so the browser's `XMLHttpRequest` can report real
upload progress, which `fetch` can't). Each thumbnail shows a live progress
bar while its upload is in flight, with a retry button if one fails. The
server re-processes the photo with `sharp` (`src/lib/image.ts`) to a
~2500px longest-side JPEG plus a small thumbnail — enough resolution to
read a plate, without storing multi-megapixel originals — and stores both
in a **private** Cloudflare R2 bucket (`src/lib/r2.ts`); the app reads them
back via short-lived presigned URLs rather than public links, since this is
internal company content. Submitting the form just attaches the
already-uploaded image records to the new report — no file bytes are sent
at that point, which also sidesteps Vercel's hard ~4.5MB request body limit
for serverless functions (a limit Next's own config can't override, and
which a bulk multi-photo request could otherwise hit).

**R2 layout**: one folder per day, `YYYYMMDD/`, containing a running
2-digit sequence shared by every violation reported that day —
`01-full.jpg`/`01-thumb.jpg`, `02-full.jpg`/`02-thumb.jpg`, and so on,
continuing across violations rather than restarting per report. The
sequence is reserved atomically via a Postgres function
(`reserve_daily_image_indexes`, `0004_daily_image_sequence.sql`) so two
people uploading on the same day can't collide and overwrite each other's
photo. This naming is cosmetic/organizational only — the app always reads
images via the exact path stored per row in `violation_images`, never by
guessing or listing a folder, so this only affects new uploads; anything
uploaded before this change keeps its old `<violation-id>/<n>-full.jpg`
path and still works.

## Deleting a report

Only the person who submitted a report can delete it — enforced by a
Postgres RLS policy (`created_by_user_id = auth.uid()`), not just a hidden
button. Deleting removes the database rows and the report's images in R2.
Who reported something is never shown anywhere in the UI; it's used purely
to decide whether to show you the Delete button on your own reports.

Reports created before this feature existed have no owner on record and
can't be deleted through the UI by anyone (only via direct database access)
— this is the safe default rather than making old rows deletable by
everyone.

## Plate tags

Tapping a plate chip anywhere (card grid or detail page) opens
`/plates/<plate>`, listing every violation ever reported against that exact
normalized plate, grouped by date, newest first.

## Timestamps

The server runs in UTC on Vercel; without correcting for that, both
timestamps and "what date is today" would silently be 8 hours off from
Malaysia once deployed. `src/lib/datetime.ts` hardcodes
`Asia/Kuala_Lumpur` and is used everywhere a date/time is computed or
displayed, client- and server-side alike.

## Project structure

- `src/proxy.ts` — Next.js 16's request proxy (formerly "middleware"); gates
  every route behind Supabase auth + the `@vitrox.com` domain check.
- `src/lib/supabase/` — browser/server Supabase clients and the proxy's
  session-refresh helper.
- `src/lib/r2.ts` — Cloudflare R2 upload + presigned URL helpers (S3-compatible
  API via `@aws-sdk/client-s3`).
- `src/lib/violations.ts` — data access layer (list by date, get by id, get
  by plate, create, delete). Postgres rows via Supabase; image bytes never
  touch this file — they're already in R2 by the time it runs.
- `src/lib/plate.ts` — `normalizePlate()`, so a plate is stored the same way
  regardless of spacing/casing on entry, and occurrence counts match up.
- `src/lib/datetime.ts` — Malaysia-timezone-aware date/time helpers.
- `src/app/api/upload-photo/route.ts` — per-photo upload endpoint (resize +
  R2 upload + sequence numbering), called via XHR for progress tracking.
- `src/app/(app)/` — authenticated pages: day view (`page.tsx`), `upload/`,
  `violations/[id]/` (shows a Delete button to the report's own creator),
  `plates/[plate]/` (all reports for one plate, grouped by date).
- `src/app/actions.ts` — Server Actions for creating/deleting a report and
  signing out. None of them call `redirect()` — see the note in the app's
  internal `plan.md` if you're wondering why; the short version is that
  doing so from an action called imperatively (not via `<form>`) makes a
  successful action look like it failed to the caller.

Not built yet (straightforward to add later on the same schema): editing a
report, comments, and search across multiple plates at once.
