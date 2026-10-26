-- Ventas pendientes de producción. Ejecutar después de 202610250001_validaciones_notificaciones.sql. Es idempotente.
--
-- Ya no se vende lo que no está hecho: si el stock terminado no alcanza, la venta queda "pendiente",
-- sin mover inventario ni registrar ingreso, y se crea una orden de producción por lo que falta.
-- Cuando esa orden se completa (o con el botón "Completar venta"), la venta descuenta el stock y
-- registra el ingreso. Las ventas pendientes apartan su producto, la más antigua primero.

-- ---------- Columnas ----------

alter table public.ventas
  add column if not exists completada_en timestamptz;

alter table public.ventas drop constraint if exists ventas_estado_chk;
alter table public.ventas add constraint ventas_estado_chk
  check (estado in ('pendiente', 'completada', 'anulada')) not valid;

create index if not exists ventas_pendientes_idx on public.ventas (id) where estado = 'pendiente';

-- Unidades que no había en stock al registrar la venta
alter table public.venta_detalle
  add column if not exists por_producir integer not null default 0;

-- Orden creada para surtir una venta pendiente
alter table public.ordenes_produccion
  add column if not exists venta_id bigint references public.ventas (id) on delete set null;

create index if not exists ordenes_produccion_venta_idx on public.ordenes_produccion (venta_id);

-- ---------- Producto apartado por ventas pendientes ----------
-- Con p_antes_de solo cuentan las ventas pendientes anteriores (para completar en orden de llegada).

create or replace function public.unidades_reservadas_ventas(p_producto_id bigint, p_antes_de bigint default null)
returns integer
language sql stable security invoker set search_path = public as $$
  select coalesce(sum(d.cantidad), 0)::integer
  from venta_detalle d
  join ventas v on v.id = d.venta_id
  where v.estado = 'pendiente'
    and d.producto_id = p_producto_id
    and (p_antes_de is null or v.id < p_antes_de)
$$;

-- ---------- Registrar venta ----------
-- p_detalles: [{ "producto_id": 1, "cantidad": 2, "precio_unitario": 350 }]

create or replace function public.registrar_venta(
  p_cliente_id bigint,
  p_fecha date,
  p_metodo_pago text,
  p_descuento numeric,
  p_aplica_iva boolean,
  p_observaciones text,
  p_detalles jsonb
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_venta_id bigint;
  v_codigo text;
  v_linea record;
  v_producto productos%rowtype;
  v_disponible integer;
  v_por_producir integer;
  v_pendiente boolean := false;
  v_subtotal numeric := 0;
  v_costo numeric := 0;
  v_descuento numeric := round(coalesce(p_descuento, 0), 2);
  v_impuesto numeric := 0;
  v_total numeric;
  v_fecha date := coalesce(p_fecha, current_date);
begin
  if jsonb_typeof(coalesce(p_detalles, 'null'::jsonb)) is distinct from 'array' or p_detalles = '[]'::jsonb then
    raise exception 'La venta debe tener al menos un producto.';
  end if;
  if (select count(*) from jsonb_array_elements(p_detalles))
     <> (select count(distinct d->>'producto_id') from jsonb_array_elements(p_detalles) d) then
    raise exception 'Un producto aparece más de una vez en la venta.';
  end if;
  if p_cliente_id is not null and not exists (select 1 from clientes where id = p_cliente_id) then
    raise exception 'El cliente no existe.';
  end if;
  if v_descuento < 0 then
    raise exception 'El descuento no puede ser negativo.';
  end if;

  -- Primera pasada: validar y decidir si hay stock terminado para todo
  for v_linea in
    select (d->>'producto_id')::bigint as producto_id,
           (d->>'cantidad')::numeric as cantidad,
           round((d->>'precio_unitario')::numeric, 2) as precio
    from jsonb_array_elements(p_detalles) d
  loop
    if v_linea.cantidad is null or v_linea.cantidad <= 0 or v_linea.cantidad <> trunc(v_linea.cantidad) then
      raise exception 'Las cantidades vendidas deben ser enteros mayores que cero.';
    end if;
    if v_linea.precio is null or v_linea.precio < 0 then
      raise exception 'El precio de venta no puede ser negativo.';
    end if;
    select * into v_producto from productos where id = v_linea.producto_id for update;
    if not found then
      raise exception 'Uno de los productos de la venta no existe.';
    end if;
    v_disponible := greatest(v_producto.stock_actual - unidades_reservadas_ventas(v_producto.id), 0);
    if v_linea.cantidad > v_disponible then
      v_pendiente := true;
    end if;
  end loop;

  insert into ventas (cliente_id, fecha, metodo_pago, observaciones, estado)
  values (p_cliente_id, v_fecha::timestamp at time zone 'UTC', nullif(btrim(coalesce(p_metodo_pago, '')), ''),
          nullif(btrim(coalesce(p_observaciones, '')), ''), case when v_pendiente then 'pendiente' else 'completada' end)
  returning id into v_venta_id;

  v_codigo := 'V-' || lpad(v_venta_id::text, 5, '0');

  for v_linea in
    select (d->>'producto_id')::bigint as producto_id,
           (d->>'cantidad')::integer as cantidad,
           round((d->>'precio_unitario')::numeric, 2) as precio
    from jsonb_array_elements(p_detalles) d
  loop
    select * into v_producto from productos where id = v_linea.producto_id;
    v_disponible := greatest(v_producto.stock_actual - unidades_reservadas_ventas(v_producto.id), 0);
    v_por_producir := greatest(v_linea.cantidad - v_disponible, 0);

    insert into venta_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, costo_unitario, fabricadas, por_producir)
    values (v_venta_id, v_linea.producto_id, v_linea.cantidad, v_linea.precio,
            round(v_linea.cantidad * v_linea.precio, 2), v_producto.costo_produccion, 0,
            case when v_pendiente then v_por_producir else 0 end);

    if not v_pendiente then
      -- Hay stock para todo: sale del stock terminado
      perform vender_producto(v_linea.producto_id, v_linea.cantidad, v_fecha, 'Venta',
                              'Venta ' || v_codigo, 'venta', v_venta_id);
    elsif v_por_producir > 0 then
      -- Se pide fabricar lo que falta. Si no alcanza la materia prima la orden no se crea
      -- y queda la notificación para producir cuando se compre.
      begin
        insert into ordenes_produccion (producto_id, receta_id, cantidad_planificada, estado, fecha_programada, observaciones, venta_id)
        values (v_linea.producto_id,
                (select id from recetas where producto_id = v_linea.producto_id and activo),
                v_por_producir, 'pendiente', current_date, 'Para la venta ' || v_codigo, v_venta_id);
      exception when others then
        null;
      end;
    end if;

    v_subtotal := v_subtotal + round(v_linea.cantidad * v_linea.precio, 2);
    v_costo := v_costo + round(v_linea.cantidad * v_producto.costo_produccion, 2);
  end loop;

  if v_descuento > v_subtotal then
    raise exception 'El descuento no puede ser mayor que el subtotal.';
  end if;
  if coalesce(p_aplica_iva, false) then
    v_impuesto := round((v_subtotal - v_descuento) * 0.15, 2);
  end if;
  v_total := v_subtotal - v_descuento + v_impuesto;

  update ventas
  set subtotal = v_subtotal, descuento = v_descuento, impuesto = v_impuesto, total = v_total, costo_total = v_costo,
      completada_en = case when v_pendiente then null else now() end
  where id = v_venta_id;

  -- Una venta pendiente aún no es dinero: el ingreso se registra al completarla
  if not v_pendiente and v_total > 0 then
    insert into ingresos (concepto, monto, fecha, referencia_tipo, referencia_id)
    values ('Venta ' || v_codigo, v_total, v_fecha, 'venta', v_venta_id);
  end if;

  return v_venta_id;
end;
$$;

-- ---------- Completar venta pendiente ----------
-- Descuenta el stock terminado y registra el ingreso con la fecha de hoy.

create or replace function public.completar_venta(p_venta_id bigint)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_venta ventas%rowtype;
  v_linea record;
  v_disponible integer;
  v_codigo text := 'V-' || lpad(p_venta_id::text, 5, '0');
begin
  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if v_venta.estado <> 'pendiente' then
    raise exception 'Solo se pueden completar ventas pendientes.';
  end if;

  -- Las ventas pendientes más antiguas tienen prioridad sobre el stock
  for v_linea in
    select d.producto_id, d.cantidad, p.nombre, p.stock_actual
    from venta_detalle d
    join productos p on p.id = d.producto_id
    where d.venta_id = p_venta_id
    for update of p
  loop
    v_disponible := greatest(v_linea.stock_actual - unidades_reservadas_ventas(v_linea.producto_id, p_venta_id), 0);
    if v_linea.cantidad > v_disponible then
      raise exception 'Aún faltan % und de % para completar la venta % (hay % disponibles). Complete la orden de producción primero.',
        v_linea.cantidad - v_disponible, v_linea.nombre, v_codigo, v_disponible;
    end if;
  end loop;

  for v_linea in
    select d.producto_id, d.cantidad, p.stock_actual
    from venta_detalle d
    join productos p on p.id = d.producto_id
    where d.venta_id = p_venta_id
  loop
    update productos set stock_actual = stock_actual - v_linea.cantidad where id = v_linea.producto_id;
    insert into movimientos_inventario
      (tipo, producto_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
    values
      ('salida', v_linea.producto_id, v_linea.cantidad, 'venta', p_venta_id, current_date, 'Venta',
       v_linea.stock_actual, v_linea.stock_actual - v_linea.cantidad, 'Venta ' || v_codigo || ' (pedido completado)');
  end loop;

  update ventas
  set estado = 'completada', completada_en = now(), fecha = current_date::timestamp at time zone 'UTC'
  where id = p_venta_id;

  if v_venta.total > 0 then
    insert into ingresos (concepto, monto, fecha, referencia_tipo, referencia_id)
    values ('Venta ' || v_codigo, v_venta.total, current_date, 'venta', p_venta_id);
  end if;
end;
$$;

-- Completa, en orden de llegada, las ventas pendientes de un producto que ya tengan stock
create or replace function public.completar_ventas_pendientes(p_producto_id bigint)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_id bigint;
  v_completadas integer := 0;
begin
  for v_id in
    select distinct v.id
    from ventas v
    join venta_detalle d on d.venta_id = v.id
    where v.estado = 'pendiente' and d.producto_id = p_producto_id
    order by v.id
  loop
    begin
      perform completar_venta(v_id);
      v_completadas := v_completadas + 1;
    exception when others then
      -- Aún no alcanza el stock para esta venta: sigue pendiente
      null;
    end;
  end loop;
  return v_completadas;
end;
$$;

-- Al completar una orden de producción se intentan completar las ventas que esperaban ese producto
create or replace function public.ordenes_produccion_completar_ventas()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.estado = 'completada' and old.estado is distinct from 'completada' then
    perform completar_ventas_pendientes(new.producto_id);
  end if;
  return new;
end;
$$;

drop trigger if exists ordenes_produccion_completar_ventas on public.ordenes_produccion;
create trigger ordenes_produccion_completar_ventas
  after update on public.ordenes_produccion
  for each row execute function public.ordenes_produccion_completar_ventas();

-- ---------- Anular venta ----------
-- Una venta pendiente no movió inventario ni dinero: solo se anula y se cancelan sus órdenes sin iniciar.
-- Una completada devuelve los productos al stock y elimina el ingreso.

create or replace function public.anular_venta(p_venta_id bigint, p_motivo text)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_venta ventas%rowtype;
  v_linea record;
  v_producto productos%rowtype;
  v_codigo text := 'V-' || lpad(p_venta_id::text, 5, '0');
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta ya está anulada.';
  end if;

  if v_venta.estado = 'pendiente' then
    update ordenes_produccion
    set estado = 'cancelada', fecha_fin = current_date, updated_at = now(),
        observaciones = coalesce(observaciones || E'\n', '') || 'Cancelada: se anuló la venta ' || v_codigo
    where venta_id = p_venta_id and estado = 'pendiente';
  else
    for v_linea in select producto_id, cantidad from venta_detalle where venta_id = p_venta_id loop
      select * into v_producto from productos where id = v_linea.producto_id for update;
      update productos set stock_actual = stock_actual + v_linea.cantidad where id = v_producto.id;
      insert into movimientos_inventario
        (tipo, producto_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
      values
        ('entrada', v_producto.id, v_linea.cantidad, 'venta', p_venta_id, current_date, 'Anulación de venta',
         v_producto.stock_actual, v_producto.stock_actual + v_linea.cantidad, 'Venta ' || v_codigo || coalesce(': ' || v_motivo, ''));
    end loop;

    delete from ingresos where referencia_tipo = 'venta' and referencia_id = p_venta_id;
  end if;

  update ventas
  set estado = 'anulada', anulada_en = now(), motivo_anulacion = v_motivo
  where id = p_venta_id;
end;
$$;

revoke all on function public.unidades_reservadas_ventas(bigint, bigint) from public, anon;
revoke all on function public.registrar_venta(bigint, date, text, numeric, boolean, text, jsonb) from public, anon;
revoke all on function public.completar_venta(bigint) from public, anon;
revoke all on function public.completar_ventas_pendientes(bigint) from public, anon;
revoke all on function public.anular_venta(bigint, text) from public, anon;
grant execute on function public.unidades_reservadas_ventas(bigint, bigint) to authenticated;
grant execute on function public.registrar_venta(bigint, date, text, numeric, boolean, text, jsonb) to authenticated;
grant execute on function public.completar_venta(bigint) to authenticated;
grant execute on function public.completar_ventas_pendientes(bigint) to authenticated;
grant execute on function public.anular_venta(bigint, text) to authenticated;
