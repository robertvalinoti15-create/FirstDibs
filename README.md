# Firstdibs

A free website that helps students **be first to apply** to new jobs. It pulls
live openings straight from company career pages (Greenhouse, Lever, Ashby),
lets students filter to what fits them, tracks what they've applied to, and
gives an AI review of their resume.

This is a real, deployable app — not a mockup. You can put it online tonight for
free.

---

## What works right now

- **Live job feed** (`/api/jobs`) — really fetches current internships / new-grad /
  entry-level roles from ~30 companies' career-page feeds, newest first, with real
  "Apply" links to each company's site. No sample data.
- **Filters, save, and an applied-jobs tracker** — students filter by field, level,
  location, and remote; save jobs; and track applications through a status pipeline.
- **AI resume review** (`/api/resume`) — a real AI coach that scores a resume and
  gives fixes and rewritten bullets. Works for every visitor (runs on your API key).
- **Sign-up / onboarding** — accounts and profiles (stored in the browser for now).

## What's next (a second evening — see "Roadmap" below)

- **Email alerts** the moment a matching job appears (needs a database + email service).
- **Cross-device accounts** (needs a database — Supabase free tier).

---

## Deploy it free (about 15 minutes)

You'll use **Vercel** — free hosting that runs both the website and its `/api`
functions. Pick whichever path feels easier.

### Path A — GitHub + Vercel (most visual, no command line)

1. **Make a free GitHub account** at https://github.com and click **New repository**.
   Name it `firstdibs`, keep it Public or Private, create it.
2. On the new repo page, click **uploading an existing file**, then drag in *all*
   the files from this folder (`index.html`, the `api` folder, `package.json`,
   `.gitignore`, `.env.example`). Commit.
3. Go to https://vercel.com and **Sign up with GitHub** (free "Hobby" plan).
4. Click **Add New… → Project**, pick your `firstdibs` repo, and click **Deploy**.
   Leave every setting at its default (no framework, no build command).
5. In ~30 seconds you get a live URL like `https://firstdibs.vercel.app`. That's it —
   the job feed is already live.
6. **Turn on the AI resume review** (optional but recommended): in your Vercel
   project, go to **Settings → Environment Variables**, add
   `ANTHROPIC_API_KEY` with a key from https://console.anthropic.com, then
   **Deployments → … → Redeploy**.

### Path B — Vercel CLI (fastest if you're comfortable in a terminal)

```bash
npm i -g vercel        # one-time
cd firstdibs
vercel                 # answer the prompts -> preview URL
vercel --prod          # -> production URL

# add the AI key (optional), then redeploy
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

### Want a custom domain (e.g. firstdibs.app)?

Buy one (~$10–15/yr) from any registrar and add it under **Vercel → Settings →
Domains**. Everything else stays free.

---

## Editing the app

- **Add or remove companies:** open `api/jobs.js` and edit the `COMPANIES` list at the
  top. Each entry is `["greenhouse" | "lever" | "ashby", "<board-token>"]`. The token
  is the company's id in its careers URL. Wrong or dead tokens are skipped
  automatically, so you can't break the feed by adding one.
  - Find tokens: Greenhouse boards look like `boards.greenhouse.io/<token>`, Lever
    `jobs.lever.co/<token>`, Ashby `jobs.ashbyhq.com/<token>`.
- **Change the look / copy / branding:** everything visual is in `index.html`
  (one file — HTML, CSS, and JS together). "Firstdibs" is a placeholder name.
- **Change the AI model:** set `ANTHROPIC_MODEL` in your env vars.

---

## How it works (plain version)

```
Student's browser (index.html)
        |
        |  GET /api/jobs         -> fetches live feeds from Greenhouse/Lever/Ashby,
        |                           keeps student roles, returns newest-first JSON
        |  POST /api/resume      -> sends resume to Anthropic, returns AI feedback
        v
   Vercel (free hosting + serverless functions)
```

No database yet — job data is fetched fresh and cached for a few minutes; accounts
and applications live in the student's browser. That's fine for launch; the roadmap
below adds a database when you're ready for alerts.

---

## Roadmap to the full vision

1. **Email alerts (the headline feature).** Add a database (Supabase free tier) to
   store users, their alert filters, and which jobs have been seen. Add a scheduled
   job (Vercel Cron) that re-checks the feeds every few minutes and emails matches
   (Resend/Postmark free tier). This is what makes students *first* to apply.
2. **Real accounts.** Move sign-up/login and the applied-jobs tracker to Supabase so
   they follow students across devices.
3. **Application status updates.** ATS feeds don't expose your application status.
   Best route: let students connect Gmail and parse confirmation / interview /
   rejection emails (needs Google OAuth + a privacy policy). Manual status editing
   already works today.
4. **More coverage.** Add companies, plus a fallback scraper for career pages not on
   a supported ATS (respect each site's robots.txt).

## Notes & honest caveats

- **Freshness:** Greenhouse exposes `updated_at`, not the original post time, so
  "posted X ago" for Greenhouse roles reflects the last update. Lever and Ashby give
  true post/publish times. Good enough to surface new roles; the alert engine (step 1)
  is what nails "first to apply."
- **Cost:** Vercel Hobby is free. The Anthropic API is pay-as-you-go and cheap
  (a resume review is a fraction of a cent) — the only thing that isn't $0, and it's
  optional.
- **Legal for a real launch:** add a Privacy Policy and Terms, and decide how you
  handle under-18 users (some students are minors — this matters once you collect
  emails). Generators like Termly can create free basic versions.
- Don't scrape LinkedIn/Indeed — this app deliberately doesn't, which is what keeps
  it above-board.
