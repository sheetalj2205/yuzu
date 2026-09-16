-- Yuzu fix 003 — Web Push, so his phone buzzes with the app closed.
-- Paste into Supabase → SQL Editor → Run.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,     -- the browser's push address
  p256dh      text not null,            -- encryption keys, from the browser
  auth        text not null,
  created_at  timestamptz default now()
);

create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- you may only manage your own device registrations.
-- the send route reads them with the service role key, server-side.
drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
