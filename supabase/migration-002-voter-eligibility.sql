-- Migration: control who is allowed to vote at all.
-- Run this ONCE in the Supabase SQL editor, after migration-001.
--
-- Without this, anyone who can receive email anywhere can register and vote,
-- so one person with several personal addresses could vote several times.
-- After this, you decide who is eligible from the admin page's Voters tab:
-- by work-email domain, by an explicit list of people, or both.

create table if not exists allowed_domains (
  domain text primary key,
  created_at timestamptz not null default now()
);

create table if not exists eligible_voters (
  email text primary key,
  created_at timestamptz not null default now()
);

-- True when no rules are configured at all (voting open to anyone), or when
-- the address matches the allowlist or an allowed domain.
create or replace function is_eligible_voter(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (not exists (select 1 from eligible_voters)
      and not exists (select 1 from allowed_domains))
    or exists (
      select 1 from eligible_voters e
      where e.email = lower(trim(check_email))
    )
    or exists (
      select 1 from allowed_domains d
      where lower(trim(check_email)) like '%@' || d.domain
    );
$$;

grant execute on function is_eligible_voter(text) to anon, authenticated;

alter table allowed_domains enable row level security;
alter table eligible_voters enable row level security;

-- Managed from the admin page, which uses the anon key (see the note in
-- README about the admin password being a client-side gate).
drop policy if exists "allowed_domains write" on allowed_domains;
create policy "allowed_domains write" on allowed_domains
  for all using (true) with check (true);

drop policy if exists "eligible_voters write" on eligible_voters;
create policy "eligible_voters write" on eligible_voters
  for all using (true) with check (true);

-- The vote itself is now gated on eligibility, evaluated against the voter's
-- verified email from their auth token. This is the binding check: the browser
-- cannot talk its way past it.
drop policy if exists "votes insert own" on votes;
create policy "votes insert own" on votes
  for insert to authenticated
  with check (
    auth.uid() = voter_id
    and is_eligible_voter(auth.jwt() ->> 'email')
  );
