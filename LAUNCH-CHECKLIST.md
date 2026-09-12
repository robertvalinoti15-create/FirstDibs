# Firstdibs — Launch Checklist

A simple, ordered list to go from code to real students using it. Check each off.

## 1. Get it online
- [ ] Unzip the project and upload it to a GitHub repo.
- [ ] Import the repo into Vercel and Deploy (you get a live `*.vercel.app` URL).
- [ ] Visit `your-site.vercel.app/api/jobs` — confirm real job data loads.

## 2. Turn on the features (Vercel → Settings → Environment Variables, then Redeploy)
- [ ] **AI resume review:** add `ANTHROPIC_API_KEY` (console.anthropic.com, add billing).
- [ ] **Accounts:** create a Supabase project, run `supabase-schema.sql` in its SQL Editor,
      then add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **Alert emails:** create a Resend account, add `RESEND_API_KEY`, and set a
      `CRON_SECRET` (any long random string).
- [ ] Redeploy so the keys take effect.

## 3. Turn on the alert engine
- [ ] Create a free cron-job.org job hitting `your-site.vercel.app/api/cron` every 15 min
      with header `Authorization: Bearer <CRON_SECRET>`.
- [ ] Test it once by hand and confirm it returns `{"ok":true,...}`.

## 4. Test the whole flow yourself (before inviting anyone)
- [ ] Sign up with a real email → complete onboarding → confirm you land in the feed.
- [ ] Save a job and mark one as applied → confirm they show in Applied.
- [ ] Set an alert → wait for the next cron run → confirm you receive an email.
- [ ] Run the resume reviewer on a real resume → confirm you get AI feedback.
- [ ] Open the site on your phone → confirm it works and looks right.

## 5. Legal & trust (do BEFORE real students sign up)
- [ ] Fill in the `[bracketed]` fields in `privacy.html` and `terms.html`
      (your name/company, contact email, date, your state/country).
- [ ] Have someone knowledgeable review them — you're collecting emails from people who
      may be minors.
- [ ] Confirm the Privacy/Terms links work (footer + sign-up screen).
- [ ] Decide your minimum age and make sure onboarding/copy reflects it.

## 6. Email deliverability (so alerts don't land in spam)
- [ ] In Resend, add and verify your own domain, then set
      `ALERT_FROM_EMAIL="Firstdibs <alerts@yourdomain.com>"` (the default resend.dev
      address is fine for testing only).
- [ ] Send yourself a test alert and check it doesn't land in spam.

## 7. Branding & content
- [ ] Decide the final name (⚡ "Firstdibs" is a placeholder) and update it in
      `index.html`, `privacy.html`, `terms.html`.
- [ ] Review the company list in `lib/feed.js` — add companies students at your school
      care about.
- [ ] (Optional) Buy a domain (~$10–15/yr) and connect it in Vercel → Settings → Domains.

## 8. Soft launch
- [ ] Share with 5–10 friends first. Ask: did alerts arrive? were jobs relevant?
      anything confusing?
- [ ] Fix what they trip on, then share more widely (class group chats, clubs, subreddits).

## 9. Keep an eye on it
- [ ] Check the Vercel dashboard occasionally for errors on `/api/*`.
- [ ] Watch your Anthropic and Resend usage the first week.
- [ ] Add an easy way for users to give feedback (even just your email).

---

### Costs at a glance
| Thing | Cost |
|---|---|
| Vercel (Hobby), Supabase, Resend, cron-job.org | Free tiers |
| Anthropic API (resume AI) | Pay-as-you-go, ~fractions of a cent per review |
| Custom domain (optional) | ~$10–15/year |
