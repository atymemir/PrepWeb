-- Durable engagement foundation for ALGA.
-- Goals:
-- 1) backend truth for streak + progression
-- 2) backend truth for completed session logging
-- 3) minimal additive schema and RPC surface

create table if not exists public.engagement_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak_days integer not null default 0 check (streak_days >= 0),
  best_streak_days integer not null default 0 check (best_streak_days >= 0),
  lifetime_xp integer not null default 0 check (lifetime_xp >= 0),
  total_sessions integer not null default 0 check (total_sessions >= 0),
  completed_sessions integer not null default 0 check (completed_sessions >= 0),
  total_answers integer not null default 0 check (total_answers >= 0),
  total_correct integer not null default 0 check (total_correct >= 0),
  last_active_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engagement_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id uuid not null,
  mode text not null check (mode in ('practice', 'review')),
  answered_count integer not null check (answered_count >= 0),
  correct_count integer not null check (correct_count >= 0),
  total_questions integer not null check (total_questions >= 0),
  accuracy_pct integer not null check (accuracy_pct >= 0 and accuracy_pct <= 100),
  base_xp integer not null check (base_xp >= 0),
  completion_bonus integer not null check (completion_bonus >= 0),
  accuracy_bonus integer not null check (accuracy_bonus >= 0),
  xp_awarded integer not null check (xp_awarded >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, client_session_id)
);

create index if not exists engagement_sessions_user_created_idx
  on public.engagement_sessions (user_id, created_at desc);

alter table public.engagement_profiles enable row level security;
alter table public.engagement_sessions enable row level security;

drop policy if exists "Users can read own engagement profile" on public.engagement_profiles;
create policy "Users can read own engagement profile"
on public.engagement_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "Users can read own engagement sessions" on public.engagement_sessions;
create policy "Users can read own engagement sessions"
on public.engagement_sessions
for select
using (auth.uid() = user_id);

create or replace function public.record_engagement_session(
  p_client_session_id uuid,
  p_mode text,
  p_answered integer,
  p_correct integer,
  p_total integer
)
returns table (
  session_id uuid,
  duplicate boolean,
  mode text,
  answered_count integer,
  correct_count integer,
  total_questions integer,
  accuracy_pct integer,
  base_xp integer,
  completion_bonus integer,
  accuracy_bonus integer,
  xp_awarded integer,
  completed boolean,
  streak_days integer,
  best_streak_days integer,
  lifetime_xp integer,
  total_sessions integer,
  completed_sessions integer,
  total_answers integer,
  total_correct integer,
  last_active_on date,
  last_session_mode text,
  last_session_accuracy_pct integer,
  last_session_xp_awarded integer,
  last_session_completed_at timestamptz,
  last_session_answered integer,
  last_session_correct integer,
  last_session_total integer,
  last_session_best_streak integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_today date;

  v_answered integer;
  v_correct integer;
  v_total integer;

  v_accuracy integer;
  v_base_xp integer;
  v_completion_bonus integer;
  v_accuracy_bonus integer;
  v_xp integer;
  v_completed boolean;

  v_existing_id uuid;
  v_existing_mode text;
  v_existing_answered integer;
  v_existing_correct integer;
  v_existing_total integer;
  v_existing_accuracy integer;
  v_existing_base_xp integer;
  v_existing_completion_bonus integer;
  v_existing_accuracy_bonus integer;
  v_existing_xp integer;
  v_existing_completed boolean;

  v_streak integer;
  v_best_streak integer;

  v_profile_streak integer;
  v_profile_best_streak integer;
  v_profile_lifetime_xp integer;
  v_profile_total_sessions integer;
  v_profile_completed_sessions integer;
  v_profile_total_answers integer;
  v_profile_total_correct integer;
  v_profile_last_active_on date;

  v_last_mode text;
  v_last_accuracy integer;
  v_last_xp integer;
  v_last_created_at timestamptz;
  v_last_answered integer;
  v_last_correct integer;
  v_last_total integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  if p_client_session_id is null then
    raise exception 'client_session_id is required';
  end if;

  if p_mode not in ('practice', 'review') then
    raise exception 'Invalid mode';
  end if;

  v_answered := greatest(0, least(coalesce(p_answered, 0), 120));
  v_total := greatest(0, least(coalesce(p_total, 0), 120));
  v_correct := greatest(0, least(coalesce(p_correct, 0), v_answered));

  v_accuracy := case
    when v_answered > 0 then round((v_correct::numeric / v_answered::numeric) * 100)::integer
    else 0
  end;

  v_base_xp := (v_correct * 18) + ((v_answered - v_correct) * 6);
  v_completed := v_total > 0 and v_answered >= v_total;
  v_completion_bonus := case when v_completed then 36 else 0 end;

  v_accuracy_bonus := case
    when v_accuracy >= 85 then 22
    when v_accuracy >= 75 then 14
    when v_accuracy >= 65 then 8
    else 0
  end;

  v_xp := v_base_xp + v_completion_bonus + v_accuracy_bonus;

  select
    s.id,
    s.mode,
    s.answered_count,
    s.correct_count,
    s.total_questions,
    s.accuracy_pct,
    s.base_xp,
    s.completion_bonus,
    s.accuracy_bonus,
    s.xp_awarded,
    s.completed
  into
    v_existing_id,
    v_existing_mode,
    v_existing_answered,
    v_existing_correct,
    v_existing_total,
    v_existing_accuracy,
    v_existing_base_xp,
    v_existing_completion_bonus,
    v_existing_accuracy_bonus,
    v_existing_xp,
    v_existing_completed
  from public.engagement_sessions s
  where s.user_id = v_uid
    and s.client_session_id = p_client_session_id
  limit 1;

  insert into public.engagement_profiles (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select
    p.streak_days,
    p.best_streak_days,
    p.lifetime_xp,
    p.total_sessions,
    p.completed_sessions,
    p.total_answers,
    p.total_correct,
    p.last_active_on
  into
    v_profile_streak,
    v_profile_best_streak,
    v_profile_lifetime_xp,
    v_profile_total_sessions,
    v_profile_completed_sessions,
    v_profile_total_answers,
    v_profile_total_correct,
    v_profile_last_active_on
  from public.engagement_profiles p
  where p.user_id = v_uid
  for update;

  if v_existing_id is not null then
    select
      ls.mode,
      ls.accuracy_pct,
      ls.xp_awarded,
      ls.created_at,
      ls.answered_count,
      ls.correct_count,
      ls.total_questions
    into
      v_last_mode,
      v_last_accuracy,
      v_last_xp,
      v_last_created_at,
      v_last_answered,
      v_last_correct,
      v_last_total
    from public.engagement_sessions ls
    where ls.user_id = v_uid
    order by ls.created_at desc
    limit 1;

    return query
    select
      v_existing_id,
      true,
      v_existing_mode,
      v_existing_answered,
      v_existing_correct,
      v_existing_total,
      v_existing_accuracy,
      v_existing_base_xp,
      v_existing_completion_bonus,
      v_existing_accuracy_bonus,
      v_existing_xp,
      v_existing_completed,
      v_profile_streak,
      v_profile_best_streak,
      v_profile_lifetime_xp,
      v_profile_total_sessions,
      v_profile_completed_sessions,
      v_profile_total_answers,
      v_profile_total_correct,
      v_profile_last_active_on,
      v_last_mode,
      v_last_accuracy,
      v_last_xp,
      v_last_created_at,
      v_last_answered,
      v_last_correct,
      v_last_total,
      v_profile_best_streak;

    return;
  end if;

  v_today := current_date;
  v_streak := v_profile_streak;

  if v_answered > 0 then
    if v_profile_last_active_on is null then
      v_streak := 1;
    elsif v_profile_last_active_on = v_today then
      v_streak := v_profile_streak;
    elsif v_profile_last_active_on = (v_today - interval '1 day')::date then
      v_streak := v_profile_streak + 1;
    else
      v_streak := 1;
    end if;
  end if;

  v_best_streak := greatest(v_profile_best_streak, v_streak);

  insert into public.engagement_sessions (
    user_id,
    client_session_id,
    mode,
    answered_count,
    correct_count,
    total_questions,
    accuracy_pct,
    base_xp,
    completion_bonus,
    accuracy_bonus,
    xp_awarded,
    completed
  )
  values (
    v_uid,
    p_client_session_id,
    p_mode,
    v_answered,
    v_correct,
    v_total,
    v_accuracy,
    v_base_xp,
    v_completion_bonus,
    v_accuracy_bonus,
    v_xp,
    v_completed
  )
  returning id into v_existing_id;

  update public.engagement_profiles p
  set
    streak_days = v_streak,
    best_streak_days = v_best_streak,
    lifetime_xp = p.lifetime_xp + v_xp,
    total_sessions = p.total_sessions + 1,
    completed_sessions = p.completed_sessions + case when v_completed then 1 else 0 end,
    total_answers = p.total_answers + v_answered,
    total_correct = p.total_correct + v_correct,
    last_active_on = case when v_answered > 0 then v_today else p.last_active_on end,
    updated_at = now()
  where p.user_id = v_uid
  returning
    p.streak_days,
    p.best_streak_days,
    p.lifetime_xp,
    p.total_sessions,
    p.completed_sessions,
    p.total_answers,
    p.total_correct,
    p.last_active_on
  into
    v_profile_streak,
    v_profile_best_streak,
    v_profile_lifetime_xp,
    v_profile_total_sessions,
    v_profile_completed_sessions,
    v_profile_total_answers,
    v_profile_total_correct,
    v_profile_last_active_on;

  select
    ls.mode,
    ls.accuracy_pct,
    ls.xp_awarded,
    ls.created_at,
    ls.answered_count,
    ls.correct_count,
    ls.total_questions
  into
    v_last_mode,
    v_last_accuracy,
    v_last_xp,
    v_last_created_at,
    v_last_answered,
    v_last_correct,
    v_last_total
  from public.engagement_sessions ls
  where ls.user_id = v_uid
  order by ls.created_at desc
  limit 1;

  return query
  select
    v_existing_id,
    false,
    p_mode,
    v_answered,
    v_correct,
    v_total,
    v_accuracy,
    v_base_xp,
    v_completion_bonus,
    v_accuracy_bonus,
    v_xp,
    v_completed,
    v_profile_streak,
    v_profile_best_streak,
    v_profile_lifetime_xp,
    v_profile_total_sessions,
    v_profile_completed_sessions,
    v_profile_total_answers,
    v_profile_total_correct,
    v_profile_last_active_on,
    v_last_mode,
    v_last_accuracy,
    v_last_xp,
    v_last_created_at,
    v_last_answered,
    v_last_correct,
    v_last_total,
    v_profile_best_streak;
end;
$$;

grant execute on function public.record_engagement_session(uuid, text, integer, integer, integer)
to authenticated;

create or replace function public.get_my_engagement_profile()
returns table (
  streak_days integer,
  best_streak_days integer,
  lifetime_xp integer,
  total_sessions integer,
  completed_sessions integer,
  total_answers integer,
  total_correct integer,
  last_active_on date,
  last_session_mode text,
  last_session_accuracy_pct integer,
  last_session_xp_awarded integer,
  last_session_completed_at timestamptz,
  last_session_answered integer,
  last_session_correct integer,
  last_session_total integer,
  last_session_best_streak integer
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  )
  select
    coalesce(p.streak_days, 0) as streak_days,
    coalesce(p.best_streak_days, 0) as best_streak_days,
    coalesce(p.lifetime_xp, 0) as lifetime_xp,
    coalesce(p.total_sessions, 0) as total_sessions,
    coalesce(p.completed_sessions, 0) as completed_sessions,
    coalesce(p.total_answers, 0) as total_answers,
    coalesce(p.total_correct, 0) as total_correct,
    p.last_active_on,
    ls.mode as last_session_mode,
    ls.accuracy_pct as last_session_accuracy_pct,
    ls.xp_awarded as last_session_xp_awarded,
    ls.created_at as last_session_completed_at,
    ls.answered_count as last_session_answered,
    ls.correct_count as last_session_correct,
    ls.total_questions as last_session_total,
    coalesce(p.best_streak_days, 0) as last_session_best_streak
  from me
  left join public.engagement_profiles p
    on p.user_id = me.uid
  left join lateral (
    select
      s.mode,
      s.accuracy_pct,
      s.xp_awarded,
      s.created_at,
      s.answered_count,
      s.correct_count,
      s.total_questions
    from public.engagement_sessions s
    where s.user_id = me.uid
    order by s.created_at desc
    limit 1
  ) ls on true
  where me.uid is not null;
$$;

grant execute on function public.get_my_engagement_profile()
to authenticated;
