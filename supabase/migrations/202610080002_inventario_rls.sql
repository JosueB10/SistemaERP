-- Acceso al inventario solo para sesiones autenticadas de Supabase Auth.
-- Crear primero al menos un usuario en Supabase Dashboard > Authentication > Users.

alter table public.categorias enable row level security;
alter table public.unidades_medida enable row level security;
alter table public.productos enable row level security;
alter table public.materias_primas enable row level security;
alter table public.movimientos_inventario enable row level security;

drop policy if exists "inventario categorias autenticado leer" on public.categorias;
create policy "inventario categorias autenticado leer" on public.categorias
  for select to authenticated using (true);
drop policy if exists "inventario categorias autenticado crear" on public.categorias;
create policy "inventario categorias autenticado crear" on public.categorias
  for insert to authenticated with check (true);
drop policy if exists "inventario categorias autenticado actualizar" on public.categorias;
create policy "inventario categorias autenticado actualizar" on public.categorias
  for update to authenticated using (true) with check (true);
drop policy if exists "inventario categorias bloquear anon" on public.categorias;
create policy "inventario categorias bloquear anon" on public.categorias
  as restrictive for all to public using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "inventario unidades autenticado leer" on public.unidades_medida;
create policy "inventario unidades autenticado leer" on public.unidades_medida
  for select to authenticated using (true);
drop policy if exists "inventario unidades autenticado crear" on public.unidades_medida;
create policy "inventario unidades autenticado crear" on public.unidades_medida
  for insert to authenticated with check (true);
drop policy if exists "inventario unidades autenticado actualizar" on public.unidades_medida;
create policy "inventario unidades autenticado actualizar" on public.unidades_medida
  for update to authenticated using (true) with check (true);
drop policy if exists "inventario unidades bloquear anon" on public.unidades_medida;
create policy "inventario unidades bloquear anon" on public.unidades_medida
  as restrictive for all to public using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "inventario productos autenticado leer" on public.productos;
create policy "inventario productos autenticado leer" on public.productos
  for select to authenticated using (true);
drop policy if exists "inventario productos autenticado crear" on public.productos;
create policy "inventario productos autenticado crear" on public.productos
  for insert to authenticated with check (true);
drop policy if exists "inventario productos autenticado actualizar" on public.productos;
create policy "inventario productos autenticado actualizar" on public.productos
  for update to authenticated using (true) with check (true);
drop policy if exists "inventario productos bloquear anon" on public.productos;
create policy "inventario productos bloquear anon" on public.productos
  as restrictive for all to public using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "inventario materias autenticado leer" on public.materias_primas;
create policy "inventario materias autenticado leer" on public.materias_primas
  for select to authenticated using (true);
drop policy if exists "inventario materias autenticado crear" on public.materias_primas;
create policy "inventario materias autenticado crear" on public.materias_primas
  for insert to authenticated with check (true);
drop policy if exists "inventario materias autenticado actualizar" on public.materias_primas;
create policy "inventario materias autenticado actualizar" on public.materias_primas
  for update to authenticated using (true) with check (true);
drop policy if exists "inventario materias bloquear anon" on public.materias_primas;
create policy "inventario materias bloquear anon" on public.materias_primas
  as restrictive for all to public using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "inventario movimientos autenticado leer" on public.movimientos_inventario;
create policy "inventario movimientos autenticado leer" on public.movimientos_inventario
  for select to authenticated using (true);
drop policy if exists "inventario movimientos autenticado crear" on public.movimientos_inventario;
create policy "inventario movimientos autenticado crear" on public.movimientos_inventario
  for insert to authenticated with check (true);
drop policy if exists "inventario movimientos bloquear anon" on public.movimientos_inventario;
create policy "inventario movimientos bloquear anon" on public.movimientos_inventario
  as restrictive for all to public using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
