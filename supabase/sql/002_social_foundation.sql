-- Foundation for the intended alga social layer:
-- friends, friend requests, and shared SAT-work streaks.
-- This file is intentionally additive and does not touch review scheduling.

create table if not exists public.friend_edges (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friend_edges_requester_idx
on public.friend_edges (requester_id, status);

create index if not exists friend_edges_addressee_idx
on public.friend_edges (addressee_id, status);

create table if not exists public.friend_streaks (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  current_streak_days integer not null default 0,
  longest_streak_days integer not null default 0,
  user_a_checked_on date,
  user_b_checked_on date,
  last_extended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friend_streaks_user_a_idx
on public.friend_streaks (user_a);

create index if not exists friend_streaks_user_b_idx
on public.friend_streaks (user_b);

alter table public.friend_edges enable row level security;
alter table public.friend_streaks enable row level security;

drop policy if exists "Users can see own friend edges" on public.friend_edges;
create policy "Users can see own friend edges"
on public.friend_edges
for select
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can create own friend requests" on public.friend_edges;
create policy "Users can create own friend requests"
on public.friend_edges
for insert
with check (auth.uid() = requester_id);

drop policy if exists "Users can update received friend requests" on public.friend_edges;
create policy "Users can update received friend requests"
on public.friend_edges
for update
using (auth.uid() = addressee_id or auth.uid() = requester_id)
with check (auth.uid() = addressee_id or auth.uid() = requester_id);

drop policy if exists "Users can see own friend streaks" on public.friend_streaks;
create policy "Users can see own friend streaks"
on public.friend_streaks
for select
using (auth.uid() = user_a or auth.uid() = user_b);

-- Actual streak extension should happen in a SECURITY DEFINER RPC after answer events,
-- so users cannot manually grant themselves shared streak progress.
