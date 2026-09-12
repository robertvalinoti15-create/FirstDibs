# Firstdibs

A free website that helps students **be first to apply** to new jobs. It pulls
live openings straight from company career pages (Greenhouse, Lever, Ashby),
alerts students by email the moment a matching role appears, tracks their
applications, and gives an AI review of their resume.

This is a real, deployable app. Everything below runs on free tiers.

---

## What's included

- **Live job feed** (`/api/jobs`) — real internships / new-grad / entry-level roles
  from ~30 companies' ATS feeds, newest first, with real Apply links.
- **Email alerts** (`/api/cron`) — a scheduled checker finds new matching roles per
  student and emails them. This is the "be first to apply" engine.
- **Accounts** — real sign-up / login (Supabase), profiles + alert rules saved to a
  database.
- **AI resume review** (`/api/resume`) — scores a resume and rewrites bullets.
- **Applied-jobs tracker + saved jobs** — status pipeline for everything a student
  applies to, **synced across their devices** when signed in.

> The app runs in two modes. With **no environment variables**, it deploys and works
> in local-only mode (jobs feed + tracker in the browser; resume falls back to an
> offline check; no accounts/alerts). Add the keys below to turn on accounts, AI, and
> email alerts.

---

## Setup (about 30–40 minutes, all free)

### Step 1 — Deploy the site (get it online)

**Easiest (no command line):**
1. Free **GitHub** account → **New repository** `firstdibs` → **uploading an existing
   file** → drag in every file/folder from this project → commit.
2. Free **Vercel** account (sign up with GitHub) → **Add New → Project** → import the
   repo → **Deploy**. Leave all settings default.
3. You get a live URL like `https://firstdibs.vercel.app`. The **jobs feed is already
   live**.

**Or via CLI:** `npm i -g vercel` then `vercel` and `vercel --prod` in this folder.

### Step 2 — Turn on the AI resume review (optional)
- Get a key at https://console.anthropic.com (add a little billing — reviews cost a
  fraction of a cent).
- Vercel → your project → **Settings → Environment Variables** → add `ANTHROPIC_API_KEY`.
- **Redeploy** (Deployments → ⋯ → Redeploy).

### Step 3 — Turn on accounts (Supabase, free)
1. Create a project at https://supabase.com.
2. **SQL Editor** → paste the contents of `supabase-schema.sql` → **Run** (creates the
   tables + security rules).
3. **Project Settings → API** → copy:
   - Project URL → set `SUPABASE_URL` in Vercel
   - `anon` `public` key → set `SUPABASE_ANON_KEY`
   - `service_role` key (secret!) → set `SUPABASE_SERVICE_ROLE_KEY`
4. (Optional but nice) **Authentication → Providers → Email**: turn off "Confirm email"
   for faster testing, or leave it on for production.
5. **Redeploy.** Sign-up / login are now real, and profiles + alerts save to the DB.

### Step 4 — Turn on email alerts (Resend, free)
1. Create an account at https://resend.com → **API Keys** → create one → set
   `RESEND_API_KEY` in Vercel.
2. For testing you can send from `onboarding@resend.dev` (the default). For real
   launch, add and verify your domain in Resend and set
   `ALERT_FROM_EMAIL="Firstdibs <alerts@yourdomain.com>"`.
3. Set `CRON_SECRET` in Vercel to any long random string (this protects the cron
   endpoint).
4. **Redeploy.**

### Step 5 — Schedule the alert checker

The checker lives at `/api/cron`. Two free ways to run it on a schedule:

- **Vercel Cron (built in):** `vercel.json` already defines an hourly run. Note: the
  free **Hobby** plan runs crons **once per day**; hourly/every-few-minutes needs
  Vercel Pro.
- **Free 15-minute checks (recommended):** use https://cron-job.org (free).
  Create a job that requests `https://YOUR-SITE.vercel.app/api/cron` every 15 minutes,
  and under **Advanced → Headers** add:
  `Authorization: Bearer <your CRON_SECRET>`.
  This gives true "first to apply" freshness at no cost.

You can also test it by hand:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://YOUR-SITE.vercel.app/api/cron
```
It returns a summary like `{"ok":true,"alerts":3,"usersEmailed":2,"jobsSent":5}`.

---

## How it works

```
Browser (index.html)
  |  GET  /api/jobs      -> live roles from Greenhouse/Lever/Ashby (lib/feed.js)
  |  POST /api/resume    -> Anthropic -> resume feedback
  |  Supabase (accounts) -> sign-up/login, profile + alert rule saved per user
  v
Vercel (free hosting + serverless functions)
  |
  |  /api/cron (scheduled): re-fetch feeds -> match each user's alert against NEW
  |            roles -> email matches via Resend -> record in "sent" so none repeat
```

- **No job is ever emailed twice** (the `sent` table dedupes per user).
- A brand-new alert won't get spammed with old roles (only jobs from the last 3 days
  are considered).

---

## Editing

- **Companies:** edit the `COMPANIES` list at the top of `lib/feed.js`
  (`["greenhouse"|"lever"|"ashby", "<token>"]`). Bad tokens are skipped automatically.
- **Look / copy / branding:** all in `index.html`. "Firstdibs" is a placeholder name.
- **Alert email design:** the `emailHTML()` function in `api/cron.js`.
- **AI model:** `ANTHROPIC_MODEL` env var.

## Environment variables

See `.env.example`. Summary:

| Variable | Needed for | Secret? |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI resume review | yes |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | accounts (frontend) | no (anon is public) |
| `SUPABASE_SERVICE_ROLE_KEY` | cron reads alerts / writes sent | **yes** |
| `RESEND_API_KEY` | sending alert emails | yes |
| `ALERT_FROM_EMAIL` | the "from" on alert emails | no |
| `CRON_SECRET` | protects `/api/cron` | yes |

## Notes & honest caveats

- **Freshness:** Greenhouse exposes `updated_at`, not original post time; Lever/Ashby
  give true post times. The cron's "last 3 days + dedupe" logic keeps alerts sensible.
- **Costs:** Vercel Hobby, Supabase, Resend, and cron-job.org all have free tiers. Only
  Anthropic is pay-as-you-go (cheap) and it's optional. A custom domain is ~$10–15/yr.
- **Saved jobs & the applied tracker sync across devices** when a student is signed in
  (stored in Supabase). Signed out, or with Supabase not configured, they fall back to
  the browser (localStorage). If you set Supabase up before this version, **re-run
  `supabase-schema.sql`** — it's safe to run again and adds the new `saved` and
  `applications` tables.
- **Legal for a real launch:** add a Privacy Policy and Terms, and decide how you
  handle under-18 users (some students are minors) — this matters now that you collect
  emails. Free generators (e.g. Termly) cover the basics.
- This app deliberately does **not** scrape LinkedIn/Indeed, which is what keeps it
  above-board.
