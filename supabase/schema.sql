-- Yuzu schema. Paste into Supabase → SQL Editor → Run.

create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  gender      text check (gender in ('her','him')),
  created_at  timestamptz default now()
);

create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,              -- the Cuddle Code
  her_id      uuid references profiles(id),
  him_id      uuid references profiles(id),
  created_at  timestamptz default now()
);

create table if not exists cycles (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references rooms(id) on delete cascade,
  message     text not null,                     -- HER WORDS. never sent to his screen.
  intensity   int  not null check (intensity between 1 and 10),
  pattern     jsonb not null,                    -- {envelope, peak, pulse_ms, duration_s, label}
  needs       jsonb not null,                    -- [{tag, label, hints:[3], done}]
  tries       int  default 0,
  revealed    boolean default false,
  closed_at   timestamptz,
  created_at  timestamptz default now()
);

create table if not exists gifts (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid references cycles(id) on delete cascade,
  emoji       text not null,
  name        text not null,
  tag         text not null,
  verdict     text default 'pending' check (verdict in ('pending','helped','no')),
  created_at  timestamptz default now()
);

-- favourites he adds himself
create table if not exists favourites (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references rooms(id) on delete cascade,
  emoji       text not null,
  name        text not null,
  created_at  timestamptz default now()
);

alter publication supabase_realtime add table cycles;
alter publication supabase_realtime add table gifts;

alter table profiles   enable row level security;
alter table rooms      enable row level security;
alter table cycles     enable row level security;
alter table gifts      enable row level security;
alter table favourites enable row level security;

create policy "own profile"  on profiles   for all using (auth.uid() = id);
create policy "my rooms"     on rooms      for all using (auth.uid() = her_id or auth.uid() = him_id);
create policy "my cycles"    on cycles     for all using (exists (
  select 1 from rooms r where r.id = room_id and (r.her_id = auth.uid() or r.him_id = auth.uid())));
create policy "my gifts"     on gifts      for all using (exists (
  select 1 from cycles c join rooms r on r.id = c.room_id
  where c.id = cycle_id and (r.her_id = auth.uid() or r.him_id = auth.uid())));
create policy "my faves"     on favourites for all using (exists (
  select 1 from rooms r where r.id = room_id and (r.her_id = auth.uid() or r.him_id = auth.uid())));
