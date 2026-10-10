-- Notifications always say who did it (1.1.1). Additions only.

-- A notification shows the name of whoever caused it (its actor). Join requests are made by the sign-up trigger,
-- before the new person is signed in, so they had no actor and showed as "TeamHub asked to join the team".
-- This version takes the actor explicitly; the old one passes the signed-in person.
create or replace function teamhub_notify(p_users uuid[], p_type text, p_ref text, p_actor uuid) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, ref, actor)
  select distinct u, p_type, p_ref, p_actor
  from unnest(p_users) as u
  join profiles p on p.id = u and p.status = 'active'
  where p_actor is not null and u is distinct from p_actor
$$;

-- Without someone signed in (restoring a backup, scheduled jobs, the setup wizard) there is nobody to name, and
-- those changes aren't news to anyone: send nothing instead of a nameless "TeamHub …" notification.
create or replace function teamhub_notify(p_users uuid[], p_type text, p_ref text) returns void
language sql security definer set search_path = public as $$
  select teamhub_notify(p_users, p_type, p_ref, auth.uid())
$$;

-- The person asking to join is the actor, whether they just signed up or are already signed in.
create or replace function teamhub_membership_requested() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform teamhub_notify(
      array(select teamhub_users_with(
        case when new.requested_type in ('captain', 'mentor') then 'people.approve_leaders' else 'people.approve_members' end,
        new.team_id)),
      'people.request', 'core:person:' || new.user_id, new.user_id);
  end if;
  return new;
end $$;

-- Name the join requests already sent without one.
update notifications set actor = split_part(ref, ':', 3)::uuid
where type = 'people.request' and actor is null and ref ~ '^core:person:[0-9a-f-]{36}$'
  and exists (select 1 from profiles where id = split_part(ref, ':', 3)::uuid);

revoke execute on function teamhub_notify(uuid[], text, text, uuid) from public, anon, authenticated;
