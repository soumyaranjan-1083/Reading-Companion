alter table public.reading_companion_session_limits
  add column if not exists arena_show_photo boolean not null default true,
  add column if not exists arena_avatar_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reading_companion_arena_avatar_path_check'
  ) then
    alter table public.reading_companion_session_limits
      add constraint reading_companion_arena_avatar_path_check
      check (arena_avatar_path is null or arena_avatar_path ~ '^[0-9a-fA-F-]{36}/avatar\.(jpg|png|webp)$');
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reader-arena-avatars', 'reader-arena-avatars', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop function if exists public.get_reading_companion_reader_rankings(text);
create function public.get_reading_companion_reader_rankings(p_period text)
returns table(
  user_id uuid,
  reader_name text,
  total_reading_seconds bigint,
  rank_position bigint,
  arena_avatar_path text,
  arena_show_photo boolean
)
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
    ) as rank_position,
    ranked.arena_avatar_path,
    ranked.arena_show_photo
  from public.reading_companion_session_limits as ranked
  where (case when p_period = 'weekly' then ranked.weekly_reading_seconds else ranked.total_reading_seconds end) > 0
    and (p_period = 'all_time' or ranked.ranking_week_start = ist_week_start)
  order by case when p_period = 'weekly' then ranked.weekly_reading_seconds else ranked.total_reading_seconds end desc,
    ranked.user_id asc;
end;
$$;

revoke all on function public.get_reading_companion_reader_rankings(text) from public, anon, authenticated;
grant execute on function public.get_reading_companion_reader_rankings(text) to service_role;

notify pgrst, 'reload schema';
