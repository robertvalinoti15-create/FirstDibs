// lib/feed.js — shared live-feed logic used by /api/jobs and /api/cron.
// Fetches current openings from company ATS feeds (Greenhouse / Lever / Ashby),
// keeps student-relevant roles, normalizes, de-dupes, returns newest-first.
//
// EDIT COMPANIES HERE. Each entry is [ats, token]; bad tokens are skipped.

export const COMPANIES = [
  // Greenhouse (boards-api.greenhouse.io/v1/boards/<token>/jobs)
  ["greenhouse", "stripe"], ["greenhouse", "databricks"], ["greenhouse", "airbnb"],
  ["greenhouse", "coinbase"], ["greenhouse", "gitlab"], ["greenhouse", "dropbox"],
  ["greenhouse", "robinhood"], ["greenhouse", "instacart"], ["greenhouse", "reddit"],
  ["greenhouse", "brex"], ["greenhouse", "discord"], ["greenhouse", "benchling"],
  ["greenhouse", "samsara"], ["greenhouse", "roblox"], ["greenhouse", "twitch"],
  ["greenhouse", "flexport"], ["greenhouse", "airtable"], ["greenhouse", "asana"],
  ["greenhouse", "duolingo"], ["greenhouse", "cloudflare"], ["greenhouse", "affirm"],
  ["greenhouse", "gusto"], ["greenhouse", "wealthfront"], ["greenhouse", "nextdoor"],
  // Ashby (api.ashbyhq.com/posting-api/job-board/<token>)
  ["ashby", "ramp"], ["ashby", "linear"], ["ashby", "vercel"], ["ashby", "notion"],
  ["ashby", "openai"],
  // Lever (api.lever.co/v0/postings/<token>?mode=json) — add as ["lever","<token>"]
];

const STUDENT_RE = /\b(intern|internship|new\s?grad|new\s?graduate|university\s?grad(uate)?|early\s?career|entry[\s-]?level|apprentice|co-?op|graduate\s+(program|programme|scheme|engineer|analyst|associate|developer)|junior)\b/i;

export function levelOf(title) {
  const t = title.toLowerCase();
  if (/\bintern|internship|co-?op\b/.test(t)) return "Internship";
  if (/new\s?grad|new\s?graduate|university\s?grad|graduate\s+(program|programme|scheme)/.test(t)) return "New Grad";
  return "Entry";
}

export function catOf(title) {
  const t = title.toLowerCase();
  if (/(engineer|developer|swe|software|programmer|sre|infrastructure|platform|security|mobile|frontend|backend|full[\s-]?stack)/.test(t)) return "Engineering";
  if (/(data|machine learning|\bml\b|\bai\b|analyst|analytics|scientist|research)/.test(t)) return "Data";
  if (/(product manager|\bapm\b|product management|program manager|\btpm\b)/.test(t)) return "Product";
  if (/(design|\bux\b|\bui\b|researcher|brand designer)/.test(t)) return "Design";
  if (/(marketing|growth|content|social|seo|communications|\bpr\b)/.test(t)) return "Marketing";
  if (/(sales|business|finance|operations|strategy|recruit|people|account|partnership)/.test(t)) return "Business";
  return "Other";
}

function titleCase(slug) {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchJSON(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Firstdibs/1.0" } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function greenhouse(token) {
  const data = await fetchJSON(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`);
  if (!data || !Array.isArray(data.jobs)) return [];
  const company = titleCase(token);
  return data.jobs.map((j) => {
    const loc = (j.location && j.location.name) || "—";
    return { title: j.title, company, location: loc, remote: /remote/i.test(loc), url: j.absolute_url, ats: "Greenhouse", postedAt: j.updated_at || null };
  });
}
async function lever(token) {
  const data = await fetchJSON(`https://api.lever.co/v0/postings/${token}?mode=json`);
  if (!Array.isArray(data)) return [];
  const company = titleCase(token);
  return data.map((j) => {
    const loc = (j.categories && j.categories.location) || "—";
    return { title: j.text, company, location: loc, remote: (j.workplaceType || "").toLowerCase() === "remote" || /remote/i.test(loc), url: j.hostedUrl, ats: "Lever", postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null };
  });
}
async function ashby(token) {
  const data = await fetchJSON(`https://api.ashbyhq.com/posting-api/job-board/${token}`);
  if (!data || !Array.isArray(data.jobs)) return [];
  const company = titleCase(token);
  return data.jobs.map((j) => {
    const loc = j.location || "—";
    return { title: j.title, company, location: loc, remote: !!j.isRemote || /remote/i.test(loc), url: j.applyUrl || j.jobUrl, ats: "Ashby", postedAt: j.publishedAt || null };
  });
}
const FETCHERS = { greenhouse, lever, ashby };

// Returns a normalized, filtered, de-duped, newest-first array of student jobs.
export async function getJobs() {
  const results = await Promise.allSettled(
    COMPANIES.map(([ats, token]) => (FETCHERS[ats] ? FETCHERS[ats](token) : Promise.resolve([])))
  );
  let jobs = [];
  for (const r of results) if (r.status === "fulfilled" && Array.isArray(r.value)) jobs = jobs.concat(r.value);
  jobs = jobs.filter((j) => j && j.title && j.url && STUDENT_RE.test(j.title));
  jobs = jobs.map((j) => ({ ...j, level: levelOf(j.title), cat: catOf(j.title), key: j.company + "|" + j.title }));
  const map = new Map();
  for (const j of jobs) {
    const prev = map.get(j.key);
    if (!prev || Date.parse(j.postedAt || 0) > Date.parse(prev.postedAt || 0)) map.set(j.key, j);
  }
  jobs = [...map.values()];
  jobs.sort((a, b) => Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0));
  return jobs.slice(0, 600);
}
