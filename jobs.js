// api/jobs.js — Firstdibs live job feed
// Runs as a Vercel Serverless Function (Node 18+, global fetch available).
// It fetches CURRENT openings straight from company Applicant Tracking Systems
// (Greenhouse / Lever / Ashby), keeps the student-relevant ones, normalizes
// them into one shape, de-dupes, and returns newest-first JSON.
//
// TO ADD / REMOVE COMPANIES: edit the COMPANIES list below. Each entry is
// [ats, token] where token is the company's board id in that ATS's URL.
// Unknown or dead tokens are skipped silently, so a wrong entry never breaks
// the feed — it just contributes nothing.

const COMPANIES = [
  // --- Greenhouse (boards-api.greenhouse.io/v1/boards/<token>/jobs) ---
  ["greenhouse", "stripe"],
  ["greenhouse", "databricks"],
  ["greenhouse", "airbnb"],
  ["greenhouse", "coinbase"],
  ["greenhouse", "gitlab"],
  ["greenhouse", "dropbox"],
  ["greenhouse", "robinhood"],
  ["greenhouse", "instacart"],
  ["greenhouse", "reddit"],
  ["greenhouse", "brex"],
  ["greenhouse", "discord"],
  ["greenhouse", "benchling"],
  ["greenhouse", "samsara"],
  ["greenhouse", "roblox"],
  ["greenhouse", "twitch"],
  ["greenhouse", "flexport"],
  ["greenhouse", "airtable"],
  ["greenhouse", "asana"],
  ["greenhouse", "duolingo"],
  ["greenhouse", "cloudflare"],
  ["greenhouse", "affirm"],
  ["greenhouse", "gusto"],
  ["greenhouse", "wealthfront"],
  ["greenhouse", "nextdoor"],
  // --- Ashby (api.ashbyhq.com/posting-api/job-board/<token>) ---
  ["ashby", "ramp"],
  ["ashby", "linear"],
  ["ashby", "vercel"],
  ["ashby", "notion"],
  ["ashby", "openai"],
  // --- Lever (api.lever.co/v0/postings/<token>?mode=json) ---
  // Add Lever companies here as [ "lever", "<token>" ]
];

// Only keep roles a student can actually apply to.
const STUDENT_RE = /\b(intern|internship|new\s?grad|new\s?graduate|university\s?grad(uate)?|early\s?career|entry[\s-]?level|apprentice|co-?op|graduate\s+(program|programme|scheme|engineer|analyst|associate|developer)|junior)\b/i;

function levelOf(title) {
  const t = title.toLowerCase();
  if (/\bintern|internship|co-?op\b/.test(t)) return "Internship";
  if (/new\s?grad|new\s?graduate|university\s?grad|graduate\s+(program|programme|scheme)/.test(t)) return "New Grad";
  return "Entry";
}

function catOf(title) {
  const t = title.toLowerCase();
  if (/(engineer|developer|swe|software|programmer|sre|infrastructure|platform|security|mobile|frontend|backend|full[\s-]?stack)/.test(t)) return "Engineering";
  if (/(data|machine learning|\bml\b|\bai\b|analyst|analytics|scientist|research)/.test(t)) return "Data";
  if (/(product manager|\bapm\b|product management|program manager|\btpm\b)/.test(t)) return "Product";
  if (/(design|\bux\b|\bui\b|researcher|brand designer)/.test(t)) return "Design";
  if (/(marketing|growth|content|social|seo|communications|\bpr\b)/.test(t)) return "Marketing";
  if (/(sales|business|finance|operations|strategy|recruit|people|account|partnership)/.test(t)) return "Business";
  return "Other";
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
    return {
      title: j.title,
      company,
      location: loc,
      remote: /remote/i.test(loc),
      url: j.absolute_url,
      ats: "Greenhouse",
      postedAt: j.updated_at || null,
    };
  });
}

async function lever(token) {
  const data = await fetchJSON(`https://api.lever.co/v0/postings/${token}?mode=json`);
  if (!Array.isArray(data)) return [];
  const company = titleCase(token);
  return data.map((j) => {
    const loc = (j.categories && j.categories.location) || "—";
    return {
      title: j.text,
      company,
      location: loc,
      remote: (j.workplaceType || "").toLowerCase() === "remote" || /remote/i.test(loc),
      url: j.hostedUrl,
      ats: "Lever",
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    };
  });
}

async function ashby(token) {
  const data = await fetchJSON(`https://api.ashbyhq.com/posting-api/job-board/${token}`);
  if (!data || !Array.isArray(data.jobs)) return [];
  const company = titleCase(token);
  return data.jobs.map((j) => {
    const loc = j.location || "—";
    return {
      title: j.title,
      company,
      location: loc,
      remote: !!j.isRemote || /remote/i.test(loc),
      url: j.applyUrl || j.jobUrl,
      ats: "Ashby",
      postedAt: j.publishedAt || null,
    };
  });
}

function titleCase(slug) {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const FETCHERS = { greenhouse, lever, ashby };

export default async function handler(req, res) {
  try {
    const results = await Promise.allSettled(
      COMPANIES.map(([ats, token]) => (FETCHERS[ats] ? FETCHERS[ats](token) : Promise.resolve([])))
    );

    let jobs = [];
    for (const r of results) if (r.status === "fulfilled" && Array.isArray(r.value)) jobs = jobs.concat(r.value);

    // keep student-relevant, valid rows
    jobs = jobs.filter((j) => j && j.title && j.url && STUDENT_RE.test(j.title));

    // enrich
    jobs = jobs.map((j) => ({ ...j, level: levelOf(j.title), cat: catOf(j.title) }));

    // de-dupe by company + title (keep the most recently posted)
    const map = new Map();
    for (const j of jobs) {
      const key = j.company + "|" + j.title;
      const prev = map.get(key);
      if (!prev || (Date.parse(j.postedAt || 0) > Date.parse(prev.postedAt || 0))) map.set(key, j);
    }
    jobs = [...map.values()];

    // newest first, cap
    jobs.sort((a, b) => Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0));
    jobs = jobs.slice(0, 600);

    // cache at the edge for 5 min, serve stale while refreshing
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      companies: new Set(jobs.map((j) => j.company)).size,
      count: jobs.length,
      jobs,
    });
  } catch (e) {
    res.status(500).json({ error: "feed_failed", message: String(e) });
  }
}
