-- SAT System 2.0 foundation:
-- 1) persistent session history across practice/review/exam
-- 2) per-session topic movement snapshots for trend analytics

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id uuid not null,
  mode text not null check (mode in ('practice', 'review', 'exam')),
  variant text,
  subject text,
  subskill text,
  total_questions integer not null check (total_questions >= 0),
  answered_count integer not null check (answered_count >= 0),
  correct_count integer not null check (correct_count >= 0),
  accuracy_pct integer not null check (accuracy_pct >= 0 and accuracy_pct <= 100),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  outcome text,
  score_band_low integer check (score_band_low is null or (score_band_low >= 800 and score_band_low <= 1600)),
  score_band_high integer check (score_band_high is null or (score_band_high >= 800 and score_band_high <= 1600)),
  created_at timestamptz not null default now(),
  unique (user_id, mode, client_session_id)
);

create index if not exists study_sessions_user_created_idx
  on public.study_sessions (user_id, created_at desc);

create index if not exists study_sessions_user_mode_created_idx
  on public.study_sessions (user_id, mode, created_at desc);

create table if not exists public.study_session_topics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('practice', 'review', 'exam')),
  subject text,
  topic text not null,
  correct_count integer not null check (correct_count >= 0),
  total_count integer not null check (total_count >= 0),
  accuracy_pct integer not null check (accuracy_pct >= 0 and accuracy_pct <= 100),
  created_at timestamptz not null default now()
);

create index if not exists study_session_topics_user_created_idx
  on public.study_session_topics (user_id, created_at desc);

create index if not exists study_session_topics_user_topic_idx
  on public.study_session_topics (user_id, topic);

alter table public.study_sessions enable row level security;
alter table public.study_session_topics enable row level security;

drop policy if exists "Users can read own study sessions" on public.study_sessions;
create policy "Users can read own study sessions"
on public.study_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own study sessions" on public.study_sessions;
create policy "Users can insert own study sessions"
on public.study_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can read own study session topics" on public.study_session_topics;
create policy "Users can read own study session topics"
on public.study_session_topics
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own study session topics" on public.study_session_topics;
create policy "Users can insert own study session topics"
on public.study_session_topics
for insert
with check (auth.uid() = user_id);
