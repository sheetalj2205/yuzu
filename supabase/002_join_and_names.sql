-- Yuzu fix 002, let him actually join, and let partners see each other's names.
-- Paste into Supabase → SQL Editor → Run.

-- ---------------------------------------------------------------------------
-- 1. JOINING
--
-- "my rooms" only lets you see a room you are already in, but when he types a
-- Cuddle Code he is not in it yet, so the lookup found nothing and the app said
-- "No room with that Cuddle Code".
--
-- Rather than letting anyone read every room, joining goes through one function
-- that runs with elevated rights and does exactly one thing: claim an empty
-- him_id on a room whose code matches.
-- ---------------------------------------------------------------------------
create or replace function public.join_room(p_code text)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms%rowtype;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  select * into r from public.rooms where public.rooms.code = upper(trim(p_code)) limit 1;
  if not found then
    return;                                  -- no such code
  end if;

  if r.her_id = me then
    raise exception 'that is your own room';
  end if;

  if r.him_id is not null and r.him_id <> me then
    raise exception 'someone else is already in that room';
  end if;

  if r.him_id is null then
    update public.rooms set him_id = me where public.rooms.id = r.id;
  end if;

  return query select r.id, r.code;
end;
$$;

revoke all on function public.join_room(text) from public;
grant execute on function public.join_room(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. NAMES
--
-- profiles was self-only, so "Kabir joined to feel your pain" could never load
-- his name. This lets you read the profile of the person you share a room with,
-- and nobody else's.
-- ---------------------------------------------------------------------------
drop policy if exists "partner profile" on public.profiles;
create policy "partner profile" on public.profiles
  for select using (
    exists (
      select 1 from public.rooms r
      where (r.her_id = auth.uid() and r.him_id = public.profiles.id)
         or (r.him_id = auth.uid() and r.her_id = public.profiles.id)
    )
  );
