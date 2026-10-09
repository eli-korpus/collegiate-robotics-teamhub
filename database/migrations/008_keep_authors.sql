-- Security fixes (1.0.9). Additions only.

-- Who wrote or asked for something can't be changed from the website. Before, the author of a post, request or
-- notebook entry could be set to someone else (making it look like they wrote it, or handing them edit rights).
-- Attached in policies.sql to every table with one of these columns, so new tabs are covered too. Changes made by
-- the database itself (definer functions, an account being deleted) are not affected. The old value is kept
-- quietly instead of failing, because some saves send the author again unchanged or as the current user.
create or replace function teamhub_keep_author() returns trigger
language plpgsql set search_path = public as $$
declare
  c text;
  keep jsonb := '{}';
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  foreach c in array tg_argv loop
    keep := keep || jsonb_build_object(c, to_jsonb(old) -> c);
  end loop;
  return jsonb_populate_record(new, keep);
end $$;

-- Asking for your account to be deleted notifies the mentors at most once a day.
create or replace function people_request_deletion() returns void
language sql security definer set search_path = public as $$
  select teamhub_notify(array(select teamhub_users_with('people.deactivate', null)), 'people.deletion_request', 'core:person:' || auth.uid())
  where not exists (
    select 1 from notifications
    where type = 'people.deletion_request' and ref = 'core:person:' || auth.uid() and created_at > now() - interval '1 day'
  )
$$;
