-- Corrige la fecha con que se completan las ventas pendientes. Ejecutar después de 202610250002_ventas_pendientes.sql.
-- Es idempotente.
--
-- La base trabaja en UTC: después de las 6 p. m. de Nicaragua current_date ya es el día siguiente, así que
-- una venta completada en la noche quedaba con fecha de mañana y no aparecía en "Ventas de hoy".
-- Ahora la fecha la pone quien completa: la fecha de finalización de la orden o la del navegador.

-- Fecha de hoy en Nicaragua, por si no llega una fecha desde la aplicación
create or replace function public.fecha_hoy_nicaragua()
returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'America/Managua')::date
$$;

-- Las versiones sin fecha se reemplazan por las nuevas
drop function if exists public.completar_venta(bigint);
drop function if exists public.completar_ventas_pendientes(bigint);

-- ---------- Completar venta pendiente ----------

create or replace function public.completar_venta(p_venta_id bigint, p_fecha date default null)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_venta ventas%rowtype;
  v_linea record;
  v_disponible integer;
  v_fecha date := coalesce(p_fecha, fecha_hoy_nicaragua());
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
      ('salida', v_linea.producto_id, v_linea.cantidad, 'venta', p_venta_id, v_fecha, 'Venta',
       v_linea.stock_actual, v_linea.stock_actual - v_linea.cantidad, 'Venta ' || v_codigo || ' (pedido completado)');
  end loop;

  update ventas
  set estado = 'completada', completada_en = now(), fecha = v_fecha::timestamp at time zone 'UTC'
  where id = p_venta_id;

  if v_venta.total > 0 then
    insert into ingresos (concepto, monto, fecha, referencia_tipo, referencia_id)
    values ('Venta ' || v_codigo, v_venta.total, v_fecha, 'venta', p_venta_id);
  end if;
end;
$$;

create or replace function public.completar_ventas_pendientes(p_producto_id bigint, p_fecha date default null)
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
      perform completar_venta(v_id, p_fecha);
      v_completadas := v_completadas + 1;
    exception when others then
      -- Aún no alcanza el stock para esta venta: sigue pendiente
      null;
    end;
  end loop;
  return v_completadas;
end;
$$;

-- La venta se completa con la misma fecha en que se terminó la orden
create or replace function public.ordenes_produccion_completar_ventas()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.estado = 'completada' and old.estado is distinct from 'completada' then
    perform completar_ventas_pendientes(new.producto_id, new.fecha_fin);
  end if;
  return new;
end;
$$;

revoke all on function public.fecha_hoy_nicaragua() from public, anon;
revoke all on function public.completar_venta(bigint, date) from public, anon;
revoke all on function public.completar_ventas_pendientes(bigint, date) from public, anon;
grant execute on function public.fecha_hoy_nicaragua() to authenticated;
grant execute on function public.completar_venta(bigint, date) to authenticated;
grant execute on function public.completar_ventas_pendientes(bigint, date) to authenticated;

-- ---------- Corregir las ventas ya completadas con fecha de mañana ----------
-- Solo las que venían de una venta pendiente: se toma el día real (hora de Nicaragua) en que se completaron.

with corregidas as (
  select v.id, (v.completada_en at time zone 'America/Managua')::date as dia
  from ventas v
  where v.estado = 'completada'
    and v.completada_en is not null
    and exists (select 1 from venta_detalle d where d.venta_id = v.id and d.por_producir > 0)
)
update ventas v
set fecha = c.dia::timestamp at time zone 'UTC'
from corregidas c
where v.id = c.id;

with corregidas as (
  select v.id, (v.completada_en at time zone 'America/Managua')::date as dia
  from ventas v
  where v.estado = 'completada'
    and v.completada_en is not null
    and exists (select 1 from venta_detalle d where d.venta_id = v.id and d.por_producir > 0)
)
update ingresos i
set fecha = c.dia
from corregidas c
where i.referencia_tipo = 'venta' and i.referencia_id = c.id and i.fecha <> c.dia;

with corregidas as (
  select v.id, (v.completada_en at time zone 'America/Managua')::date as dia
  from ventas v
  where v.estado = 'completada'
    and v.completada_en is not null
    and exists (select 1 from venta_detalle d where d.venta_id = v.id and d.por_producir > 0)
)
update movimientos_inventario m
set fecha = c.dia
from corregidas c
where m.referencia_tipo = 'venta' and m.referencia_id = c.id
  and m.observaciones like '%(pedido completado)' and m.fecha <> c.dia;
