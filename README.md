# Spectra Week — Voting Site

A two-page voting site: a public voting page and a password-protected admin
settings page, backed by Supabase.

- `index.html` — public voting page (no password). Voters pick one nominee
  per category and submit. Their choice is remembered locally so they can't
  vote twice in the same category from the same browser/device.
- `admin.html` — settings page, gated by the password `SPECTRA$$$Yo`. Create
  categories, add/remove nominees per category, and view live results.

## Setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase dashboard, open **SQL Editor** and run the contents of
   [`supabase/schema.sql`](supabase/schema.sql). This creates the
   `categories`, `nominees`, `votes` tables and a `nominee_results` view,
   plus the access policies described below.
3. In **Project Settings → API**, copy your **Project URL** and **anon public
   key**.
4. Open [`js/supabaseClient.js`](js/supabaseClient.js) and replace
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` with those values.
5. Serve the folder as a static site (e.g. `npx serve .`, GitHub Pages,
   Netlify, Vercel — any static host works, no build step needed).

## Using it

1. Go to `/admin.html`, enter the password `SPECTRA$$$Yo`, and create your
   categories (e.g. "Employee of the Year") and the nominees in each one.
2. Share `/index.html` with everyone — they select a nominee per category
   and hit **Submit Vote**.
3. Watch tallies update in the **Results** tab of the admin page.

To change the admin password, edit `ADMIN_PASSWORD` at the top of
[`js/admin.js`](js/admin.js).

## A note on security

The admin page's password is a client-side gate only — it is not enforced
by Supabase. To keep things simple (no login system, no backend server),
the database's `anon` key is given read/write access to categories and
nominees, and insert-only access to votes. That means anyone who inspects
the site's JS and knows the Supabase anon key could, in theory, write to
the database directly, bypassing the password prompt. For a low-stakes
internal event vote this trade-off is usually fine. If you need stronger
guarantees, add Supabase Auth and switch the RLS policies in
`supabase/schema.sql` to check `auth.uid()`/role instead of allowing `true`.

Duplicate-vote prevention is also soft: it's based on a random ID stored in
the browser's `localStorage` plus a unique database constraint per
(category, device). Clearing browser storage or using a different
browser/device lets someone vote again — there's no way around this without
requiring people to log in.
