// api/config.js — hands the frontend its PUBLIC Supabase settings.
// The anon key is safe to expose (Row Level Security protects the data).
// If these env vars are unset, the site runs in local-only mode (no accounts).
export default function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
}
