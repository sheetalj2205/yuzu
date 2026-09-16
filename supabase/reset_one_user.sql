-- Remove ONE person and their data. Put their email in below.

with target as (
  select id from auth.users where email = 'someone@example.com'
)
delete from public.rooms
 where her_id in (select id from target)
    or him_id in (select id from target);

delete from public.profiles where email = 'someone@example.com';
delete from auth.users      where email = 'someone@example.com';
