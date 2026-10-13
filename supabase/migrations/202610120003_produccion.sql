
alter table public.recetas
  add column if not exists notas text,
  add column if not exists updated_at timestamptz not null default now();

-
update public.recetas r set activo = false
where r.activo and exists (
  select 1 from public.recetas o where o.producto_id = r.producto_id and o.activo and o.id > r.id
);

create unique index if not exists recetas_producto_activa_uidx
  on public.recetas (producto_id) where activo;
create index if not exists receta_detalle_receta_idx on public.receta_detalle (receta_id);

-- ---------- Órdenes de producción ----------

alter table public.ordenes_produccion
  add column if not exists fecha_programada date,
  add column if not exists costo_materiales numeric(14,2) not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ordenes_produccion drop constraint if exists ordenes_produccion_estado_chk;
alter table public.ordenes_produccion add constraint ordenes_produccion_estado_chk
  check (estado in ('pendiente', 'en_proceso', 'completada', 'cancelada')) not valid;
alter table public.ordenes_produccion drop constraint if exists ordenes_produccion_cantidad_chk;
alter table public.ordenes_produccion add constraint ordenes_produccion_cantidad_chk
  check (cantidad_planificada > 0 and cantidad_producida >= 0) not valid;

create index if not exists ordenes_produccion_estado_idx on public.ordenes_produccion (estado, created_at desc);

-- Materia prima realmente consumida por cada orden completada
create table if not exists public.orden_produccion_consumos (
  id bigint generated always as identity primary key,
  orden_id bigint not null references public.ordenes_produccion (id) on delete cascade,
  materia_prima_id bigint not null references public.materias_primas (id),
  cantidad_teorica numeric(12,3) not null default 0,
  cantidad_real numeric(12,3) not null default 0,
  costo_unitario numeric(12,2) not null default 0,
  subtotal numeric(14,2) not null default 0
);

create index if not exists orden_produccion_consumos_orden_idx on public.orden_produccion_consumos (orden_id);

-- ---------- Seguridad: solo usuarios autenticados ----------

alter table public.recetas enable row level security;
alter table public.receta_detalle enable row level security;
alter table public.ordenes_produccion enable row level security;
alter table public.orden_produccion_consumos enable row level security;

drop policy if exists "produccion recetas autenticado" on public.recetas;
create policy "produccion recetas autenticado" on public.recetas
  for all to authenticated using (true) with check (true);

drop policy if exists "produccion receta detalle autenticado" on public.receta_detalle;
create policy "produccion receta detalle autenticado" on public.receta_detalle
  for all to authenticated using (true) with check (true);

drop policy if exists "produccion ordenes autenticado" on public.ordenes_produccion;
create policy "produccion ordenes autenticado" on public.ordenes_produccion
  for all to authenticated using (true) with check (true);

drop policy if exists "produccion consumos autenticado" on public.orden_produccion_consumos;
create policy "produccion consumos autenticado" on public.orden_produccion_consumos
  for all to authenticated using (true) with check (true);


create or replace function public.guardar_receta(
  p_producto_id bigint,
  p_nombre text,
  p_notas text,
  p_detalles jsonb
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_receta_id bigint;
begin
  if not exists (select 1 from productos where id = p_producto_id) then
    raise exception 'El producto no existe.';
  end if;
  if jsonb_typeof(coalesce(p_detalles, '[]'::jsonb)) <> 'array' then
    raise exception 'El detalle de la receta no es válido.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_detalles, '[]'::jsonb)) d
    where coalesce((d->>'cantidad')::numeric, 0) <= 0
  ) then
    raise exception 'Cada materia prima debe tener una cantidad mayor que cero.';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_detalles, '[]'::jsonb)))
     <> (select count(distinct d->>'materia_prima_id') from jsonb_array_elements(coalesce(p_detalles, '[]'::jsonb)) d) then
    raise exception 'Una materia prima aparece más de una vez en la receta.';
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

  insert into receta_detalle (receta_id, materia_prima_id, cantidad)
  select v_receta_id, (d->>'materia_prima_id')::bigint, round((d->>'cantidad')::numeric, 3)
  from jsonb_array_elements(coalesce(p_detalles, '[]'::jsonb)) d;

  return v_receta_id;
end;
$$;


create or replace function public.completar_orden_produccion(
  p_orden_id bigint,
  p_cantidad_producida integer,
  p_fecha_fin date,
  p_consumos jsonb,
  p_observaciones text default null
) returns numeric
language plpgsql security invoker set search_path = public as $$
declare
  v_orden ordenes_produccion%rowtype;
  v_mp materias_primas%rowtype;
  v_producto productos%rowtype;
  v_consumo record;
  v_costo numeric := 0;
  v_codigo text := 'OP-' || lpad(p_orden_id::text, 5, '0');
begin
  select * into v_orden from ordenes_produccion where id = p_orden_id for update;
  if not found then
    raise exception 'La orden de producción no existe.';
  end if;
  if v_orden.estado not in ('pendiente', 'en_proceso') then
    raise exception 'Solo se pueden completar órdenes pendientes o en proceso.';
  end if;
  if p_cantidad_producida is null or p_cantidad_producida <= 0 then
    raise exception 'La cantidad producida debe ser mayor que cero.';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_consumos, '[]'::jsonb)))
     <> (select count(distinct d->>'materia_prima_id') from jsonb_array_elements(coalesce(p_consumos, '[]'::jsonb)) d) then
    raise exception 'Una materia prima aparece más de una vez en el consumo.';
  end if;

  for v_consumo in
    select (d->>'materia_prima_id')::bigint as materia_prima_id,
           round(coalesce((d->>'cantidad_teorica')::numeric, 0), 3) as teorica,
           round((d->>'cantidad_real')::numeric, 3) as real
    from jsonb_array_elements(coalesce(p_consumos, '[]'::jsonb)) d
  loop
    if v_consumo.real is null or v_consumo.real < 0 then
      raise exception 'La cantidad consumida no puede ser negativa.';
    end if;

    select * into v_mp from materias_primas where id = v_consumo.materia_prima_id for update;
    if not found then
      raise exception 'Una de las materias primas de la orden ya no existe.';
    end if;
    if v_mp.stock_actual < v_consumo.real then
      raise exception 'Stock insuficiente de %: disponible %, requerido %.', v_mp.nombre, v_mp.stock_actual, v_consumo.real;
    end if;

    insert into orden_produccion_consumos (orden_id, materia_prima_id, cantidad_teorica, cantidad_real, costo_unitario, subtotal)
    values (p_orden_id, v_mp.id, v_consumo.teorica, v_consumo.real, v_mp.costo_unitario, round(v_consumo.real * v_mp.costo_unitario, 2));

    if v_consumo.real > 0 then
      update materias_primas set stock_actual = stock_actual - v_consumo.real where id = v_mp.id;
      insert into movimientos_inventario
        (tipo, materia_prima_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
      values
        ('salida', v_mp.id, v_consumo.real, 'orden_produccion', p_orden_id, p_fecha_fin, 'Consumo en producción',
         v_mp.stock_actual, v_mp.stock_actual - v_consumo.real, 'Orden ' || v_codigo);
    end if;

    v_costo := v_costo + round(v_consumo.real * v_mp.costo_unitario, 2);
  end loop;

  select * into v_producto from productos where id = v_orden.producto_id for update;
  update productos set stock_actual = stock_actual + p_cantidad_producida where id = v_producto.id;
  insert into movimientos_inventario
    (tipo, producto_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
  values
    ('entrada', v_producto.id, p_cantidad_producida, 'orden_produccion', p_orden_id, p_fecha_fin, 'Producción terminada',
     v_producto.stock_actual, v_producto.stock_actual + p_cantidad_producida, 'Orden ' || v_codigo);

  update ordenes_produccion
  set estado = 'completada',
      cantidad_producida = p_cantidad_producida,
      fecha_inicio = coalesce(fecha_inicio, p_fecha_fin),
      fecha_fin = p_fecha_fin,
      costo_materiales = v_costo,
      observaciones = coalesce(nullif(btrim(coalesce(p_observaciones, '')), ''), observaciones),
      updated_at = now()
  where id = p_orden_id;

  return v_costo;
end;
$$;


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
  v_receta_id bigint;
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
    select id into v_receta_id from recetas where producto_id = p_producto_id and activo;
    if v_receta_id is null or not exists (select 1 from receta_detalle where receta_id = v_receta_id) then
      raise exception 'Solo hay % unidad(es) de % y el producto no tiene materia prima definida en su receta.', v_producto.stock_actual, v_producto.nombre;
    end if;

    for v_linea in select materia_prima_id, cantidad from receta_detalle where receta_id = v_receta_id loop
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

    -- Las unidades fabricadas entran al stock para luego salir con la venta
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

revoke all on function public.guardar_receta(bigint, text, text, jsonb) from public, anon;
revoke all on function public.completar_orden_produccion(bigint, integer, date, jsonb, text) from public, anon;
revoke all on function public.vender_producto(bigint, integer, date, text, text, text, bigint) from public, anon;
grant execute on function public.guardar_receta(bigint, text, text, jsonb) to authenticated;
grant execute on function public.completar_orden_produccion(bigint, integer, date, jsonb, text) to authenticated;
grant execute on function public.vender_producto(bigint, integer, date, text, text, text, bigint) to authenticated;
