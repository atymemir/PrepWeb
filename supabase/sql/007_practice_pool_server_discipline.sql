-- Practice pool server discipline:
-- 1) backend-enforced fresh vs revisit separation
-- 2) keep due-review questions out of forward-practice pools
-- 3) reduce casual repetition via seen-state ordering + cooldown preference

create or replace function public.get_practice_questions_fresh(
  p_subject text,
  p_subskill text default null,
  p_limit integer default 12,
  p_scan integer default 220
)
returns table (
  id uuid,
  subject text,
  topic text,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text,
  explanation text,
  difficulty_level integer
)
language sql
security definer
set search_path = public
as $$
  with params as (
    select
      greatest(1, least(coalesce(p_limit, 12), 60)) as limit_count,
      greatest(36, least(coalesce(p_scan, 220), 640)) as scan_count,
      greatest(120, least(coalesce(p_scan, 220) * 2, 1200)) as due_scan
  ),
  me as (
    select auth.uid() as uid
  ),
  due as (
    select dq.id
    from params,
      public.get_due_review_questions((select due_scan from params)) dq
  ),
  pool as (
    select
      q.id,
      q.subject,
      q.topic,
      q.question_text,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_option,
      q.explanation,
      q.difficulty_level
    from params,
      public.get_practice_questions(p_subject, p_subskill, (select scan_count from params)) q
  )
  select
    pool.id,
    pool.subject,
    pool.topic,
    pool.question_text,
    pool.option_a,
    pool.option_b,
    pool.option_c,
    pool.option_d,
    pool.correct_option,
    pool.explanation,
    pool.difficulty_level
  from pool
  left join me
    on true
  left join public.practice_fresh_seen seen
    on seen.user_id = me.uid
   and seen.question_id = pool.id
  left join due
    on due.id = pool.id
  where due.id is null
    and seen.question_id is null
  order by random()
  limit (select limit_count from params);
$$;

grant execute on function public.get_practice_questions_fresh(text, text, integer, integer)
to authenticated;

create or replace function public.get_practice_questions_revisit(
  p_subject text,
  p_subskill text default null,
  p_limit integer default 12,
  p_scan integer default 260,
  p_cooldown_minutes integer default 45
)
returns table (
  id uuid,
  subject text,
  topic text,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text,
  explanation text,
  difficulty_level integer
)
language sql
security definer
set search_path = public
as $$
  with params as (
    select
      greatest(1, least(coalesce(p_limit, 12), 60)) as limit_count,
      greatest(36, least(coalesce(p_scan, 260), 800)) as scan_count,
      greatest(120, least(coalesce(p_scan, 260) * 2, 1400)) as due_scan,
      greatest(0, least(coalesce(p_cooldown_minutes, 45), 720)) as cooldown_minutes
  ),
  me as (
    select auth.uid() as uid
  ),
  due as (
    select dq.id
    from params,
      public.get_due_review_questions((select due_scan from params)) dq
  ),
  pool as (
    select
      q.id,
      q.subject,
      q.topic,
      q.question_text,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_option,
      q.explanation,
      q.difficulty_level
    from params,
      public.get_practice_questions(p_subject, p_subskill, (select scan_count from params)) q
  )
  select
    pool.id,
    pool.subject,
    pool.topic,
    pool.question_text,
    pool.option_a,
    pool.option_b,
    pool.option_c,
    pool.option_d,
    pool.correct_option,
    pool.explanation,
    pool.difficulty_level
  from pool
  join me
    on me.uid is not null
  join public.practice_fresh_seen seen
    on seen.user_id = me.uid
   and seen.question_id = pool.id
  left join due
    on due.id = pool.id
  where due.id is null
  order by
    case
      when seen.last_seen_at <= now() - make_interval(mins => (select cooldown_minutes from params)) then 0
      else 1
    end,
    seen.last_seen_at asc,
    seen.seen_count desc,
    random()
  limit (select limit_count from params);
$$;

grant execute on function public.get_practice_questions_revisit(text, text, integer, integer, integer)
to authenticated;
