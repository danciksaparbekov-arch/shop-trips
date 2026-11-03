-- Миграция: QR для оплаты, сохранённый в профиле. Выполнить в Supabase → SQL Editor. Безопасно запускать повторно.
-- Файл лежит в закрытом бакете в личной папке «<user_id>/»; видит и меняет только сам человек.
-- При создании похода файл копируется в папку похода — дальше работают обычные права участников.

alter table public.profiles add column if not exists qr_path text;
grant update (name, qr_path) on public.profiles to authenticated;

drop policy if exists "own files read" on storage.objects;
drop policy if exists "own files insert" on storage.objects;
drop policy if exists "own files delete" on storage.objects;
create policy "own files read" on storage.objects for select to authenticated
  using (bucket_id = 'trip-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-files' and (storage.foldername(name))[1] = auth.uid()::text);
