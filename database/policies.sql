-- Core RLS policies. Re-applied by every migration plan (the plan drops existing core policies first).

alter table teamhub_modules enable row level security;
alter table teamhub_settings enable row level security;
alter table teamhub_storage_trash enable row level security;
alter table teams enable row level security;
alter table profiles enable row level security;
alter table profiles_private enable row level security;
alter table profiles_leaders enable row level security;
alter table memberships enable row level security;
alter table positions enable row level security;
alter table position_holders enable row level security;
alter table subteams enable row level security;
alter table links enable row level security;
alter table info_requests enable row level security;
alter table notifications enable row level security;
alter table comments enable row level security;

-- System
create policy core_modules_read on teamhub_modules for select to authenticated using (true);
create policy core_settings_read on teamhub_settings for select to authenticated using (teamhub_is_active());
create policy core_settings_update on teamhub_settings for update to authenticated
  using (teamhub_is_admin()) with check (teamhub_is_admin());
-- teamhub_storage_trash: no client policies (definer functions only).
alter table teamhub_allowed_emails enable row level security;
create policy core_allowed_emails_admin on teamhub_allowed_emails for all to authenticated
  using (teamhub_is_admin()) with check (teamhub_is_admin());

-- Teams: names/colors are needed by pending users too.
create policy core_teams_read on teams for select to authenticated using (true);

-- Profiles
create policy core_profiles_read on profiles for select to authenticated using (
  id = (select auth.uid())
  or (teamhub_is_active() and status <> 'pending')
  or (status = 'pending' and exists (
        select 1 from memberships m
        where m.user_id = profiles.id and m.status = 'pending'
          and people_can_approve(m.team_id, coalesce(m.requested_type, 'member'))))
);
create policy core_profiles_update_self on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy core_profiles_update_approver on profiles for update to authenticated
  using (teamhub_is_admin() or (not is_admin and exists (
    select 1 from memberships m where m.user_id = profiles.id and teamhub_can('people.assign_positions', m.team_id))))
  with check (teamhub_is_admin() or (not is_admin and exists (
    select 1 from memberships m where m.user_id = profiles.id and teamhub_can('people.assign_positions', m.team_id))));

create policy core_private_read on profiles_private for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from memberships m where m.user_id = profiles_private.user_id and teamhub_can('people.view_private', m.team_id))
);
-- Team-only fields (shirt sizes…): the person, and people who see team-only fields on one of their teams.
create policy core_leaders_read on profiles_leaders for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from memberships m where m.user_id = profiles_leaders.user_id and teamhub_can('people.view_team_info', m.team_id))
);
create policy core_leaders_insert on profiles_leaders for insert to authenticated
  with check (user_id = (select auth.uid()) or exists (
    select 1 from memberships m where m.user_id = profiles_leaders.user_id and teamhub_can('people.view_team_info', m.team_id)));
create policy core_leaders_update on profiles_leaders for update to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from memberships m where m.user_id = profiles_leaders.user_id and teamhub_can('people.view_team_info', m.team_id)))
  with check (user_id = (select auth.uid()) or exists (
    select 1 from memberships m where m.user_id = profiles_leaders.user_id and teamhub_can('people.view_team_info', m.team_id)));
create policy core_private_insert on profiles_private for insert to authenticated
  with check (user_id = (select auth.uid()) or exists (
    select 1 from memberships m where m.user_id = profiles_private.user_id and teamhub_can('people.view_private', m.team_id)));
create policy core_private_update on profiles_private for update to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from memberships m where m.user_id = profiles_private.user_id and teamhub_can('people.view_private', m.team_id)))
  with check (user_id = (select auth.uid()) or exists (
    select 1 from memberships m where m.user_id = profiles_private.user_id and teamhub_can('people.view_private', m.team_id)));

-- Memberships: active users see active memberships; approvers see pending ones for their team.
create policy core_memberships_read on memberships for select to authenticated using (
  user_id = (select auth.uid())
  or (teamhub_is_active() and status <> 'pending')
  or (status = 'pending' and people_can_approve(team_id, coalesce(requested_type, 'member')))
);
-- Ask to join another team (always pending; approval happens via people_approve()).
create policy core_memberships_request on memberships for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'pending' and type = coalesce(requested_type, 'member') and approved_by is null
);

-- Positions
create policy core_positions_read on positions for select to authenticated using (teamhub_is_active());
create policy core_positions_insert on positions for insert to authenticated with check (
  source = 'app' and not grants_permissions and teamhub_can('people.assign_positions', team_id)
);
create policy core_positions_update on positions for update to authenticated
  using (source = 'app' and teamhub_can('people.assign_positions', team_id))
  with check (source = 'app' and not grants_permissions and teamhub_can('people.assign_positions', team_id));
create policy core_positions_delete on positions for delete to authenticated
  using (source = 'app' and teamhub_can('people.assign_positions', team_id));

create policy core_holders_read on position_holders for select to authenticated using (teamhub_is_active());
-- Per-team positions are checked for the holder's team; other positions for the position's team.
create policy core_holders_insert on position_holders for insert to authenticated with check (
  exists (select 1 from positions p where p.id = position_id and (
    teamhub_can('people.assign_positions', case when p.per_team then position_holders.team_id else p.team_id end)
    or (not p.grants_permissions and teamhub_can('people.assign_badges', case when p.per_team then position_holders.team_id else p.team_id end))))
  and (position_holders.team_id is not null or not exists (select 1 from positions p where p.id = position_id and p.per_team))
);
create policy core_holders_delete on position_holders for delete to authenticated using (
  exists (select 1 from positions p where p.id = position_id and (
    teamhub_can('people.assign_positions', case when p.per_team then position_holders.team_id else p.team_id end)
    or (not p.grants_permissions and teamhub_can('people.assign_badges', case when p.per_team then position_holders.team_id else p.team_id end))))
);

create policy core_subteams_read on subteams for select to authenticated using (teamhub_is_active());

-- Links (tool links + Bulletin Board). Bulletin adds its own policies when enabled.
create policy core_links_read on links for select to authenticated using (teamhub_in_team(team_id));
create policy core_links_insert on links for insert to authenticated
  with check (teamhub_can('core.edit_links', team_id) and created_by = (select auth.uid()));
create policy core_links_update on links for update to authenticated
  using (teamhub_can('core.edit_links', team_id)) with check (teamhub_can('core.edit_links', team_id));
create policy core_links_delete on links for delete to authenticated using (teamhub_can('core.edit_links', team_id));

-- info_requests: left over from "Request info" (replaced by the Setup assistant on Home). No client policies.

-- Notifications: own only. Inserts come from definer functions.
create policy core_notifications_read on notifications for select to authenticated using (user_id = (select auth.uid()));
create policy core_notifications_update on notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy core_notifications_delete on notifications for delete to authenticated using (user_id = (select auth.uid()));

-- Comments on work items (spec §10.7).
create policy core_comments_read on comments for select to authenticated using (teamhub_ref_visible(ref));
create policy core_comments_insert on comments for insert to authenticated
  with check (author = (select auth.uid()) and teamhub_is_active() and teamhub_ref_visible(ref));
create policy core_comments_delete on comments for delete to authenticated
  using (author = (select auth.uid()) or teamhub_is_admin());

-- Avatars bucket
create policy core_avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and teamhub_is_active());
create policy core_avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy core_avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy core_avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (split_part(name, '/', 1) = (select auth.uid())::text or teamhub_is_admin()));

select teamhub_realtime_add('notifications');

-- Data API access. TeamHub grants exactly what it needs on every plan, so it works whether or not the Supabase
-- project's "Automatically expose new tables" setting is on. Row-level security still decides which rows anyone sees.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
-- Signed-out visitors get only the keep-alive ping and the sign-up page's email rule: see ANON_LOCKDOWN, which runs
-- after every tab's rules.
-- Internal helpers stay locked (re-applied because the grant above covers every function).
revoke execute on function teamhub_drop_policies(text), teamhub_make_dormant(text), teamhub_drop_prefix(text),
  teamhub_trash(text, text[]), teamhub_notify(uuid[], text, text), teamhub_realtime_add(text),
  teamhub_email_allowed(text), teamhub_place_profile_field(text, text), info_request_status(uuid)
  from public, anon, authenticated;

-- Authors can't be changed from the website (008_keep_authors). Runs after every tab's tables exist, so it covers
-- each table with an author column, including tabs added later.
do $$
declare
  t record;
begin
  if to_regprocedure('public.teamhub_keep_author()') is null then return; end if;
  for t in
    select c.table_name, array_agg(c.column_name::text order by c.column_name) cols
    from information_schema.columns c
    join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name in ('created_by', 'requested_by', 'reported_by', 'uploaded_by', 'started_by', 'author', 'scout')
    group by c.table_name
  loop
    execute format('drop trigger if exists teamhub_keep_author on public.%I', t.table_name);
    execute format('create trigger teamhub_keep_author before update on public.%I for each row execute function teamhub_keep_author(%s)',
      t.table_name, (select string_agg(quote_literal(x), ', ') from unnest(t.cols) x));
  end loop;
end $$;

-- Defense in depth: TRUNCATE bypasses RLS, so client roles never get it (PostgREST doesn't expose it, but direct
-- connections might). Re-applied every plan so new module tables are covered.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
-- Internal helper that lists who holds a permission: only definer functions need it.
revoke execute on function teamhub_users_with(text, uuid) from public, anon, authenticated;
