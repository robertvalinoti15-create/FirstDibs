// api/resume.js — Firstdibs AI resume review
// Vercel Serverless Function. Calls the Anthropic API server-side so the
// resume reviewer works for every visitor with no login and no per-user cost.
//
// Requires one environment variable in Vercel:  ANTHROPIC_API_KEY
// (get a key at https://console.anthropic.com — add billing; each review
//  costs a fraction of a cent). Optional: ANTHROPIC_MODEL.
//
// If the key is missing the endpoint returns 501 and the site falls back to
// its built-in offline check, so the page never breaks.

function extractJSON(text) {
  if (!text) return null;
  // whole thing
  try { return JSON.parse(text); } catch (e) {}
  // fenced ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch (e) {} }
  // first { to last }
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch (er) {} }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(501).json({ error: "ai_not_configured" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const resume = ((body && body.resume) || "").slice(0, 12000);
  const role = body && body.role;
  if (!resume || resume.trim().length < 40) { res.status(400).json({ error: "resume_too_short" }); return; }

  const prompt =
    `You are an expert resume coach for university students applying to internships and entry-level jobs.` +
    (role && role !== "general" ? ` Tailor the review to this target role: ${role}.` : ` Give a general review.`) +
    ` Review the resume and reply with ONLY a JSON object of exactly this shape:\n` +
    `{"score": <integer 0-100>, "headline": "<one-sentence overall verdict>", "strengths": ["<up to 3 short strings>"], "fixes": [{"title":"<short>","detail":"<1-2 sentences>","severity":"high|medium|low"}], "rewrites": [{"before":"<a weak line copied from the resume>","after":"<stronger rewrite using a strong action verb and a concrete metric>"}], "missingKeywords": ["<up to 6 skills or terms worth adding>"]}\n` +
    `Give 3-5 fixes ordered most-important-first, and 2-4 rewrites based on real lines from the resume. Keep every string concise. Resume:\n<<<\n${resume}\n>>>`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
        max_tokens: 1400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: "ai_error", detail: data && data.error }); return; }
    const text = (data.content && data.content[0] && data.content[0].text) || "";
    const json = extractJSON(text);
    if (!json) { res.status(502).json({ error: "parse_failed" }); return; }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(json);
  } catch (e) {
    res.status(502).json({ error: "network", message: String(e) });
  }
}
