# Spectra Week — Voting Site

A two-page voting site: a public voting page and a password-protected admin
settings page, backed by Supabase.

- `index.html` — voting page. Voters verify their email with a 6-digit code,
  then pick one nominee per category. One vote per person, per category,
  enforced by the database — switching devices does not get you a second vote.
- `admin.html` — settings page, gated by the password `SPECTRA$$$Yo`. Create
  categories, add/remove nominees per category, and view live results.

## Setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase dashboard, open **SQL Editor** and run
   [`supabase/schema.sql`](supabase/schema.sql).
   *Upgrading from an older version? Run the migrations in
   [`supabase/`](supabase/) in order instead — they keep your categories and
   nominees.*
3. In **Project Settings → API**, copy your **Project URL** and **anon public
   key** into [`js/supabaseClient.js`](js/supabaseClient.js).
4. **Put the code in the email** (required — see below).
5. **Connect an SMTP service** (required for real events — see below).
6. Serve the folder as a static site (GitHub Pages, Netlify, Vercel, or
   `npx serve .`). No build step.

### 4. Put the code in the email

Supabase's default login email contains only a magic link, not the 6-digit
code the site asks for. Fix it once:

**Authentication → Email Templates → Magic Link**, and make sure the body
includes the token, e.g.:

```html
<h2>Your Spectra Week voting code</h2>
<p>Enter this code on the voting page:</p>
<h1>{{ .Token }}</h1>
<p>It expires in 60 minutes.</p>
```

### 5. Connect an SMTP service

Supabase's built-in email sender is rate-limited to a **handful of emails per
hour** — fine for testing, but it will lock out most of your voters on the day.
Before the event, go to **Project Settings → Authentication → SMTP Settings**
and connect a provider. [Resend](https://resend.com) has a free tier and takes
about ten minutes to set up. Then raise the limit under
**Authentication → Rate Limits**.

## Using it

1. Go to `/admin.html`, enter `SPECTRA$$$Yo`, and create your categories
   (e.g. "Employee of the Year") and the nominees in each.
2. Share `/index.html`. Voters enter their email, get a code, and vote.
3. Watch tallies in the **Results** tab of the admin page.

To change the admin password, edit `ADMIN_PASSWORD` at the top of
[`js/admin.js`](js/admin.js).

## Deciding who can vote

Open the admin page's **Voters** tab. Until you add a rule there, any email
address can register and vote — so one person with several personal addresses
could vote more than once. The tab shows a warning while that's the case.

Two ways to restrict it, and you can combine them:

- **Allowed email domains** — add `spectra.com` and everyone with a work email
  on that domain can vote once. This is the usual choice.
- **Individual voters** — paste in specific addresses for people outside your
  domains (contractors, guests, personal accounts). One per line or
  comma-separated; duplicates are ignored.

Both are enforced by the database against the voter's *verified* email, so the
rule cannot be bypassed from the browser. People who aren't eligible are told
so before any email is sent, rather than getting a code that won't work.

## How one-vote-per-person is enforced

Each vote row stores the voter's account id, taken from their verified login
token rather than anything the browser sends, with a database constraint of one
row per (category, voter). A second vote is rejected by Postgres itself, so it
fails the same way on a laptop, a phone, in incognito, or after clearing
browser data. Row Level Security also means voters can only ever read their own
ballot — nobody can query who voted for whom, and votes cannot be edited or
deleted once cast.

Eligibility is checked at the same moment, against the verified email in the
voter's token. So with a domain or voter list configured, the guarantee is one
vote per eligible mailbox — the only way left to vote twice is to control a
second mailbox that you have explicitly allowed.

## A note on the admin password

The admin page's password is a client-side gate only — it's in `js/admin.js`,
readable by anyone who views the page source, and the anon key has write access
to categories and nominees so the page can function without a backend. It stops
a casual visitor who finds `/admin.html`; it will not stop someone determined.
Votes are *not* exposed this way — those are protected by the policies above.
If you need the admin side properly locked down too, the path is to give
yourself a Supabase Auth account and change the categories/nominees policies to
check for it.
