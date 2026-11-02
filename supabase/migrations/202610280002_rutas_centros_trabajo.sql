-- Centros de trabajo, rutas de fabricación y registro de operaciones por orden (OEE y tiempo de ciclo).
-- Ejecutar después de 202610280001_bom_multinivel.sql. Es idempotente.
--
-- · Centro de trabajo: máquina o puesto (corte, prensa térmica, laminado...) con su capacidad.
-- · Ruta: pasos que sigue cada producto, en orden, con el centro donde se hace y su tiempo estándar por unidad.
-- · Al iniciar una orden se copia la ruta del producto como sus operaciones. Cada operación registra
--   inicio, fin, paros y piezas buenas/rechazadas: con eso se calcula el OEE y el tiempo de ciclo.
-- · Una orden cuyo producto tiene ruta solo se puede cerrar cuando todas sus operaciones están terminadas.

-- ---------- Centros de trabajo ----------

create table if not exists public.centros_trabajo (
  id bigint generated always as identity primary key,
  codigo varchar(20) not null,
  nombre varchar(120) not null,
  descripcion text,
  capacidad_hora numeric(10,2) not null default 0 check (capacidad_hora >= 0),
  horas_turno numeric(5,2) not null default 8 check (horas_turno > 0 and horas_turno <= 24),
  costo_hora numeric(12,2) not null default 0 check (costo_hora >= 0),
  -- Rango de operación para los sensores IIoT (fuera de rango = alarma)
  temperatura_min numeric(6,1),
  temperatura_max numeric(6,1),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists centros_trabajo_codigo_uidx on public.centros_trabajo (codigo);

-- ---------- Ruta de fabricación por producto ----------

create table if not exists public.ruta_operaciones (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos (id) on delete cascade,
  secuencia integer not null check (secuencia > 0),
  nombre varchar(150) not null,
  centro_trabajo_id bigint not null references public.centros_trabajo (id),
  tiempo_preparacion_min numeric(8,2) not null default 0 check (tiempo_preparacion_min >= 0),
  -- Minutos por unidad (tiempo de ciclo ideal)
  tiempo_estandar_min numeric(8,2) not null check (tiempo_estandar_min > 0),
  instrucciones text,
  unique (producto_id, secuencia)
);

create index if not exists ruta_operaciones_producto_idx on public.ruta_operaciones (producto_id);

-- ---------- Operaciones de cada orden ----------

create table if not exists public.orden_operaciones (
  id bigint generated always as identity primary key,
  orden_id bigint not null references public.ordenes_produccion (id) on delete cascade,
  secuencia integer not null,
  nombre varchar(150) not null,
  centro_trabajo_id bigint references public.centros_trabajo (id) on delete set null,
  tiempo_preparacion_min numeric(8,2) not null default 0,
  tiempo_estandar_min numeric(8,2) not null default 0,
  estado varchar(20) not null default 'pendiente' check (estado in ('pendiente', 'en_proceso', 'completada')),
  inicio timestamptz,
  fin timestamptz,
  tiempo_paro_min numeric(8,2) not null default 0 check (tiempo_paro_min >= 0),
  motivo_paro text,
  cantidad_buena integer not null default 0 check (cantidad_buena >= 0),
  cantidad_rechazada integer not null default 0 check (cantidad_rechazada >= 0),
  empleado_id bigint references public.empleados (id) on delete set null,
  observaciones text,
  unique (orden_id, secuencia)
);

create index if not exists orden_operaciones_orden_idx on public.orden_operaciones (orden_id);
create index if not exists orden_operaciones_centro_idx on public.orden_operaciones (centro_trabajo_id, estado);

-- ---------- Seguridad ----------

alter table public.centros_trabajo enable row level security;
alter table public.ruta_operaciones enable row level security;
alter table public.orden_operaciones enable row level security;

drop policy if exists "produccion centros autenticado" on public.centros_trabajo;
create policy "produccion centros autenticado" on public.centros_trabajo
  for all to authenticated using (true) with check (true);

drop policy if exists "produccion rutas autenticado" on public.ruta_operaciones;
create policy "produccion rutas autenticado" on public.ruta_operaciones
  for all to authenticated using (true) with check (true);

drop policy if exists "produccion operaciones autenticado" on public.orden_operaciones;
create policy "produccion operaciones autenticado" on public.orden_operaciones
  for all to authenticated using (true) with check (true);

-- ---------- Guardar ruta ----------
-- p_operaciones (en orden): [{ "nombre": "Corte", "centro_trabajo_id": 2, "tiempo_preparacion_min": 10,
--                             "tiempo_estandar_min": 2, "instrucciones": "..." }]
-- Las órdenes ya iniciadas conservan la ruta con que empezaron.

create or replace function public.guardar_ruta(p_producto_id bigint, p_operaciones jsonb)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_operaciones jsonb := coalesce(p_operaciones, '[]'::jsonb);
begin
  if not exists (select 1 from productos where id = p_producto_id) then
    raise exception 'El producto no existe.';
  end if;
  if jsonb_typeof(v_operaciones) <> 'array' then
    raise exception 'La ruta no es válida.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_operaciones) d where btrim(coalesce(d->>'nombre', '')) = '') then
    raise exception 'Cada operación debe tener un nombre.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_operaciones) d
    where not exists (select 1 from centros_trabajo c where c.id = (d->>'centro_trabajo_id')::bigint and c.activo)
  ) then
    raise exception 'Cada operación debe tener un centro de trabajo activo.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_operaciones) d
    where coalesce((d->>'tiempo_estandar_min')::numeric, 0) <= 0
       or coalesce((d->>'tiempo_preparacion_min')::numeric, 0) < 0
  ) then
    raise exception 'El tiempo estándar debe ser mayor que cero y la preparación no puede ser negativa.';
  end if;

  delete from ruta_operaciones where producto_id = p_producto_id;

  insert into ruta_operaciones (producto_id, secuencia, nombre, centro_trabajo_id, tiempo_preparacion_min, tiempo_estandar_min, instrucciones)
  select p_producto_id, d.ordinal::integer, btrim(d.valor->>'nombre'), (d.valor->>'centro_trabajo_id')::bigint,
         round(coalesce((d.valor->>'tiempo_preparacion_min')::numeric, 0), 2),
         round((d.valor->>'tiempo_estandar_min')::numeric, 2),
         nullif(btrim(coalesce(d.valor->>'instrucciones', '')), '')
  from jsonb_array_elements(v_operaciones) with ordinality as d (valor, ordinal);

  return jsonb_array_length(v_operaciones);
end;
$$;

-- ---------- Al iniciar la orden se copian las operaciones de la ruta ----------

create or replace function public.generar_operaciones_orden(p_orden_id bigint)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_insertadas integer;
begin
  if exists (select 1 from orden_operaciones where orden_id = p_orden_id) then
    return 0;
  end if;
  insert into orden_operaciones (orden_id, secuencia, nombre, centro_trabajo_id, tiempo_preparacion_min, tiempo_estandar_min)
  select o.id, r.secuencia, r.nombre, r.centro_trabajo_id, r.tiempo_preparacion_min, r.tiempo_estandar_min
  from ordenes_produccion o
  join ruta_operaciones r on r.producto_id = o.producto_id
  where o.id = p_orden_id
  order by r.secuencia;
  get diagnostics v_insertadas = row_count;
  return v_insertadas;
end;
$$;

create or replace function public.ordenes_produccion_generar_operaciones()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.estado = 'en_proceso' and (tg_op = 'INSERT' or old.estado is distinct from 'en_proceso') then
    perform generar_operaciones_orden(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists ordenes_produccion_generar_operaciones on public.ordenes_produccion;
create trigger ordenes_produccion_generar_operaciones
  after insert or update on public.ordenes_produccion
  for each row execute function public.ordenes_produccion_generar_operaciones();

-- Órdenes que ya estaban en proceso
select public.generar_operaciones_orden(id) from public.ordenes_produccion where estado = 'en_proceso';

-- ---------- Iniciar y terminar operaciones ----------

-- Piezas que llegan a una operación: lo planificado en la primera, lo bueno de la anterior en las demás
create or replace function public.cantidad_entrada_operacion(p_operacion_id bigint)
returns integer
language sql stable security invoker set search_path = public as $$
  select coalesce(
    (select a.cantidad_buena from orden_operaciones a
     where a.orden_id = op.orden_id and a.secuencia < op.secuencia
     order by a.secuencia desc limit 1),
    o.cantidad_planificada
  )
  from orden_operaciones op
  join ordenes_produccion o on o.id = op.orden_id
  where op.id = p_operacion_id
$$;

create or replace function public.iniciar_operacion(p_operacion_id bigint, p_inicio timestamptz default null, p_empleado_id bigint default null)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_op orden_operaciones%rowtype;
  v_estado_orden text;
begin
  select * into v_op from orden_operaciones where id = p_operacion_id for update;
  if not found then
    raise exception 'La operación no existe.';
  end if;
  select estado into v_estado_orden from ordenes_produccion where id = v_op.orden_id;
  if v_estado_orden <> 'en_proceso' then
    raise exception 'Primero inicie la orden de producción.';
  end if;
  if v_op.estado <> 'pendiente' then
    raise exception 'La operación ya fue iniciada.';
  end if;
  if exists (select 1 from orden_operaciones where orden_id = v_op.orden_id and secuencia < v_op.secuencia and estado <> 'completada') then
    raise exception 'Termine primero las operaciones anteriores de la ruta.';
  end if;

  update orden_operaciones
  set estado = 'en_proceso', inicio = coalesce(p_inicio, now()), empleado_id = coalesce(p_empleado_id, empleado_id)
  where id = p_operacion_id;
end;
$$;

create or replace function public.terminar_operacion(
  p_operacion_id bigint,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_cantidad_buena integer,
  p_cantidad_rechazada integer,
  p_tiempo_paro_min numeric,
  p_motivo_paro text,
  p_empleado_id bigint,
  p_observaciones text
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_op orden_operaciones%rowtype;
  v_inicio timestamptz;
  v_fin timestamptz := coalesce(p_fin, now());
  v_entrada integer;
  v_paro numeric := round(coalesce(p_tiempo_paro_min, 0), 2);
begin
  select * into v_op from orden_operaciones where id = p_operacion_id for update;
  if not found then
    raise exception 'La operación no existe.';
  end if;
  if v_op.estado <> 'en_proceso' then
    raise exception 'Solo se pueden terminar operaciones en proceso.';
  end if;
  v_inicio := coalesce(p_inicio, v_op.inicio);
  if v_fin <= v_inicio then
    raise exception 'La hora de fin debe ser posterior a la de inicio.';
  end if;
  if v_fin > now() + interval '5 minutes' then
    raise exception 'La hora de fin no puede estar en el futuro.';
  end if;
  if v_paro < 0 or v_paro >= extract(epoch from (v_fin - v_inicio)) / 60 then
    raise exception 'El tiempo de paro debe ser menor que la duración de la operación.';
  end if;
  if coalesce(p_cantidad_buena, -1) < 0 or coalesce(p_cantidad_rechazada, -1) < 0 then
    raise exception 'Las cantidades no pueden ser negativas.';
  end if;
  if p_cantidad_buena + p_cantidad_rechazada = 0 then
    raise exception 'Registre las piezas procesadas.';
  end if;
  v_entrada := cantidad_entrada_operacion(p_operacion_id);
  if p_cantidad_buena + p_cantidad_rechazada > v_entrada then
    raise exception 'A esta operación solo llegaron % pieza(s); buenas + rechazadas no puede superarlo.', v_entrada;
  end if;

  update orden_operaciones
  set estado = 'completada',
      inicio = v_inicio,
      fin = v_fin,
      cantidad_buena = p_cantidad_buena,
      cantidad_rechazada = p_cantidad_rechazada,
      tiempo_paro_min = v_paro,
      motivo_paro = nullif(btrim(coalesce(p_motivo_paro, '')), ''),
      empleado_id = coalesce(p_empleado_id, empleado_id),
      observaciones = nullif(btrim(coalesce(p_observaciones, '')), '')
  where id = p_operacion_id;
end;
$$;

-- ---------- Cierre de la orden: la ruta debe estar terminada ----------

create or replace function public.validar_operaciones_cierre_orden()
returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  v_ultima orden_operaciones%rowtype;
begin
  if new.estado <> 'completada' or old.estado = 'completada' then
    return new;
  end if;

  if not exists (select 1 from orden_operaciones where orden_id = new.id) then
    if exists (select 1 from ruta_operaciones where producto_id = new.producto_id) then
      raise exception 'El producto tiene ruta de fabricación: inicie la orden y registre sus operaciones antes de cerrarla.';
    end if;
    return new;
  end if;

  if exists (select 1 from orden_operaciones where orden_id = new.id and estado <> 'completada') then
    raise exception 'Faltan operaciones de la ruta por terminar. Regístrelas antes de cerrar la orden.';
  end if;

  select * into v_ultima from orden_operaciones where orden_id = new.id order by secuencia desc limit 1;
  if new.cantidad_producida > v_ultima.cantidad_buena then
    raise exception 'La última operación (%) solo dejó % pieza(s) buenas; no se pueden reportar % producidas.',
      v_ultima.nombre, v_ultima.cantidad_buena, new.cantidad_producida;
  end if;

  -- El inicio real de la orden es el de su primera operación
  new.fecha_inicio := coalesce(
    (select (min(inicio) at time zone 'America/Managua')::date from orden_operaciones where orden_id = new.id),
    new.fecha_inicio
  );
  return new;
end;
$$;

drop trigger if exists ordenes_produccion_validar_operaciones on public.ordenes_produccion;
create trigger ordenes_produccion_validar_operaciones
  before update on public.ordenes_produccion
  for each row execute function public.validar_operaciones_cierre_orden();

revoke all on function public.guardar_ruta(bigint, jsonb) from public, anon;
revoke all on function public.generar_operaciones_orden(bigint) from public, anon;
revoke all on function public.cantidad_entrada_operacion(bigint) from public, anon;
revoke all on function public.iniciar_operacion(bigint, timestamptz, bigint) from public, anon;
revoke all on function public.terminar_operacion(bigint, timestamptz, timestamptz, integer, integer, numeric, text, bigint, text) from public, anon;
grant execute on function public.guardar_ruta(bigint, jsonb) to authenticated;
grant execute on function public.generar_operaciones_orden(bigint) to authenticated;
grant execute on function public.cantidad_entrada_operacion(bigint) to authenticated;
grant execute on function public.iniciar_operacion(bigint, timestamptz, bigint) to authenticated;
grant execute on function public.terminar_operacion(bigint, timestamptz, timestamptz, integer, integer, numeric, text, bigint, text) to authenticated;
