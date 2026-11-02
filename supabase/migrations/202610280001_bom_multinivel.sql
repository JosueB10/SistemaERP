-- BOM multinivel: subensambles intermedios. Ejecutar después de 202610250003_ventas_pendientes_fecha.sql.
-- Es idempotente.
--
-- Estructura de producto (BOM) en dos niveles:
--   Nivel 0: producto terminado (receta activa)
--   Nivel 1: componentes de la receta → materia prima directa o subensamble
--   Nivel 2: materia prima de cada subensamble
-- Los subensambles se fabrican dentro de la misma orden (no se guardan en inventario): al cerrar la
-- orden la BOM se "explota" nivel por nivel hasta la materia prima, que es lo que se descuenta.

-- ---------- Subensambles ----------

create table if not exists public.subensambles (
  id bigint generated always as identity primary key,
  codigo varchar(20) not null,
  nombre varchar(150) not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subensambles_codigo_uidx on public.subensambles (codigo);

-- Materia prima que lleva UNA unidad del subensamble
create table if not exists public.subensamble_detalle (
  id bigint generated always as identity primary key,
  subensamble_id bigint not null references public.subensambles (id) on delete cascade,
  materia_prima_id bigint not null references public.materias_primas (id),
  cantidad numeric(12,3) not null check (cantidad > 0),
  unique (subensamble_id, materia_prima_id)
);

create index if not exists subensamble_detalle_subensamble_idx on public.subensamble_detalle (subensamble_id);

-- ---------- Receta: cada línea es materia prima O subensamble ----------

-- Si la llave primaria del esquema original incluía materia_prima_id, se reemplaza por un id propio
do $$
declare
  v_pk text;
begin
  select c.conname into v_pk
  from pg_constraint c
  where c.conrelid = 'public.receta_detalle'::regclass and c.contype = 'p'
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.conrelid and a.attnum = any (c.conkey) and a.attname = 'materia_prima_id'
    );
  if v_pk is not null then
    execute format('alter table public.receta_detalle drop constraint %I', v_pk);
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'receta_detalle' and column_name = 'id'
    ) then
      alter table public.receta_detalle add column id bigint generated always as identity primary key;
    end if;
  end if;
end;
$$;

alter table public.receta_detalle
  add column if not exists subensamble_id bigint references public.subensambles (id);

alter table public.receta_detalle alter column materia_prima_id drop not null;

alter table public.receta_detalle drop constraint if exists receta_detalle_componente_chk;
alter table public.receta_detalle add constraint receta_detalle_componente_chk
  check (num_nonnulls(materia_prima_id, subensamble_id) = 1);

create unique index if not exists receta_detalle_subensamble_uidx
  on public.receta_detalle (receta_id, subensamble_id) where subensamble_id is not null;

alter table public.subensambles enable row level security;
alter table public.subensamble_detalle enable row level security;

drop policy if exists "produccion subensambles autenticado" on public.subensambles;
create policy "produccion subensambles autenticado" on public.subensambles
  for all to authenticated using (true) with check (true);

drop policy if exists "produccion subensamble detalle autenticado" on public.subensamble_detalle;
create policy "produccion subensamble detalle autenticado" on public.subensamble_detalle
  for all to authenticated using (true) with check (true);

-- ---------- Explosión de la BOM ----------
-- Materia prima total que lleva UNA unidad del producto: la directa más la de sus subensambles.

create or replace function public.explosion_bom(p_producto_id bigint)
returns table (materia_prima_id bigint, cantidad numeric)
language sql stable security invoker set search_path = public as $$
  select x.materia_prima_id, round(sum(x.cantidad), 3)
  from (
    select rd.materia_prima_id, rd.cantidad
    from recetas r
    join receta_detalle rd on rd.receta_id = r.id
    where r.producto_id = p_producto_id and r.activo and rd.materia_prima_id is not null
    union all
    select sd.materia_prima_id, rd.cantidad * sd.cantidad
    from recetas r
    join receta_detalle rd on rd.receta_id = r.id
    join subensamble_detalle sd on sd.subensamble_id = rd.subensamble_id
    where r.producto_id = p_producto_id and r.activo
  ) x
  group by x.materia_prima_id
$$;

-- ---------- Guardar subensamble ----------
-- p_detalles: [{ "materia_prima_id": 1, "cantidad": 0.25 }]

create or replace function public.guardar_subensamble(
  p_id bigint,
  p_codigo text,
  p_nombre text,
  p_descripcion text,
  p_detalles jsonb
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_id bigint := p_id;
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
begin
  if v_codigo = '' or btrim(coalesce(p_nombre, '')) = '' then
    raise exception 'El código y el nombre del subensamble son obligatorios.';
  end if;
  if jsonb_typeof(coalesce(p_detalles, 'null'::jsonb)) is distinct from 'array' or p_detalles = '[]'::jsonb then
    raise exception 'El subensamble debe llevar al menos una materia prima.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_detalles) d where coalesce((d->>'cantidad')::numeric, 0) <= 0) then
    raise exception 'Cada materia prima debe tener una cantidad mayor que cero.';
  end if;
  if (select count(*) from jsonb_array_elements(p_detalles))
     <> (select count(distinct d->>'materia_prima_id') from jsonb_array_elements(p_detalles) d) then
    raise exception 'Una materia prima aparece más de una vez en el subensamble.';
  end if;
  if exists (select 1 from subensambles where upper(codigo) = v_codigo and id is distinct from v_id) then
    raise exception 'Ya existe un subensamble con el código %.', v_codigo;
  end if;

  if v_id is null then
    insert into subensambles (codigo, nombre, descripcion)
    values (v_codigo, btrim(p_nombre), nullif(btrim(coalesce(p_descripcion, '')), ''))
    returning id into v_id;
  else
    update subensambles
    set codigo = v_codigo, nombre = btrim(p_nombre), descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''), updated_at = now()
    where id = v_id;
    if not found then
      raise exception 'El subensamble no existe.';
    end if;
    delete from subensamble_detalle where subensamble_id = v_id;
  end if;

  insert into subensamble_detalle (subensamble_id, materia_prima_id, cantidad)
  select v_id, (d->>'materia_prima_id')::bigint, round((d->>'cantidad')::numeric, 3)
  from jsonb_array_elements(p_detalles) d;

  return v_id;
end;
$$;

-- ---------- Guardar receta (materia prima y subensambles) ----------
-- p_detalles: [{ "materia_prima_id": 1, "cantidad": 0.3 }, { "subensamble_id": 2, "cantidad": 1 }]

create or replace function public.guardar_receta(
  p_producto_id bigint,
  p_nombre text,
  p_notas text,
  p_detalles jsonb
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_receta_id bigint;
  v_detalles jsonb := coalesce(p_detalles, '[]'::jsonb);
begin
  if not exists (select 1 from productos where id = p_producto_id) then
    raise exception 'El producto no existe.';
  end if;
  if jsonb_typeof(v_detalles) <> 'array' then
    raise exception 'El detalle de la receta no es válido.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_detalles) d
    where (d->>'materia_prima_id' is null) = (d->>'subensamble_id' is null)
  ) then
    raise exception 'Cada línea de la receta debe ser una materia prima o un subensamble.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_detalles) d where coalesce((d->>'cantidad')::numeric, 0) <= 0) then
    raise exception 'Cada componente debe tener una cantidad mayor que cero.';
  end if;
  if (select count(*) from jsonb_array_elements(v_detalles))
     <> (select count(distinct coalesce('m' || (d->>'materia_prima_id'), 's' || (d->>'subensamble_id'))) from jsonb_array_elements(v_detalles) d) then
    raise exception 'Un componente aparece más de una vez en la receta.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_detalles) d
    where d->>'subensamble_id' is not null
      and not exists (
        select 1 from subensambles s
        join subensamble_detalle sd on sd.subensamble_id = s.id
        where s.id = (d->>'subensamble_id')::bigint and s.activo
      )
  ) then
    raise exception 'Uno de los subensambles no existe, está inactivo o no tiene materia prima definida.';
  end if;

  select id into v_receta_id from recetas where producto_id = p_producto_id and activo for update;

  if v_receta_id is null then
    insert into recetas (producto_id, nombre, notas)
    values (p_producto_id, btrim(p_nombre), nullif(btrim(coalesce(p_notas, '')), ''))
    returning id into v_receta_id;
  else
    update recetas
    set nombre = btrim(p_nombre), notas = nullif(btrim(coalesce(p_notas, '')), ''),
        version = version + 1, updated_at = now()
    where id = v_receta_id;
    delete from receta_detalle where receta_id = v_receta_id;
  end if;

  insert into receta_detalle (receta_id, materia_prima_id, subensamble_id, cantidad)
  select v_receta_id, (d->>'materia_prima_id')::bigint, (d->>'subensamble_id')::bigint, round((d->>'cantidad')::numeric, 3)
  from jsonb_array_elements(v_detalles) d;

  return v_receta_id;
end;
$$;

-- ---------- Órdenes: la validación de materia prima usa la BOM explotada ----------

create or replace function public.validar_materia_orden_produccion()
returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  v_linea record;
  v_comprometido numeric;
  v_disponible numeric;
  v_requerido numeric;
begin
  if new.estado not in ('pendiente', 'en_proceso') then
    return new;
  end if;
  -- Solo se valida al crear, al cambiar producto o cantidad, o al pasar a "en proceso"
  if tg_op = 'UPDATE'
     and new.producto_id is not distinct from old.producto_id
     and new.cantidad_planificada is not distinct from old.cantidad_planificada
     and not (old.estado = 'pendiente' and new.estado = 'en_proceso') then
    return new;
  end if;

  for v_linea in
    select e.materia_prima_id, e.cantidad, mp.nombre, mp.stock_actual
    from explosion_bom(new.producto_id) e
    join materias_primas mp on mp.id = e.materia_prima_id
    for update of mp
  loop
    select coalesce(sum(round(x.cantidad * o.cantidad_planificada, 3)), 0) into v_comprometido
    from ordenes_produccion o
    cross join lateral explosion_bom(o.producto_id) x
    where o.estado in ('pendiente', 'en_proceso')
      and o.id is distinct from new.id
      and x.materia_prima_id = v_linea.materia_prima_id;

    v_requerido := round(v_linea.cantidad * new.cantidad_planificada, 3);
    v_disponible := greatest(v_linea.stock_actual - v_comprometido, 0);
    if v_requerido > v_disponible then
      if v_disponible <= 0 then
        raise exception 'No hay materia prima disponible: se acabó % (reservado por otras órdenes: %). Registre una compra antes de crear la orden.',
          v_linea.nombre, v_comprometido;
      end if;
      raise exception 'Materia prima insuficiente de %: disponible %, requerido %. Reduzca la cantidad o registre una compra.',
        v_linea.nombre, v_disponible, v_requerido;
    end if;
  end loop;

  return new;
end;
$$;

-- ---------- Salida por venta (inventario): también explota la BOM ----------

create or replace function public.vender_producto(
  p_producto_id bigint,
  p_cantidad integer,
  p_fecha date default current_date,
  p_motivo text default 'Venta',
  p_observaciones text default null,
  p_referencia_tipo text default 'venta',
  p_referencia_id bigint default null
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_producto productos%rowtype;
  v_mp materias_primas%rowtype;
  v_linea record;
  v_desde_stock integer;
  v_fabricadas integer;
  v_requerido numeric;
  v_costo numeric := 0;
  v_motivo text := coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Venta');
  v_obs text := nullif(btrim(coalesce(p_observaciones, '')), '');
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;

  select * into v_producto from productos where id = p_producto_id for update;
  if not found then
    raise exception 'El producto no existe.';
  end if;

  v_desde_stock := least(greatest(v_producto.stock_actual, 0), p_cantidad);
  v_fabricadas := p_cantidad - v_desde_stock;

  if v_fabricadas > 0 then
    if not exists (select 1 from explosion_bom(p_producto_id)) then
      raise exception 'Solo hay % unidad(es) de % y el producto no tiene materia prima definida en su receta.', v_producto.stock_actual, v_producto.nombre;
    end if;

    for v_linea in select materia_prima_id, cantidad from explosion_bom(p_producto_id) loop
      v_requerido := round(v_linea.cantidad * v_fabricadas, 3);
      select * into v_mp from materias_primas where id = v_linea.materia_prima_id for update;
      if v_mp.stock_actual < v_requerido then
        raise exception 'Stock insuficiente de %: disponible %, requerido %.', v_mp.nombre, v_mp.stock_actual, v_requerido;
      end if;
      update materias_primas set stock_actual = stock_actual - v_requerido where id = v_mp.id;
      insert into movimientos_inventario
        (tipo, materia_prima_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
      values
        ('salida', v_mp.id, v_requerido, p_referencia_tipo, p_referencia_id, p_fecha, 'Consumo por venta',
         v_mp.stock_actual, v_mp.stock_actual - v_requerido,
         v_fabricadas || ' und de ' || v_producto.nombre || ' fabricadas al vender');
      v_costo := v_costo + round(v_requerido * v_mp.costo_unitario, 2);
    end loop;

    insert into movimientos_inventario
      (tipo, producto_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
    values
      ('entrada', p_producto_id, v_fabricadas, p_referencia_tipo, p_referencia_id, p_fecha, 'Fabricado al vender',
       v_producto.stock_actual, v_producto.stock_actual + v_fabricadas, v_obs);
  end if;

  update productos set stock_actual = stock_actual - v_desde_stock where id = p_producto_id;
  insert into movimientos_inventario
    (tipo, producto_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
  values
    ('salida', p_producto_id, p_cantidad, p_referencia_tipo, p_referencia_id, p_fecha, v_motivo,
     v_producto.stock_actual + v_fabricadas, v_producto.stock_actual - v_desde_stock, v_obs);

  return jsonb_build_object('desde_stock', v_desde_stock, 'fabricadas', v_fabricadas, 'costo_materiales', v_costo);
end;
$$;

revoke all on function public.explosion_bom(bigint) from public, anon;
revoke all on function public.guardar_subensamble(bigint, text, text, text, jsonb) from public, anon;
revoke all on function public.guardar_receta(bigint, text, text, jsonb) from public, anon;
grant execute on function public.explosion_bom(bigint) to authenticated;
grant execute on function public.guardar_subensamble(bigint, text, text, text, jsonb) to authenticated;
grant execute on function public.guardar_receta(bigint, text, text, jsonb) to authenticated;
