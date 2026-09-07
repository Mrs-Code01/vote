# Spectra Week — Voting Site

A two-page voting site: a public voting page and a password-protected admin
settings page, backed by Supabase.

- `index.html` — voting page. Voters type their full name, then pick one
  nominee per category. One vote per name, per category, enforced by the
  database.
- `admin.html` — settings page, gated by the password `SPECTRA$$$Yo`. Create
  categories, add/remove nominees, see who has voted, and view live results.

## Setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase dashboard, open **SQL Editor** and run
   [`supabase/schema.sql`](supabase/schema.sql).
   *Already running an earlier version? Run the highest-numbered migration in
   [`supabase/`](supabase/) instead — it keeps your categories and nominees.*
3. In **Project Settings → API**, copy your **Project URL** and **anon public
   key** into [`js/supabaseClient.js`](js/supabaseClient.js).
4. Serve the folder as a static site (GitHub Pages, Netlify, Vercel, or
   `npx serve .`). No build step, and no environment variables.

## Using it

1. Go to `/admin.html`, enter `SPECTRA$$$Yo`, and create your categories
   (e.g. "Employee of the Year") and the nominees in each.
2. Share `/index.html`. Voters enter their full name and vote.
3. Check the **Voters** tab to see who has voted, and **Results** for tallies.

To change the admin password, edit `ADMIN_PASSWORD` at the top of
[`js/admin.js`](js/admin.js).

## How duplicate voting is handled

Each vote stores the voter's name alongside a normalised version of it —
lowercased with extra spaces collapsed — and the database enforces one vote per
normalised name, per category. So `Mercy Idubor`, `mercy idubor` and
`MERCY  IDUBOR` are all recognised as the same person, and the second vote is
rejected by Postgres itself. That holds on any device, in incognito, and after
clearing browser data. Voters must enter at least two words, so "Joe" won't do.

**What this does not stop.** A name is a claim, not proof. Someone who wants a
second vote can type a colleague's name, or a small variation like
`Jon Smith` instead of `John Smith`, and the database will treat it as a
different person. The **Voters** tab is your defence: it lists everyone who has
voted, how many categories each voted in, and flags names that are suspiciously
similar to each other so you can spot the same person entered twice. Review it
before announcing results.

If you later need this to be airtight, the way to get there is verified
identity — each voter confirming an email they control — which moves the
guarantee from "one vote per name typed" to "one vote per person".

## Ballot secrecy

Nobody can read the votes table directly, including through the public API.
Vote counts and the voter log come from database functions that expose tallies
and *who* voted, but never who voted *for whom*. Votes also cannot be edited or
deleted once cast — there is no policy permitting it.

## A note on the admin password

The admin page's password is a client-side gate only — it's in `js/admin.js`,
readable by anyone who views the page source, and the anon key has write access
to categories and nominees so the page can work without a backend. It stops a
casual visitor who finds `/admin.html`; it will not stop someone determined.
