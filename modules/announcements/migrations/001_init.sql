-- Announcements (spec §13.4): one-way posts, no replies. Read receipts only for "must read" posts;
-- normal unread state is per device (localStorage), so no rows.
create table ann_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '' check (char_length(body) <= 8000),
  image_path text,
  pinned boolean not null default false,
  require_ack boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index ann_posts_created_idx on ann_posts (created_at desc);

create table ann_acks (
  post_id uuid not null references ann_posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- "Must read" posts notify everyone in scope (the only announcement notifications).
create or replace function ann_on_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.require_ack then
    perform teamhub_notify(
      array(select distinct m.user_id from memberships m where m.status = 'active' and (new.team_id is null or m.team_id = new.team_id)),
      'announcements.must_read', 'announcements:post:' || new.id);
  end if;
  return new;
end $$;
create trigger ann_posts_notify after insert on ann_posts for each row execute function ann_on_post();

create or replace function ann_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.image_path is not null then perform teamhub_trash('announcements', array[old.image_path]); end if;
  return old;
end $$;
create trigger ann_posts_cleanup after delete on ann_posts for each row execute function ann_on_delete();
