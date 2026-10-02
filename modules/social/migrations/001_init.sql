-- Social Media Planner (spec §13.27): Idea → Draft → Needs approval → Scheduled → Posted. Never posts automatically.
create table soc_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  platforms text[] not null default '{}',
  caption text not null default '' check (char_length(caption) <= 5000),
  media_ref text check (char_length(media_ref) <= 500),
  status text not null default 'idea' check (status in ('idea', 'draft', 'approval', 'scheduled', 'posted')),
  scheduled_for timestamptz,
  posted_url text check (posted_url ~* '^https?://'),
  created_by uuid references profiles (id) on delete set null,
  approved_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index soc_posts_sched_idx on soc_posts (scheduled_for) where scheduled_for is not null;

-- Moving to Scheduled needs approval rights; marking Posted needs mark_posted. Editing the caption of an approved post
-- sends it back for approval. Not security definer: current_user must be the caller's role.
create or replace function soc_guard() returns trigger
language plpgsql set search_path = public as $$
declare v_approver boolean;
begin
  new.updated_at := now();
  if current_user not in ('authenticated', 'anon') then return new; end if;
  v_approver := teamhub_can('social.approve', new.team_id);
  if new.status = 'posted' and (tg_op = 'INSERT' or old.status <> 'posted') and not teamhub_can('social.mark_posted', new.team_id) then
    raise exception 'You can''t mark posts as posted' using errcode = '42501';
  end if;
  if new.status = 'scheduled' and (tg_op = 'INSERT' or old.status not in ('scheduled', 'posted')) then
    if not v_approver then raise exception 'Only approvers can schedule a post — move it to "Needs approval"' using errcode = '42501'; end if;
    new.approved_by := auth.uid();
  end if;
  if tg_op = 'UPDATE' and new.status = 'scheduled' and not v_approver and (new.caption <> old.caption or new.media_ref is distinct from old.media_ref) then
    new.status := 'approval';
    new.approved_by := null;
  end if;
  if new.status in ('idea', 'draft', 'approval') then new.approved_by := null; end if;
  return new;
end $$;
create trigger soc_posts_guard before insert or update on soc_posts for each row execute function soc_guard();
