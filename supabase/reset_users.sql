-- ⚠️  DESTRUCTIVE, wipes every account and everything they did.
-- Use it to start clean before a demo. There is no undo.
--
-- Order matters: rooms point at profiles, profiles point at auth.users.
-- Deleting rooms first takes cycles, gifts and favourites with it (cascade).

delete from public.rooms;        -- cascades → cycles → gifts, and favourites
delete from public.profiles;
delete from auth.users;

-- what's left (should be four zeros)
select
  (select count(*) from auth.users)       as users,
  (select count(*) from public.profiles)  as profiles,
  (select count(*) from public.rooms)     as rooms,
  (select count(*) from public.cycles)    as cycles;
