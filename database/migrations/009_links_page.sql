-- Links page (1.2.0). Additions only.

-- Bulletin Board became the core Links page. Its policies on the links table are replaced by core ones
-- (core.add_links / core.edit_links in policies.sql), and it's no longer an installed tab. Its links stay: they were
-- always in the core links table.
select teamhub_drop_policies('bul_');
delete from teamhub_modules where id = 'bulletin';
