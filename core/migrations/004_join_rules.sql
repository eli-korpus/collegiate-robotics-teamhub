-- Optional sign-up rule: only email addresses from certain domains (e.g. a school's) can create an account, plus any
-- specific addresses an admin allows (e.g. a mentor's personal email). Edited in Admin > Who can join and in the setup
-- wizard. Enforced here, in the database, so it can't be skipped by calling the sign-up API directly. Additions only.

alter table teamhub_settings add column if not exists allowed_email_domains text[] not null default '{}';

-- Lowercase domains like "collegiateschool.org", at most 20.
create or replace function teamhub_valid_domains(p_domains text[]) returns boolean
language sql immutable as $$
  select cardinality(p_domains) <= 20
    and coalesce((select bool_and(d ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') from unnest(p_domains) d), true)
$$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'teamhub_settings_domains_valid') then
    alter table teamhub_settings add constraint teamhub_settings_domains_valid check (teamhub_valid_domains(allowed_email_domains));
  end if;
end $$;

-- Specific addresses allowed whatever their domain (e.g. a mentor's personal email). Admins only: the addresses are
-- personal information.
create table if not exists teamhub_allowed_emails (
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[a-z0-9.-]+\.[a-z0-9-]+$'),
  note text check (length(note) <= 120),
  added_by uuid references profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- True when this email may sign up: no domain rule is set, its domain is allowed (subdomains count, so
-- "students.school.org" matches "school.org"), or the address itself is allowed.
create or replace function teamhub_email_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  with s as (select allowed_email_domains doms from teamhub_settings where id = 1),
       e as (select lower(trim(p_email)) addr, lower(split_part(trim(p_email), '@', 2)) dom)
  select coalesce((
    select cardinality(s.doms) = 0
      or exists (select 1 from teamhub_allowed_emails a where a.email = e.addr)
      or exists (select 1 from unnest(s.doms) d where e.dom = d or right(e.dom, length(d) + 1) = '.' || d)
    from s, e), true)
$$;

-- What the public sign-up page needs to show ("Use your @school.org email"). The allowed individual addresses stay
-- private.
create or replace function teamhub_join_rules() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('allowed_email_domains', coalesce((select to_jsonb(allowed_email_domains) from teamhub_settings where id = 1), '[]'::jsonb))
$$;

-- Same as before (001_core), plus the email rule at the top.
create or replace function teamhub_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  req text := coalesce(meta->>'requested_type', 'member');
  t text;
begin
  if not teamhub_email_allowed(new.email) then
    raise exception 'TEAMHUB_EMAIL_NOT_ALLOWED: this program only accepts sign-ups from certain email addresses'
      using errcode = 'P0001';
  end if;
  if req not in ('member', 'captain', 'mentor') then req := 'member'; end if;
  insert into profiles (id, display_name, status)
  values (new.id, left(coalesce(nullif(trim(meta->>'name'), ''), split_part(new.email, '@', 1)), 80), 'pending')
  on conflict (id) do nothing;
  if jsonb_typeof(meta->'teams') = 'array' then
    for t in select jsonb_array_elements_text(meta->'teams') loop
      if exists (select 1 from teams where id::text = t and not archived) then
        insert into memberships (user_id, team_id, type, status, requested_type, note)
        values (new.id, t::uuid, req, 'pending', req, left(meta->>'note', 300))
        on conflict do nothing;
      end if;
    end loop;
  end if;
  return new;
end $$;
