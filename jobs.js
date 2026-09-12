// api/jobs.js — live job feed endpoint. Thin wrapper over lib/feed.js.
import { getJobs } from "../lib/feed.js";

export default async function handler(req, res) {
  try {
    const jobs = await getJobs();
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
