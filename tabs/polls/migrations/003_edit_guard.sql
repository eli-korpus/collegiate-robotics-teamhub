-- A poll's question and choices can be fixed only until someone answers (after that, edits would change what people
-- voted on). Closing time and other fields can always change.
create or replace function poll_edit_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.question is distinct from old.question or new.options is distinct from old.options
      or new.kind is distinct from old.kind or new.multi is distinct from old.multi)
     and exists (select 1 from poll_votes where poll_id = old.id) then
    raise exception 'People have already answered, so the question and choices can''t change. Close it and make a new poll instead.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger poll_polls_edit_guard before update on poll_polls for each row execute function poll_edit_guard();
