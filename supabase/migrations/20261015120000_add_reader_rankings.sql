alter table public.reading_companion_session_limits
  add column if not exists total_reading_seconds bigint not null default 0 check (total_reading_seconds >= 0),
  add column if not exists reader_name text not null default 'Reader' check (char_length(reader_name) between 1 and 30);

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
      reader_name = safe_reader_name,
      updated_at = now()
  where limits.user_id = p_user_id and limits.usage_date = current_date;

  return query
  select limits.daily_limit_minutes, limits.used_seconds, limits.usage_date
  from public.reading_companion_session_limits as limits
  where limits.user_id = p_user_id;
end;
$$;

create or replace function public.record_reading_companion_session_usage(p_user_id uuid, p_seconds integer)
returns table(daily_limit_minutes integer, used_seconds integer, usage_date date)
language sql
security definer
set search_path = public
as $$
  select * from public.record_reading_companion_session_usage(p_user_id, p_seconds, 'Reader');
$$;

create or replace function public.get_reading_companion_reader_rankings()
returns table(user_id uuid, reader_name text, total_reading_seconds bigint, rank_position bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    ranked.user_id,
    ranked.reader_name,
    ranked.total_reading_seconds,
    row_number() over (order by ranked.total_reading_seconds desc, ranked.user_id asc) as rank_position
  from public.reading_companion_session_limits as ranked
  where ranked.total_reading_seconds > 0
  order by ranked.total_reading_seconds desc, ranked.user_id asc;
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
      reader_name = 'Reader',
      updated_at = now()
  where user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists clear_reader_ranking_after_account_delete on public.reading_companion_accounts;
create trigger clear_reader_ranking_after_account_delete
after delete on public.reading_companion_accounts
for each row execute function public.clear_reader_ranking_after_account_delete();

revoke all on function public.record_reading_companion_session_usage(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.record_reading_companion_session_usage(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_reading_companion_reader_rankings() from public, anon, authenticated;
revoke all on function public.clear_reader_ranking_after_account_delete() from public, anon, authenticated;
grant execute on function public.record_reading_companion_session_usage(uuid, integer, text) to service_role;
grant execute on function public.record_reading_companion_session_usage(uuid, integer) to service_role;
grant execute on function public.get_reading_companion_reader_rankings() to service_role;