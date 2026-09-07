-- Migration: move from device-based voting to verified one-vote-per-person.
-- Run this ONCE in the Supabase SQL editor if you already ran the original
-- schema.sql. Your categories and nominees are kept.
--
-- WARNING: this drops the old votes table. Votes cast under the old
-- device-based system cannot be carried over, because there is no way to tell
-- which person each device belonged to. Run this before real voting opens.

drop view if exists nominee_results;
drop table if exists votes;

create table votes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  nominee_id uuid not null references nominees(id) on delete cascade,
  voter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (category_id, voter_id)
);

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

alter table votes enable row level security;

create policy "votes insert own" on votes
  for insert to authenticated
  with check (auth.uid() = voter_id);

create policy "votes read own" on votes
  for select to authenticated
  using (auth.uid() = voter_id);
