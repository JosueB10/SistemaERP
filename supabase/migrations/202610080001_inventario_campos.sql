-- Campos que requiere el módulo Inventario de Neumopad ERP.
-- Ejecutar una sola vez en Supabase SQL Editor sobre la base creada con Texto pegado.txt.

alter table public.materias_primas
  add column if not exists codigo varchar(50),
  add column if not exists categoria varchar(100);

update public.materias_primas
set codigo = 'MP-' || id::text
where codigo is null or btrim(codigo) = '';

alter table public.materias_primas
  alter column codigo set not null;

create unique index if not exists materias_primas_codigo_uidx
  on public.materias_primas (codigo);

alter table public.movimientos_inventario
  add column if not exists fecha date not null default current_date,
  add column if not exists motivo varchar(200),
  add column if not exists sentido varchar(20),
  add column if not exists stock_anterior numeric(12,3),
  add column if not exists stock_resultante numeric(12,3);

update public.movimientos_inventario
set motivo = coalesce(motivo, referencia_tipo, tipo)
where motivo is null;

alter table public.movimientos_inventario
  alter column motivo set not null;

create index if not exists movimientos_inventario_fecha_idx
  on public.movimientos_inventario (fecha desc, created_at desc);
