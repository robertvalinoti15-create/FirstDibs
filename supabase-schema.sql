-- Firstdibs — Supabase schema. Run this once in your Supabase project:
-- Dashboard -> SQL Editor -> paste -> Run.

-- Each user's saved onboarding profile (fields, level, location, notify prefs).
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  profile    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Each user's active alert rule (what the cron matches new jobs against).
create table if not exists public.alerts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  kw         text default '',
  level      text default 'any',
  loc        text default '',
  remote     boolean default false,
  active     boolean default true,
  created_at timestamptz not null default now()
);

-- Dedupe: which jobs we've already emailed each user.
create table if not exists public.sent (
  id       bigserial primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  job_key  text not null,
  sent_at  timestamptz not null default now(),
  unique (user_id, job_key)
);

-- Row Level Security: users touch only their own rows. The cron uses the
-- service-role key, which bypasses RLS.
alter table public.profiles enable row level security;
alter table public.alerts   enable row level security;
alter table public.sent     enable row level security;

create policy "own profile read"   on public.profiles for select using (auth.uid() = user_id);
create policy "own profile write"  on public.profiles for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.profiles for update using (auth.uid() = user_id);

create policy "own alert read"   on public.alerts for select using (auth.uid() = user_id);
create policy "own alert write"  on public.alerts for insert with check (auth.uid() = user_id);
create policy "own alert update" on public.alerts for update using (auth.uid() = user_id);

-- No client policies on public.sent: only the service-role cron reads/writes it.

-- Cross-device sync: a user's saved jobs and their application tracker.
create table if not exists public.saved (
  user_id    uuid references auth.users(id) on delete cascade,
  job_key    text not null,
  job        jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, job_key)
);
create table if not exists public.applications (
  user_id    uuid references auth.users(id) on delete cascade,
  key        text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.saved        enable row level security;
alter table public.applications enable row level security;
create policy "own saved" on public.saved for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own apps"  on public.applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
