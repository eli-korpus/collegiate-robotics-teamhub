-- Tool links always have a kind now ("Other" when none fits). Before, Admin > Tool links could save a link as
-- "Not pinned" (no slot), and it then showed up nowhere. Remove those. Links without a slot are also Bulletin Board
-- links, so only do this when Bulletin Board has never been installed (enabled or turned off with its data kept).
delete from links
where slot is null
  and not exists (select 1 from teamhub_modules where id = 'bulletin');

-- "Request info" was replaced by the Setup assistant on Home; old requests aren't used any more. The table stays
-- (older copies of the site may still read it) but has no client policies.
delete from info_requests;
