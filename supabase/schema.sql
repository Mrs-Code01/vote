-- Spectra Week voting app schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)

create extension if not exists pgcrypto;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists nominees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  nominee_id uuid not null references nominees(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  unique (category_id, device_id)
);

-- Aggregated results, used by the admin results tab
create or replace view nominee_results as
select
  n.id as nominee_id,
  n.category_id,
  n.name as nominee_name,
  count(v.id) as vote_count
from nominees n
left join votes v on v.nominee_id = n.id
group by n.id, n.category_id, n.name;

-- Row Level Security
alter table categories enable row level security;
alter table nominees enable row level security;
alter table votes enable row level security;

-- Everyone (using the public anon key) can read categories/nominees, and vote.
-- NOTE: the "admin" settings page in this app is protected only by a
-- client-side password prompt, not by Supabase auth. That means the anon
-- key also needs write access to categories/nominees so the settings page
-- can create/delete them. Anyone with the anon key (visible in the site's
-- JS) and API knowledge could technically write directly to these tables
-- without the password. For a low-stakes internal event vote this is a
-- reasonable trade-off for not standing up a backend/auth, but if you need
-- real access control, add Supabase Auth and switch these policies to
-- check auth.uid()/role instead.
drop policy if exists "categories read" on categories;
create policy "categories read" on categories for select using (true);
drop policy if exists "categories write" on categories;
create policy "categories write" on categories for all using (true) with check (true);

drop policy if exists "nominees read" on nominees;
create policy "nominees read" on nominees for select using (true);
drop policy if exists "nominees write" on nominees;
create policy "nominees write" on nominees for all using (true) with check (true);

drop policy if exists "votes read" on votes;
create policy "votes read" on votes for select using (true);
drop policy if exists "votes insert" on votes;
create policy "votes insert" on votes for insert with check (true);
