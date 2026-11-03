-- Миграция: открытые походы видны всем вошедшим (без ссылки и QR).
-- Выполнить в Supabase → SQL Editor. Безопасно запускать повторно.
-- Видно только название/магазин/время/имя того, кто идёт; список, чеки и QR — только участникам.

create or replace function public.open_trips() returns table (
  id uuid, title text, store text, planned_for text, owner_id uuid, owner_name text,
  created_at timestamptz, joined boolean
)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.store, t.planned_for, t.owner_id, p.name, t.created_at, public.is_trip_member(t.id)
  from public.trips t
  join public.profiles p on p.id = t.owner_id
  where auth.uid() is not null
    and t.status = 'open'
    and t.created_at > now() - interval '7 days'
  order by t.created_at desc
  limit 50;
$$;

create or replace function public.join_open_trip(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Нужен вход'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Сначала укажите имя';
  end if;
  if not exists (select 1 from public.trips where id = p_id and status = 'open') then
    raise exception 'Поход уже не принимает участников';
  end if;
  insert into public.trip_members (trip_id, user_id) values (p_id, auth.uid()) on conflict do nothing;
  return p_id;
end $$;

revoke execute on function public.open_trips(), public.join_open_trip(uuid) from public, anon;
grant execute on function public.open_trips(), public.join_open_trip(uuid) to authenticated;
