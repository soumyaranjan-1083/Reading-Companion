alter table public.reading_companion_session_limits
  add column if not exists weekly_reading_seconds bigint not null default 0 check (weekly_reading_seconds >= 0),
  add column if not exists ranking_week_start date not null default (date_trunc('week', now() at time zone 'Asia/Kolkata')::date);

create or replace function public.record_reading_companion_session_usage(
  p_user_id uuid,
  p_seconds integer,
  p_reader_name text
)
returns table(daily_limit_minutes integer, used_seconds integer, usage_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_reader_name text := left(regexp_replace(trim(coalesce(p_reader_name, '')), '\s+', ' ', 'g'), 30);
  ist_week_start date := date_trunc('week', now() at time zone 'Asia/Kolkata')::date;
begin
  if p_seconds < 1 or p_seconds > 60 then
    raise exception 'invalid_usage_seconds';
  end if;
  if safe_reader_name = '' then
    safe_reader_name := 'Reader';
  end if;

  perform * from public.get_reading_companion_session_limit(p_user_id);

  update public.reading_companion_session_limits as limits
  set used_seconds = least(limits.daily_limit_minutes * 60, limits.used_seconds + p_seconds),
      total_reading_seconds = limits.total_reading_seconds + p_seconds,
      weekly_reading_seconds = case
        when limits.ranking_week_start = ist_week_start then limits.weekly_reading_seconds + p_seconds
        else p_seconds
      end,
      ranking_week_start = ist_week_start,
      reader_name = safe_reader_name,
      updated_at = now()
  where limits.user_id = p_user_id and limits.usage_date = current_date;

  return query
  select limits.daily_limit_minutes, limits.used_seconds, limits.usage_date
  from public.reading_companion_session_limits as limits
  where limits.user_id = p_user_id;
end;
$$;

create or replace function public.get_reading_companion_reader_rankings(p_period text)
returns table(user_id uuid, reader_name text, total_reading_seconds bigint, rank_position bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ist_week_start date := date_trunc('week', now() at time zone 'Asia/Kolkata')::date;
begin
  if p_period not in ('weekly', 'all_time') then
    raise exception 'invalid_ranking_period';
  end if;

  return query
  select
    ranked.user_id,
    ranked.reader_name,
    case when p_period = 'weekly' then ranked.weekly_reading_seconds else ranked.total_reading_seconds end,
    dense_rank() over (
      order by case when p_period = 'weekly' then ranked.weekly_reading_seconds else ranked.total_reading_seconds end desc
    ) as rank_position
  from public.reading_companion_session_limits as ranked
  where (case when p_period = 'weekly' then ranked.weekly_reading_seconds else ranked.total_reading_seconds end) > 0
    and (p_period = 'all_time' or ranked.ranking_week_start = ist_week_start)
  order by case when p_period = 'weekly' then ranked.weekly_reading_seconds else ranked.total_reading_seconds end desc,
    ranked.user_id asc;
end;
$$;

create or replace function public.clear_reader_ranking_after_account_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reading_companion_session_limits
  set total_reading_seconds = 0,
      weekly_reading_seconds = 0,
      reader_name = 'Reader',
      updated_at = now()
  where user_id = old.user_id;
  return old;
end;
$$;

revoke all on function public.record_reading_companion_session_usage(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.get_reading_companion_reader_rankings(text) from public, anon, authenticated;
revoke all on function public.clear_reader_ranking_after_account_delete() from public, anon, authenticated;
grant execute on function public.record_reading_companion_session_usage(uuid, integer, text) to service_role;
grant execute on function public.get_reading_companion_reader_rankings(text) to service_role;