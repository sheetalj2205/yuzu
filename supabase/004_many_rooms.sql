-- Yuzu 004: she can hold several rooms, and only she can close one.
-- Paste into Supabase -> SQL Editor -> Run.
--
-- Nothing changes shape here. `rooms.her_id` never had a unique constraint, so
-- several rooms per person was always allowed; only the screen stopped her.
-- What does change is who may DELETE.
--
-- "my rooms" was one FOR ALL policy covering both people, which was fine while
-- nothing ever deleted a room. Closing one for good is a real delete now, and it
-- cascades: cycles, gifts and favourites all go with it. Under the old policy HE
-- could have run that delete and taken her history with him. The room is hers,
-- so closing it is hers.

drop policy if exists "my rooms" on public.rooms;

-- both of them can see the room they share
create policy "rooms i am in" on public.rooms
  for select using (auth.uid() = her_id or auth.uid() = him_id);

-- she opens them
create policy "she opens rooms" on public.rooms
  for insert with check (auth.uid() = her_id);

-- either of them may change one; joining goes through join_room() anyway,
-- which is SECURITY DEFINER and does not consult this
create policy "rooms i am in, change" on public.rooms
  for update using (auth.uid() = her_id or auth.uid() = him_id);

-- only she can close one, and closing takes everything in it
create policy "she closes rooms" on public.rooms
  for delete using (auth.uid() = her_id);
