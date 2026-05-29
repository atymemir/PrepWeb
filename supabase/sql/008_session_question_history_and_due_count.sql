-- Session question-level history + due queue count helper.

create table if not exists public.study_session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  position integer not null check (position > 0),
  subject text,
  topic text,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  selected_option text not null check (selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  is_review boolean not null default false,
  time_taken_seconds integer not null default 0 check (time_taken_seconds >= 0),
  explanation text,
  created_at timestamptz not null default now()
);

create index if not exists study_session_questions_user_session_position_idx
  on public.study_session_questions (user_id, session_id, position);

create index if not exists study_session_questions_user_created_idx
  on public.study_session_questions (user_id, created_at desc);

create index if not exists study_session_questions_user_topic_idx
  on public.study_session_questions (user_id, topic);

alter table public.study_session_questions enable row level security;

drop policy if exists "Users can read own study session questions" on public.study_session_questions;
create policy "Users can read own study session questions"
on public.study_session_questions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own study session questions" on public.study_session_questions;
create policy "Users can insert own study session questions"
on public.study_session_questions
for insert
with check (auth.uid() = user_id);

create or replace function public.get_due_review_count(
  p_scan integer default 2000
)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.get_due_review_questions(greatest(1, least(coalesce(p_scan, 2000), 20000)));
$$;

grant execute on function public.get_due_review_count(integer)
to authenticated;
