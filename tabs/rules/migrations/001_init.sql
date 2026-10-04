-- Rules Reference (spec §13.23). Program-wide, tagged by season.
create table rule_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('question', 'reminder')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 4000),
  answer text check (char_length(answer) <= 4000),
  rule_ref text check (char_length(rule_ref) <= 40),
  source_url text check (source_url ~* '^https?://'),
  season text not null default teamhub_season(),
  created_by uuid references profiles (id) on delete set null,
  answered_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function rule_on_answer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.answer is not null and old.answer is null then
    perform teamhub_notify(array[new.created_by], 'rules.answered', 'rules:item:' || new.id);
  end if;
  return new;
end $$;
create trigger rule_items_answered after update of answer on rule_items for each row execute function rule_on_answer();
