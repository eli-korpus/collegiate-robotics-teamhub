-- Purchase Requests (spec §13.12): request → mentor orders → received. No budget tracking (owner decision).
create table pur_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  item text not null check (char_length(item) between 1 and 200),
  url text check (url ~* '^https?://'),
  qty int not null default 1 check (qty between 1 and 9999),
  est_price numeric(8, 2) check (est_price >= 0),
  reason text check (char_length(reason) <= 1000),
  urgency smallint not null default 1 check (urgency between 0 and 2),
  status text not null default 'requested' check (status in ('requested', 'ordered', 'received', 'declined')),
  requested_by uuid references profiles (id) on delete set null,
  handled_by uuid references profiles (id) on delete set null,
  ordered_at timestamptz,
  received_at timestamptz,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index pur_requests_status_idx on pur_requests (status);

-- Status rules: only orderers move to ordered/received, only decliners decline; requesters may edit while requested.
create or replace function pur_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if current_user in ('authenticated', 'anon') then
      if new.status = 'declined' and not teamhub_can('purchases.decline', new.team_id) then
        raise exception 'Only mentors can decline requests' using errcode = '42501';
      elsif new.status in ('ordered', 'received') and not teamhub_can('purchases.order', new.team_id) then
        raise exception 'Only the people who order can change this' using errcode = '42501';
      elsif new.status = 'requested' and not (teamhub_can('purchases.order', new.team_id) or teamhub_can('purchases.decline', new.team_id)) then
        raise exception 'Not allowed' using errcode = '42501';
      end if;
    end if;
    new.handled_by := auth.uid();
    if new.status = 'ordered' then new.ordered_at := coalesce(new.ordered_at, now()); end if;
    if new.status = 'received' then new.received_at := now(); new.ordered_at := coalesce(new.ordered_at, now()); end if;
  end if;
  return new;
end $$;
create trigger pur_requests_guard before update on pur_requests for each row execute function pur_before_update();

create or replace function pur_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform teamhub_notify(array(select teamhub_users_with('purchases.order', new.team_id)), 'purchases.new', 'purchases:request:' || new.id);
  elsif new.status is distinct from old.status then
    perform teamhub_notify(array[new.requested_by], 'purchases.status', 'purchases:request:' || new.id);
  end if;
  return new;
end $$;
create trigger pur_requests_notify after insert or update of status on pur_requests for each row execute function pur_after_write();

create or replace function pur_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from comments where ref = 'purchases:request:' || old.id;
  return old;
end $$;
create trigger pur_requests_cleanup after delete on pur_requests for each row execute function pur_on_delete();
