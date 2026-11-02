-- «Сходим в магазин?» — схема базы. Выполнить целиком в Supabase → SQL Editor.
-- Безопасность: доступ к походу только у тех, кто открыл его по ссылке (trip_members);
-- всё проверяется политиками RLS, а не кодом сайта.

-- ── Таблицы ───────────────────────────────────────────────

-- Имя человека (вход анонимный — id выдаёт Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

-- Поход в магазин
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),  -- секрет в ссылке-приглашении
  owner_id uuid not null references public.profiles(id) on delete cascade,        -- тот, кто идёт и покупает
  title text not null check (char_length(btrim(title)) between 1 and 80),
  store text check (char_length(store) <= 60),
  planned_for text check (char_length(planned_for) <= 60),                        -- «пт, 13:00» — свободный текст
  status text not null default 'open' check (status in ('open', 'bought', 'closed')),
  receipt_path text,                                                              -- фото чека в хранилище
  qr_path text,                                                                   -- QR для оплаты
  receipt_total numeric(12, 2) check (receipt_total >= 0),
  created_at timestamptz not null default now()
);

-- Кто открыл поход по ссылке; paid — отметка «этот человек вернул деньги»
create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  paid boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- Позиции списка
create table public.items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  qty integer not null default 1 check (qty between 1 and 99),
  note text check (char_length(note) <= 200),
  price numeric(12, 2) check (price >= 0),         -- цена за штуку, вносит покупатель
  missing boolean not null default false,          -- «не нашли / не купили»
  created_at timestamptz not null default now()
);
create index items_trip_idx on public.items (trip_id, created_at);

-- Справочник цен покупателя: «запомнить цену позиции»
create table public.product_prices (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  key text not null check (char_length(key) between 1 and 100),   -- название в нижнем регистре, без лишних пробелов
  name text not null check (char_length(name) between 1 and 100),
  price numeric(12, 2) not null check (price >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ── Вспомогательные функции (security definer — чтобы политики не зацикливались) ──

create function public.is_trip_member(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trip_members where trip_id = p_trip and user_id = auth.uid());
$$;

create function public.is_trip_owner(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = p_trip and owner_id = auth.uid());
$$;

-- есть ли у меня с этим человеком общий поход (чтобы видеть его имя)
create function public.shares_trip(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members a
    join public.trip_members b on b.trip_id = a.trip_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- id похода из пути файла «<trip_id>/<файл>» (или null, если путь не такой)
create function public.storage_trip_id(p_name text) returns uuid
language sql immutable set search_path = public, storage as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(p_name))[1]::uuid
  end;
$$;

-- ── RPC ───────────────────────────────────────────────────

-- Создать поход (и сразу стать его участником)
create function public.create_trip(p_title text, p_store text, p_planned text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Нужен вход'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Сначала укажите имя';
  end if;
  if (select count(*) from public.trips where owner_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Слишком много походов за сутки';
  end if;
  insert into public.trips (owner_id, title, store, planned_for)
  values (auth.uid(), btrim(p_title), nullif(btrim(coalesce(p_store, '')), ''), nullif(btrim(coalesce(p_planned, '')), ''))
  returning id into v_id;
  insert into public.trip_members (trip_id, user_id) values (v_id, auth.uid());
  return v_id;
end $$;

-- Присоединиться к походу по секрету из ссылки
create function public.join_trip(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Нужен вход'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Сначала укажите имя';
  end if;
  select id into v_id from public.trips where token = p_token;
  if v_id is null then raise exception 'Поход не найден: проверьте ссылку'; end if;
  insert into public.trip_members (trip_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end $$;

-- ── Триггер: правила для позиций, которые нельзя выразить политиками ──
create function public.items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_status text;
begin
  select owner_id, status into v_owner, v_status from public.trips where id = new.trip_id;

  if tg_op = 'INSERT' then
    if v_status <> 'open' then raise exception 'Список закрыт: приём позиций окончен'; end if;
    if new.price is not null or new.missing then raise exception 'Цены вносит тот, кто покупает'; end if;
    if (select count(*) from public.items where trip_id = new.trip_id and user_id = new.user_id) >= 40 then
      raise exception 'Слишком много позиций от одного человека';
    end if;
    return new;
  end if;

  -- UPDATE: цену и «не нашли» меняет только покупатель
  if (new.price is distinct from old.price or new.missing is distinct from old.missing)
     and auth.uid() <> v_owner then
    raise exception 'Цены вносит только тот, кто покупает';
  end if;
  -- название/количество/комментарий — только автор и только пока список открыт
  if new.name is distinct from old.name or new.qty is distinct from old.qty or new.note is distinct from old.note then
    if auth.uid() <> old.user_id then raise exception 'Чужую позицию менять нельзя'; end if;
    if v_status <> 'open' then raise exception 'Список закрыт'; end if;
  end if;
  return new;
end $$;

create trigger items_guard before insert or update on public.items
for each row execute function public.items_guard();

-- ── Права (RLS) ───────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.items enable row level security;
alter table public.product_prices enable row level security;

-- profiles: видны я и люди из моих походов
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_trip(id));
create policy "profiles insert own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- trips: видят участники; меняет и удаляет только владелец (создаются через create_trip)
create policy "trips read members" on public.trips for select to authenticated
  using (public.is_trip_member(id));
create policy "trips update owner" on public.trips for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "trips delete owner" on public.trips for delete to authenticated
  using (owner_id = auth.uid());

-- trip_members: видят участники; «оплачено» отмечает владелец (создаются через create_trip / join_trip)
create policy "members read" on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "members paid owner" on public.trip_members for update to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- items: читают участники; добавляют участники от своего имени; правит автор или владелец (детали — в триггере)
create policy "items read" on public.items for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "items insert own" on public.items for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));
create policy "items update" on public.items for update to authenticated
  using (user_id = auth.uid() or public.is_trip_owner(trip_id))
  with check (user_id = auth.uid() or public.is_trip_owner(trip_id));
create policy "items delete" on public.items for delete to authenticated
  using (
    public.is_trip_owner(trip_id)
    or (user_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.status = 'open'))
  );

-- product_prices: свои + цены владельца похода, в котором я участвую (подсказка «≈ цена»)
create policy "prices read" on public.product_prices for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.trips t where t.owner_id = product_prices.user_id and public.is_trip_member(t.id))
  );
create policy "prices insert own" on public.product_prices for insert to authenticated
  with check (user_id = auth.uid());
create policy "prices update own" on public.product_prices for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "prices delete own" on public.product_prices for delete to authenticated
  using (user_id = auth.uid());

-- ── Права на уровне таблиц и колонок ──────────────────────
revoke all on public.profiles, public.trips, public.trip_members, public.items, public.product_prices from anon, authenticated;

grant select, insert on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;
grant select, delete on public.trips to authenticated;
grant update (title, store, planned_for, status, receipt_path, qr_path, receipt_total) on public.trips to authenticated;
grant select on public.trip_members to authenticated;
grant update (paid) on public.trip_members to authenticated;
grant select, insert, delete on public.items to authenticated;
grant update (name, qty, note, price, missing) on public.items to authenticated;
grant select, insert, update, delete on public.product_prices to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_trip_member(uuid), public.is_trip_owner(uuid), public.shares_trip(uuid),
  public.create_trip(text, text, text), public.join_trip(text) to authenticated;
grant execute on function public.storage_trip_id(text) to authenticated;

-- ── Хранилище: закрытый бакет для чеков и QR ──────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-files', 'trip-files', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- файлы лежат в папке «<trip_id>/»; читают участники, пишет и удаляет владелец похода
create policy "trip files read" on storage.objects for select to authenticated
  using (bucket_id = 'trip-files' and public.is_trip_member(public.storage_trip_id(name)));
create policy "trip files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-files' and public.is_trip_owner(public.storage_trip_id(name)));
create policy "trip files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-files' and public.is_trip_owner(public.storage_trip_id(name)));
