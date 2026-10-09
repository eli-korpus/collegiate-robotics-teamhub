-- Album photo limit follows the module setting (re-applied on every plan).
create or replace function med_check_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'photo' and (select count(*) from med_items where album_id = new.album_id and kind = 'photo') >= {{settings.maxPhotosPerAlbum}} then
    raise exception 'This album is full ({{settings.maxPhotosPerAlbum}} photos). Start a new album or link a Google Photos/Drive album.' using errcode = 'P0001';
  end if;
  return new;
end $$;

alter table med_albums enable row level security;
alter table med_items enable row level security;
create policy med_albums_read on med_albums for select to authenticated using (teamhub_in_team(team_id));
create policy med_albums_insert on med_albums for insert to authenticated with check (teamhub_can('media.upload', team_id) and created_by = (select auth.uid()));
create policy med_albums_change on med_albums for update to authenticated
  using (created_by = (select auth.uid()) or teamhub_can('media.delete_any', team_id)) with check (teamhub_can('media.upload', team_id) or teamhub_can('media.delete_any', team_id));
create policy med_albums_delete on med_albums for delete to authenticated using (created_by = (select auth.uid()) or teamhub_can('media.delete_any', team_id));
create policy med_items_read on med_items for select to authenticated using (exists (select 1 from med_albums a where a.id = album_id and teamhub_in_team(a.team_id)));
create policy med_items_insert on med_items for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and exists (select 1 from med_albums a where a.id = album_id and teamhub_can('media.upload', a.team_id)));
create policy med_items_change on med_items for update to authenticated using (uploaded_by = (select auth.uid())) with check (uploaded_by = (select auth.uid()));
create policy med_items_delete on med_items for delete to authenticated using (
  uploaded_by = (select auth.uid()) or exists (select 1 from med_albums a where a.id = album_id and (a.created_by = (select auth.uid()) or teamhub_can('media.delete_any', a.team_id))));
