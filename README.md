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

Photos are downscaled in the browser before upload (`browser-image-compression`),
then re-processed server-side with `sharp` (`src/lib/image.ts`) to a ~2500px
longest-side JPEG plus a small thumbnail — enough resolution to read a plate,
without storing multi-megapixel originals. Files are stored in a **private**
Cloudflare R2 bucket (`src/lib/r2.ts`); the app reads them back via
short-lived presigned URLs rather than public links, since this is internal
company content.

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

## Project structure

- `src/proxy.ts` — Next.js 16's request proxy (formerly "middleware"); gates
  every route behind Supabase auth + the `@vitrox.com` domain check.
- `src/lib/supabase/` — browser/server Supabase clients and the proxy's
  session-refresh helper.
- `src/lib/r2.ts` — Cloudflare R2 upload + presigned URL helpers (S3-compatible
  API via `@aws-sdk/client-s3`).
- `src/lib/violations.ts` — data access layer (list by date, get by id,
  create, delete). Postgres rows via Supabase, image bytes via R2.
- `src/lib/plate.ts` — `normalizePlate()`, so a plate is stored the same way
  regardless of spacing/casing on entry, and occurrence counts match up.
- `src/app/(app)/` — authenticated pages: day view (`page.tsx`), `upload/`,
  `violations/[id]/` (shows a Delete button to the report's own creator).
- `src/app/actions.ts` — Server Actions for creating/deleting a report and
  signing out.

Not built yet (straightforward to add later on the same schema): editing a
report, comments, and search by plate number.
