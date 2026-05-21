-- Keeps answer correctness as a database-side truth.
-- Deploy after verifying the existing public.record_answer_event signature matches:
--   (uuid, text, boolean, boolean, integer)

create or replace function public.record_answer_event_secure(
  p_question_id uuid,
  p_selected_option text,
  p_is_review boolean default false,
  p_time_taken_seconds integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correct_option text;
  v_is_correct boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if upper(p_selected_option) not in ('A', 'B', 'C', 'D') then
    raise exception 'Invalid selected option';
  end if;

  select upper(correct_option::text)
  into v_correct_option
  from public.questions
  where id = p_question_id;

  if v_correct_option is null then
    raise exception 'Question not found';
  end if;

  v_is_correct := upper(p_selected_option) = v_correct_option;

  perform public.record_answer_event(
    p_question_id,
    upper(p_selected_option),
    v_is_correct,
    p_is_review,
    greatest(0, least(coalesce(p_time_taken_seconds, 0), 3600))
  );
end;
$$;

grant execute on function public.record_answer_event_secure(uuid, text, boolean, integer)
to authenticated;

-- Recommended after app traffic has moved to record_answer_event_secure:
-- revoke execute on function public.record_answer_event(uuid, text, boolean, boolean, integer)
-- from anon, authenticated;
