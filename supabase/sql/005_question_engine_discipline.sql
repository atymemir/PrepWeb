-- Question engine discipline foundation:
-- 1) durable fresh-practice seen tracking
-- 2) explicit RPC surface for seen-mark + seen-read
-- This file is additive and does not alter review scheduling logic.

create table if not exists public.practice_fresh_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 1 check (seen_count >= 1),
  primary key (user_id, question_id)
);

create index if not exists practice_fresh_seen_user_last_seen_idx
  on public.practice_fresh_seen (user_id, last_seen_at desc);

alter table public.practice_fresh_seen enable row level security;

drop policy if exists "Users can read own fresh-seen rows" on public.practice_fresh_seen;
create policy "Users can read own fresh-seen rows"
on public.practice_fresh_seen
for select
using (auth.uid() = user_id);

create or replace function public.mark_practice_question_seen(
  p_question_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  if p_question_id is null then
    raise exception 'question_id is required';
  end if;

  insert into public.practice_fresh_seen (
    user_id,
    question_id,
    first_seen_at,
    last_seen_at,
    seen_count
  )
  values (
    v_uid,
    p_question_id,
    now(),
    now(),
    1
  )
  on conflict (user_id, question_id)
  do update
  set
    last_seen_at = now(),
    seen_count = public.practice_fresh_seen.seen_count + 1;
end;
$$;

grant execute on function public.mark_practice_question_seen(uuid)
to authenticated;

create or replace function public.get_my_seen_practice_questions(
  p_subject text default null,
  p_topic text default null,
  p_limit integer default 2000
)
returns table (
  question_id uuid
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  )
  select s.question_id
  from me
  join public.practice_fresh_seen s
    on s.user_id = me.uid
  join public.questions q
    on q.id = s.question_id
  where me.uid is not null
    and (p_subject is null or q.subject = p_subject)
    and (
      p_topic is null
      or lower(coalesce(q.topic, '')) = lower(p_topic)
    )
  order by s.last_seen_at desc
  limit greatest(1, least(coalesce(p_limit, 2000), 5000));
$$;

grant execute on function public.get_my_seen_practice_questions(text, text, integer)
to authenticated;
