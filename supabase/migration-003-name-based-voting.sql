-- Migration: go back to simple name-based voting.
-- Run this ONCE in the Supabase SQL editor. It removes the email-login setup
-- and replaces it with "type your full name to vote".
--
-- Your categories and nominees are kept. Any votes already cast are cleared,
-- because there is no way to map a logged-in account back to a person's name.
--
-- After this you can ignore the SMTP and email-template setup entirely.

-- Remove the email-login machinery.
drop function if exists is_eligible_voter(text);
drop function if exists voted_categories(text);
drop table if exists eligible_voters;
drop table if exists allowed_domains;
drop view if exists nominee_results;
drop table if exists votes;

-- One vote per person, per category, keyed on their name.
-- voter_key normalises the name -- lowercased, with runs of whitespace
-- collapsed -- so "Mercy  Idubor", "mercy idubor" and "MERCY IDUBOR" all
-- count as the same person.
create table votes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  nominee_id uuid not null references nominees(id) on delete cascade,
  voter_name text not null,
  voter_key text generated always as (
    lower(regexp_replace(btrim(voter_name), '\s+', ' ', 'g'))
  ) stored,
  created_at timestamptz not null default now(),
  -- Require at least two words, so people give a full name rather than "Joe".
  constraint voter_name_is_full check (position(' ' in btrim(voter_name)) > 0),
  unique (category_id, voter_key)
);

alter table votes enable row level security;

-- Anyone can cast a vote; nobody can read the votes table directly, so the
-- ballot stays secret. Counts and the voter log come from the functions below.
drop policy if exists "votes insert" on votes;
create policy "votes insert" on votes for insert with check (true);

-- Vote tallies for the admin Results tab.
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

-- Which categories this name has already voted in, so the voting page shows
-- the right state even on a different device. Returns no nominee ids, so it
-- cannot be used to find out who someone voted for.
create or replace function voted_categories(check_name text)
returns table (category_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select v.category_id
  from votes v
  where v.voter_key = lower(regexp_replace(btrim(check_name), '\s+', ' ', 'g'));
$$;

-- The voter log for the admin Voters tab: who voted and when, but not for
-- whom.
create or replace function get_voter_log()
returns table (
  voter_name text,
  category_name text,
  voted_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select v.voter_name, c.name, v.created_at
  from votes v
  join categories c on c.id = v.category_id
  order by v.created_at desc;
$$;

grant execute on function get_results() to anon, authenticated;
grant execute on function voted_categories(text) to anon, authenticated;
grant execute on function get_voter_log() to anon, authenticated;
