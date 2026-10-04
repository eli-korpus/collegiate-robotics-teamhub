-- Votes were given under a stated visibility, so a poll can only become MORE private after it is created, and its
-- question type and team can't change (that would re-scope existing answers). Not security definer: needs current_user.
create or replace function poll_guard() returns trigger
language plpgsql set search_path = public as $$
declare rank_old int; rank_new int;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  rank_old := case old.visibility when 'public' then 0 when 'results' then 1 else 2 end;
  rank_new := case new.visibility when 'public' then 0 when 'results' then 1 else 2 end;
  if rank_new < rank_old then raise exception 'A poll can only be made more private, never less' using errcode = '42501'; end if;
  if new.kind <> old.kind or new.team_id is distinct from old.team_id or new.created_by is distinct from old.created_by then
    raise exception 'You can''t change who a poll is for, its type or its creator' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger poll_polls_guard before update on poll_polls for each row execute function poll_guard();
