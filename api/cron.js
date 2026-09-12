// api/cron.js — the alert engine. Runs on a schedule (Vercel Cron or an external
// cron like cron-job.org). For each active alert it finds newly-posted matching
// jobs the student hasn't been emailed yet and sends them via Resend.
//
// Env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//   ALERT_FROM_EMAIL, CRON_SECRET.  (See README.)
import { getJobs } from "../lib/feed.js";

const SB = process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path, opts = {}) {
  return fetch(`${SB}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SK, Authorization: `Bearer ${SK}`, "content-type": "application/json", ...(opts.headers || {}) },
  });
}

function matches(job, a) {
  if (a.level && a.level !== "any" && job.level !== a.level) return false;
  if (a.remote && !job.remote) return false;
  if (a.loc) {
    const t = String(a.loc).toLowerCase();
    if (t === "remote") { if (!job.remote) return false; }
    else if (!String(job.location || "").toLowerCase().includes(t)) return false;
  }
  if (a.kw) {
    const terms = String(a.kw).toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    if (terms.length) {
      const hay = (job.title + " " + job.company + " " + job.cat).toLowerCase();
      if (!terms.some((term) => hay.includes(term))) return false;
    }
  }
  return true;
}

function emailHTML(jobs) {
  const rows = jobs.map((j) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #e2eae5">
      <a href="${j.url}" style="color:#0B6B4F;font-weight:700;font-size:15px;text-decoration:none">${escapeHtml(j.title)}</a>
      <div style="color:#586b63;font-size:13px;margin-top:3px">${escapeHtml(j.company)} · ${escapeHtml(j.location)} · ${escapeHtml(j.level)}${j.remote ? " · Remote" : ""}</div>
    </td></tr>`).join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="font-size:20px;color:#0f1f1a">${jobs.length} new job${jobs.length > 1 ? "s" : ""} just posted for you</h2>
    <p style="color:#586b63;font-size:14px">Fresh matches from company career pages. Be one of the first to apply.</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="color:#8a9a93;font-size:12px;margin-top:20px">You're getting this because you set a Firstdibs alert.</p>
  </div>`;
}
function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

async function sendEmail(to, jobs, from, key) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject: `${jobs.length} new job${jobs.length > 1 ? "s" : ""} match your Firstdibs alert`, html: emailHTML(jobs) }),
  });
  return r.ok;
}

export default async function handler(req, res) {
  // Protect the endpoint. Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${secret}`) { res.status(401).json({ error: "unauthorized" }); return; }
  }
  if (!SB || !SK) { res.status(501).json({ error: "supabase_not_configured" }); return; }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL || "Firstdibs <onboarding@resend.dev>";

  try {
    const jobs = await getJobs();
    // Only consider jobs posted in the last 3 days, so a brand-new alert isn't
    // backfilled with dozens of old roles. The "sent" table dedupes the rest.
    const recent = jobs.filter((j) => Date.parse(j.postedAt || 0) > Date.now() - 3 * 864e5);

    const aRes = await sb("alerts?active=eq.true&select=user_id,email,kw,level,loc,remote");
    const alerts = aRes.ok ? await aRes.json() : [];

    let usersEmailed = 0, jobsSent = 0;
    for (const a of alerts) {
      if (!a.email) continue;
      const hits = recent.filter((j) => matches(j, a));
      if (!hits.length) continue;

      const sentRes = await sb(`sent?user_id=eq.${a.user_id}&select=job_key`);
      const sentKeys = new Set((sentRes.ok ? await sentRes.json() : []).map((r) => r.job_key));
      const fresh = hits.filter((j) => !sentKeys.has(j.key)).slice(0, 10);
      if (!fresh.length) continue;

      let ok = true;
      if (resendKey) ok = await sendEmail(a.email, fresh, from, resendKey);
      if (ok) {
        await sb("sent", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify(fresh.map((j) => ({ user_id: a.user_id, job_key: j.key }))),
        });
        usersEmailed++;
        jobsSent += fresh.length;
      }
    }
    res.status(200).json({ ok: true, alerts: alerts.length, usersEmailed, jobsSent, ranAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "cron_failed", message: String(e) });
  }
}
