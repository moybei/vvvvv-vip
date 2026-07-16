-- Reintroduce reporter tracking, but purely as an internal ownership
-- pointer for "delete your own report" — the app never renders this value
-- anywhere. Using the auth user id (not email) so it can drive RLS directly.

alter table violations
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

-- Require every new insert to record the inserting user (prevents an
-- authenticated request from spoofing another user's id).
drop policy if exists "vitrox insert violations" on violations;
create policy "vitrox insert violations" on violations
  for insert with check (is_allowed_email() and created_by_user_id = auth.uid());

-- Only the reporter can delete their own report. No update policy is added
-- (reports still aren't editable) and no delete policy exists on
-- violation_images / plate_numbers directly — deleting the parent row
-- cascades to both (FK cascade is exempt from RLS on the child tables).
create policy "owner can delete own violation" on violations
  for delete using (created_by_user_id = auth.uid());
