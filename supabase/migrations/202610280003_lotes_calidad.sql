-- Lotes de producción, inspección de calidad y no conformidades.
-- Ejecutar después de 202610280002_rutas_centros_trabajo.sql. Es idempotente.
--
-- · Cada orden completada genera un lote (L-AAMMDD-OPxxxxx) para rastrear qué se fabricó, cuándo y con qué orden.
-- · El lote queda "en inspección" hasta que Calidad lo revisa: las unidades rechazadas salen del stock
--   terminado y generan una no conformidad (NC).
-- · Las piezas rechazadas en una operación de la ruta también generan una NC abierta.
-- · Las NC se analizan (causa raíz, acción correctiva) y se cierran.

-- ---------- Lotes ----------

create table if not exists public.lotes (
  id bigint generated always as identity primary key,
  codigo varchar(30) not null,
  orden_id bigint not null references public.ordenes_produccion (id) on delete cascade,
  producto_id bigint not null references public.productos (id),
  fecha_produccion date not null,
  cantidad integer not null check (cantidad >= 0),
  cantidad_aprobada integer not null default 0 check (cantidad_aprobada >= 0),
  cantidad_rechazada integer not null default 0 check (cantidad_rechazada >= 0),
  estado varchar(20) not null default 'en_inspeccion'
    check (estado in ('en_inspeccion', 'aprobado', 'aprobado_parcial', 'rechazado')),
  -- Lista de verificación: { "medidas": true, "adhesion": true, "bordes": false, ... }
  criterios jsonb not null default '{}'::jsonb,
  inspector_id bigint references public.empleados (id) on delete set null,
  fecha_inspeccion date,
  observaciones text,
  created_at timestamptz not null default now()
);

create unique index if not exists lotes_codigo_uidx on public.lotes (codigo);
create unique index if not exists lotes_orden_uidx on public.lotes (orden_id);
create index if not exists lotes_producto_idx on public.lotes (producto_id, fecha_produccion desc);

-- ---------- No conformidades ----------

create table if not exists public.no_conformidades (
  id bigint generated always as identity primary key,
  origen varchar(20) not null default 'produccion' check (origen in ('produccion', 'proceso', 'materia_prima', 'cliente')),
  lote_id bigint references public.lotes (id) on delete set null,
  orden_id bigint references public.ordenes_produccion (id) on delete set null,
  operacion_id bigint references public.orden_operaciones (id) on delete set null,
  producto_id bigint references public.productos (id),
  materia_prima_id bigint references public.materias_primas (id),
  fecha date not null,
  tipo_defecto varchar(120) not null,
  descripcion text,
  cantidad_afectada numeric(12,3) not null default 0 check (cantidad_afectada >= 0),
  severidad varchar(10) not null default 'menor' check (severidad in ('menor', 'mayor', 'critica')),
  disposicion varchar(20) not null default 'desecho' check (disposicion in ('reproceso', 'desecho', 'concesion', 'devolucion')),
  causa_raiz text,
  accion_correctiva text,
  responsable_id bigint references public.empleados (id) on delete set null,
  estado varchar(20) not null default 'abierta' check (estado in ('abierta', 'en_analisis', 'cerrada')),
  fecha_cierre date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists no_conformidades_estado_idx on public.no_conformidades (estado, fecha desc);
create index if not exists no_conformidades_lote_idx on public.no_conformidades (lote_id);

-- ---------- Seguridad ----------

alter table public.lotes enable row level security;
alter table public.no_conformidades enable row level security;

drop policy if exists "calidad lotes autenticado" on public.lotes;
create policy "calidad lotes autenticado" on public.lotes
  for all to authenticated using (true) with check (true);

drop policy if exists "calidad no conformidades autenticado" on public.no_conformidades;
create policy "calidad no conformidades autenticado" on public.no_conformidades
  for all to authenticated using (true) with check (true);

-- ---------- Lote al completar la orden ----------

create or replace function public.codigo_lote(p_orden_id bigint, p_fecha date)
returns text
language sql immutable as $$
  select 'L-' || to_char(p_fecha, 'YYMMDD') || '-' || lpad(p_orden_id::text, 5, '0')
$$;

create or replace function public.ordenes_produccion_crear_lote()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.estado = 'completada' and old.estado is distinct from 'completada' then
    insert into lotes (codigo, orden_id, producto_id, fecha_produccion, cantidad)
    values (codigo_lote(new.id, coalesce(new.fecha_fin, fecha_hoy_nicaragua())), new.id, new.producto_id,
            coalesce(new.fecha_fin, fecha_hoy_nicaragua()), new.cantidad_producida)
    on conflict (orden_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ordenes_produccion_crear_lote on public.ordenes_produccion;
create trigger ordenes_produccion_crear_lote
  after update on public.ordenes_produccion
  for each row execute function public.ordenes_produccion_crear_lote();

-- Órdenes completadas antes de esta migración: su lote queda pendiente de inspección
insert into public.lotes (codigo, orden_id, producto_id, fecha_produccion, cantidad)
select public.codigo_lote(o.id, coalesce(o.fecha_fin, o.created_at::date)), o.id, o.producto_id,
       coalesce(o.fecha_fin, o.created_at::date), o.cantidad_producida
from public.ordenes_produccion o
where o.estado = 'completada'
on conflict (orden_id) do nothing;

-- ---------- Piezas rechazadas en una operación → NC ----------

create or replace function public.orden_operaciones_nc_rechazo()
returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  v_producto_id bigint;
begin
  if new.estado = 'completada' and old.estado is distinct from 'completada' and new.cantidad_rechazada > 0 then
    select producto_id into v_producto_id from ordenes_produccion where id = new.orden_id;
    insert into no_conformidades
      (origen, orden_id, operacion_id, producto_id, fecha, tipo_defecto, descripcion, cantidad_afectada, severidad, disposicion)
    values
      ('proceso', new.orden_id, new.id, v_producto_id, (coalesce(new.fin, now()) at time zone 'America/Managua')::date,
       'Rechazo en ' || new.nombre,
       coalesce(new.observaciones, 'Piezas rechazadas al registrar la operación ' || new.secuencia || ' de la orden OP-' || lpad(new.orden_id::text, 5, '0') || '.'),
       new.cantidad_rechazada, 'menor', 'desecho');
  end if;
  return new;
end;
$$;

drop trigger if exists orden_operaciones_nc_rechazo on public.orden_operaciones;
create trigger orden_operaciones_nc_rechazo
  after update on public.orden_operaciones
  for each row execute function public.orden_operaciones_nc_rechazo();

-- ---------- Inspeccionar lote ----------
-- Las unidades rechazadas salen del stock terminado ("Rechazo de calidad") y se registra una NC.
-- Devuelve el id de la NC creada (o null si todo se aprobó).

create or replace function public.inspeccionar_lote(
  p_lote_id bigint,
  p_aprobadas integer,
  p_rechazadas integer,
  p_fecha date,
  p_inspector_id bigint,
  p_criterios jsonb,
  p_observaciones text,
  p_tipo_defecto text,
  p_descripcion text,
  p_severidad text,
  p_disposicion text
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_lote lotes%rowtype;
  v_producto productos%rowtype;
  v_nc_id bigint;
  v_fecha date := coalesce(p_fecha, fecha_hoy_nicaragua());
begin
  select * into v_lote from lotes where id = p_lote_id for update;
  if not found then
    raise exception 'El lote no existe.';
  end if;
  if v_lote.estado <> 'en_inspeccion' then
    raise exception 'El lote % ya fue inspeccionado.', v_lote.codigo;
  end if;
  if coalesce(p_aprobadas, -1) < 0 or coalesce(p_rechazadas, -1) < 0 then
    raise exception 'Las cantidades no pueden ser negativas.';
  end if;
  if p_aprobadas + p_rechazadas <> v_lote.cantidad then
    raise exception 'Aprobadas + rechazadas debe ser igual a las % unidades del lote.', v_lote.cantidad;
  end if;

  if p_rechazadas > 0 then
    if btrim(coalesce(p_tipo_defecto, '')) = '' then
      raise exception 'Indique el tipo de defecto de las unidades rechazadas.';
    end if;

    select * into v_producto from productos where id = v_lote.producto_id for update;
    if v_producto.stock_actual < p_rechazadas then
      raise exception 'Solo quedan % und de % en stock; las rechazadas ya salieron (venta). Registre la NC manualmente con origen cliente.',
        v_producto.stock_actual, v_producto.nombre;
    end if;
    update productos set stock_actual = stock_actual - p_rechazadas where id = v_producto.id;
    insert into movimientos_inventario
      (tipo, producto_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
    values
      ('salida', v_producto.id, p_rechazadas, 'lote', v_lote.id, v_fecha, 'Rechazo de calidad',
       v_producto.stock_actual, v_producto.stock_actual - p_rechazadas, 'Lote ' || v_lote.codigo || ': ' || btrim(p_tipo_defecto));

    insert into no_conformidades
      (origen, lote_id, orden_id, producto_id, fecha, tipo_defecto, descripcion, cantidad_afectada, severidad, disposicion, responsable_id)
    values
      ('produccion', v_lote.id, v_lote.orden_id, v_lote.producto_id, v_fecha, btrim(p_tipo_defecto),
       nullif(btrim(coalesce(p_descripcion, '')), ''), p_rechazadas,
       coalesce(nullif(p_severidad, ''), 'menor'), coalesce(nullif(p_disposicion, ''), 'desecho'), p_inspector_id)
    returning id into v_nc_id;
  end if;

  update lotes
  set cantidad_aprobada = p_aprobadas,
      cantidad_rechazada = p_rechazadas,
      estado = case when p_rechazadas = 0 then 'aprobado' when p_aprobadas = 0 then 'rechazado' else 'aprobado_parcial' end,
      criterios = coalesce(p_criterios, '{}'::jsonb),
      inspector_id = p_inspector_id,
      fecha_inspeccion = v_fecha,
      observaciones = nullif(btrim(coalesce(p_observaciones, '')), '')
  where id = p_lote_id;

  return v_nc_id;
end;
$$;

revoke all on function public.codigo_lote(bigint, date) from public, anon;
revoke all on function public.inspeccionar_lote(bigint, integer, integer, date, bigint, jsonb, text, text, text, text, text) from public, anon;
grant execute on function public.codigo_lote(bigint, date) to authenticated;
grant execute on function public.inspeccionar_lote(bigint, integer, integer, date, bigint, jsonb, text, text, text, text, text) to authenticated;
