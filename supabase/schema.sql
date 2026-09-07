-- Spectra Week voting app schema (full install, for a fresh project).
-- Already running an earlier version? Run supabase/migration-001-auth-voting.sql
-- instead -- this file assumes empty tables.

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

-- One vote per verified account, per category. voter_id is filled in from the
-- caller's auth token, so a voter cannot submit on someone else's behalf, and
-- the unique constraint makes a second vote impossible from ANY device.
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  nominee_id uuid not null references nominees(id) on delete cascade,
  voter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (category_id, voter_id)
);

-- Results are exposed through a security-definer function rather than a plain
-- view, so the admin page can read vote *counts* without anyone being able to
-- read the votes table itself (which would reveal who voted for whom).
create or replace function get_results()
returns table (
  nominee_id uuid,
  category_id uuid,
  nominee_name text,
  vote_count bigint
)
language sql
security definer
set search_path = public
as $$
  select n.id, n.category_id, n.name, count(v.id)
  from nominees n
  left join votes v on v.nominee_id = n.id
  group by n.id, n.category_id, n.name;
$$;

grant execute on function get_results() to anon, authenticated;

-- Row Level Security
alter table categories enable row level security;
alter table nominees enable row level security;
alter table votes enable row level security;

-- Categories and nominees: readable by everyone, writable with the anon key.
-- NOTE: the admin settings page is protected only by a client-side password
-- prompt, not by Supabase auth, so the anon key needs write access here.
-- Anyone who extracts the anon key from the site's JS could write to these
-- tables directly. Votes themselves are NOT exposed this way -- see below.
drop policy if exists "categories read" on categories;
create policy "categories read" on categories for select using (true);
drop policy if exists "categories write" on categories;
create policy "categories write" on categories for all using (true) with check (true);

drop policy if exists "nominees read" on nominees;
create policy "nominees read" on nominees for select using (true);
drop policy if exists "nominees write" on nominees;
create policy "nominees write" on nominees for all using (true) with check (true);

-- Votes: only signed-in users, only as themselves, and they can only read
-- their own ballot. No update/delete policy exists, so a cast vote is final.
drop policy if exists "votes read" on votes;
drop policy if exists "votes insert" on votes;

drop policy if exists "votes insert own" on votes;
create policy "votes insert own" on votes
  for insert to authenticated
  with check (auth.uid() = voter_id);

drop policy if exists "votes read own" on votes;
create policy "votes read own" on votes
  for select to authenticated
  using (auth.uid() = voter_id);

-- OPTIONAL: restrict voting to your company's email domain, enforced by the
-- database. Without this, anyone with any email address can create an account
-- and vote -- which means one determined person with several personal email
-- addresses could still vote more than once. Replace yourcompany.com below,
-- uncomment, and run it. Set the same domain in ALLOWED_EMAIL_DOMAINS in
-- js/supabaseClient.js so the site shows a helpful message up front.
--
-- drop policy if exists "votes insert own" on votes;
-- create policy "votes insert own" on votes
--   for insert to authenticated
--   with check (
--     auth.uid() = voter_id
--     and lower(auth.jwt() ->> 'email') like '%@yourcompany.com'
--   );
