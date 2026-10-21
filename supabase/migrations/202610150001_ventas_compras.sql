-- Módulos de Ventas y Compras de Neumopad ERP.
-- Ejecutar en Supabase SQL Editor después de 202610120003_produccion.sql. Es idempotente.
--
-- Una venta descuenta el producto terminado con vender_producto (si no alcanza el stock, lo faltante se
-- fabrica descontando la materia prima de la receta) y registra un ingreso.
-- Una compra suma materia prima al inventario, actualiza su costo y registra un gasto.

-- ---------- Clientes ----------

alter table public.clientes
  add column if not exists identificacion varchar(30),
  add column if not exists notas text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists clientes_nombre_idx on public.clientes (nombre);

-- ---------- Proveedores ----------

alter table public.proveedores
  add column if not exists ruc varchar(30),
  add column if not exists contacto varchar(150),
  add column if not exists notas text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists proveedores_nombre_idx on public.proveedores (nombre);

-- ---------- Ventas ----------

alter table public.ventas
  add column if not exists descuento numeric(12,2) not null default 0,
  add column if not exists impuesto numeric(12,2) not null default 0,
  add column if not exists costo_total numeric(14,2) not null default 0,
  add column if not exists observaciones text,
  add column if not exists anulada_en timestamptz,
  add column if not exists motivo_anulacion text;

alter table public.ventas drop constraint if exists ventas_estado_chk;
alter table public.ventas add constraint ventas_estado_chk
  check (estado in ('completada', 'anulada')) not valid;
alter table public.ventas drop constraint if exists ventas_montos_chk;
alter table public.ventas add constraint ventas_montos_chk
  check (subtotal >= 0 and descuento >= 0 and impuesto >= 0 and total >= 0) not valid;

create index if not exists ventas_fecha_idx on public.ventas (fecha desc, id desc);
create index if not exists ventas_cliente_idx on public.ventas (cliente_id);

alter table public.venta_detalle
  add column if not exists costo_unitario numeric(12,2) not null default 0,
  add column if not exists fabricadas integer not null default 0;

create index if not exists venta_detalle_venta_idx on public.venta_detalle (venta_id);

-- ---------- Compras ----------

alter table public.compras
  add column if not exists descuento numeric(12,2) not null default 0,
  add column if not exists impuesto numeric(12,2) not null default 0,
  add column if not exists metodo_pago varchar(50),
  add column if not exists observaciones text,
  add column if not exists anulada_en timestamptz,
  add column if not exists motivo_anulacion text;

alter table public.compras drop constraint if exists compras_estado_chk;
alter table public.compras add constraint compras_estado_chk
  check (estado in ('completada', 'anulada')) not valid;
alter table public.compras drop constraint if exists compras_montos_chk;
alter table public.compras add constraint compras_montos_chk
  check (subtotal >= 0 and descuento >= 0 and impuesto >= 0 and total >= 0) not valid;

create index if not exists compras_fecha_idx on public.compras (fecha desc, id desc);
create index if not exists compras_proveedor_idx on public.compras (proveedor_id);
create index if not exists compra_detalle_compra_idx on public.compra_detalle (compra_id);

-- ---------- Seguridad: solo usuarios autenticados ----------

alter table public.clientes enable row level security;
alter table public.proveedores enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_detalle enable row level security;
alter table public.compras enable row level security;
alter table public.compra_detalle enable row level security;
alter table public.ingresos enable row level security;
alter table public.gastos enable row level security;

drop policy if exists "ventas clientes autenticado" on public.clientes;
create policy "ventas clientes autenticado" on public.clientes
  for all to authenticated using (true) with check (true);

drop policy if exists "compras proveedores autenticado" on public.proveedores;
create policy "compras proveedores autenticado" on public.proveedores
  for all to authenticated using (true) with check (true);

drop policy if exists "ventas ventas autenticado" on public.ventas;
create policy "ventas ventas autenticado" on public.ventas
  for all to authenticated using (true) with check (true);

drop policy if exists "ventas detalle autenticado" on public.venta_detalle;
create policy "ventas detalle autenticado" on public.venta_detalle
  for all to authenticated using (true) with check (true);

drop policy if exists "compras compras autenticado" on public.compras;
create policy "compras compras autenticado" on public.compras
  for all to authenticated using (true) with check (true);

drop policy if exists "compras detalle autenticado" on public.compra_detalle;
create policy "compras detalle autenticado" on public.compra_detalle
  for all to authenticated using (true) with check (true);

drop policy if exists "finanzas ingresos autenticado" on public.ingresos;
create policy "finanzas ingresos autenticado" on public.ingresos
  for all to authenticated using (true) with check (true);

drop policy if exists "finanzas gastos autenticado" on public.gastos;
create policy "finanzas gastos autenticado" on public.gastos
  for all to authenticated using (true) with check (true);

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
  v_resultado jsonb;
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

  insert into ventas (cliente_id, fecha, metodo_pago, observaciones, estado)
  values (p_cliente_id, v_fecha::timestamp at time zone 'UTC', nullif(btrim(coalesce(p_metodo_pago, '')), ''),
          nullif(btrim(coalesce(p_observaciones, '')), ''), 'completada')
  returning id into v_venta_id;

  v_codigo := 'V-' || lpad(v_venta_id::text, 5, '0');

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

    select * into v_producto from productos where id = v_linea.producto_id;
    if not found then
      raise exception 'Uno de los productos de la venta no existe.';
    end if;

    -- Descuenta del stock terminado y fabrica lo faltante con la receta
    v_resultado := vender_producto(v_linea.producto_id, v_linea.cantidad::integer, v_fecha, 'Venta',
                                   'Venta ' || v_codigo, 'venta', v_venta_id);

    insert into venta_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, costo_unitario, fabricadas)
    values (v_venta_id, v_linea.producto_id, v_linea.cantidad::integer, v_linea.precio,
            round(v_linea.cantidad * v_linea.precio, 2), v_producto.costo_produccion,
            coalesce((v_resultado->>'fabricadas')::integer, 0));

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
  set subtotal = v_subtotal, descuento = v_descuento, impuesto = v_impuesto, total = v_total, costo_total = v_costo
  where id = v_venta_id;

  if v_total > 0 then
    insert into ingresos (concepto, monto, fecha, referencia_tipo, referencia_id)
    values ('Venta ' || v_codigo, v_total, v_fecha, 'venta', v_venta_id);
  end if;

  return v_venta_id;
end;
$$;

-- ---------- Anular venta ----------
-- Los productos vuelven al stock terminado (también los fabricados al vender) y se elimina el ingreso.

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

  update ventas
  set estado = 'anulada', anulada_en = now(), motivo_anulacion = v_motivo
  where id = p_venta_id;
end;
$$;

-- ---------- Registrar compra ----------
-- p_detalles: [{ "materia_prima_id": 1, "cantidad": 10.5, "costo_unitario": 120 }]
-- p_actualizar_costo: 'promedio' (promedio ponderado), 'ultimo' (último precio) o 'ninguno'

create or replace function public.registrar_compra(
  p_proveedor_id bigint,
  p_fecha date,
  p_numero_factura text,
  p_metodo_pago text,
  p_descuento numeric,
  p_aplica_iva boolean,
  p_actualizar_costo text,
  p_observaciones text,
  p_detalles jsonb
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_compra_id bigint;
  v_codigo text;
  v_proveedor text;
  v_linea record;
  v_mp materias_primas%rowtype;
  v_nuevo_costo numeric;
  v_subtotal numeric := 0;
  v_descuento numeric := round(coalesce(p_descuento, 0), 2);
  v_impuesto numeric := 0;
  v_total numeric;
  v_fecha date := coalesce(p_fecha, current_date);
  v_modo text := coalesce(p_actualizar_costo, 'promedio');
begin
  if jsonb_typeof(coalesce(p_detalles, 'null'::jsonb)) is distinct from 'array' or p_detalles = '[]'::jsonb then
    raise exception 'La compra debe tener al menos una materia prima.';
  end if;
  if (select count(*) from jsonb_array_elements(p_detalles))
     <> (select count(distinct d->>'materia_prima_id') from jsonb_array_elements(p_detalles) d) then
    raise exception 'Una materia prima aparece más de una vez en la compra.';
  end if;
  select nombre into v_proveedor from proveedores where id = p_proveedor_id;
  if not found then
    raise exception 'Seleccione un proveedor válido.';
  end if;
  if v_modo not in ('promedio', 'ultimo', 'ninguno') then
    raise exception 'Modo de actualización de costo no válido.';
  end if;
  if v_descuento < 0 then
    raise exception 'El descuento no puede ser negativo.';
  end if;

  insert into compras (proveedor_id, fecha, numero_factura, metodo_pago, observaciones, estado)
  values (p_proveedor_id, v_fecha, nullif(btrim(coalesce(p_numero_factura, '')), ''),
          nullif(btrim(coalesce(p_metodo_pago, '')), ''), nullif(btrim(coalesce(p_observaciones, '')), ''), 'completada')
  returning id into v_compra_id;

  v_codigo := 'C-' || lpad(v_compra_id::text, 5, '0');

  for v_linea in
    select (d->>'materia_prima_id')::bigint as materia_prima_id,
           round((d->>'cantidad')::numeric, 3) as cantidad,
           round((d->>'costo_unitario')::numeric, 2) as costo
    from jsonb_array_elements(p_detalles) d
  loop
    if v_linea.cantidad is null or v_linea.cantidad <= 0 then
      raise exception 'Las cantidades compradas deben ser mayores que cero.';
    end if;
    if v_linea.costo is null or v_linea.costo < 0 then
      raise exception 'El costo unitario no puede ser negativo.';
    end if;

    select * into v_mp from materias_primas where id = v_linea.materia_prima_id for update;
    if not found then
      raise exception 'Una de las materias primas de la compra no existe.';
    end if;

    v_nuevo_costo := case v_modo
      when 'ultimo' then v_linea.costo
      when 'promedio' then
        case when greatest(v_mp.stock_actual, 0) + v_linea.cantidad > 0
          then round((greatest(v_mp.stock_actual, 0) * v_mp.costo_unitario + v_linea.cantidad * v_linea.costo)
                     / (greatest(v_mp.stock_actual, 0) + v_linea.cantidad), 2)
          else v_linea.costo end
      else v_mp.costo_unitario
    end;

    update materias_primas
    set stock_actual = stock_actual + v_linea.cantidad, costo_unitario = v_nuevo_costo
    where id = v_mp.id;

    insert into movimientos_inventario
      (tipo, materia_prima_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
    values
      ('entrada', v_mp.id, v_linea.cantidad, 'compra', v_compra_id, v_fecha, 'Compra a proveedor',
       v_mp.stock_actual, v_mp.stock_actual + v_linea.cantidad, 'Compra ' || v_codigo || ' · ' || v_proveedor);

    insert into compra_detalle (compra_id, materia_prima_id, cantidad, costo_unitario, subtotal)
    values (v_compra_id, v_mp.id, v_linea.cantidad, v_linea.costo, round(v_linea.cantidad * v_linea.costo, 2));

    v_subtotal := v_subtotal + round(v_linea.cantidad * v_linea.costo, 2);
  end loop;

  if v_descuento > v_subtotal then
    raise exception 'El descuento no puede ser mayor que el subtotal.';
  end if;
  if coalesce(p_aplica_iva, false) then
    v_impuesto := round((v_subtotal - v_descuento) * 0.15, 2);
  end if;
  v_total := v_subtotal - v_descuento + v_impuesto;

  update compras
  set subtotal = v_subtotal, descuento = v_descuento, impuesto = v_impuesto, total = v_total
  where id = v_compra_id;

  if v_total > 0 then
    insert into gastos (concepto, categoria, monto, fecha, referencia_tipo, referencia_id)
    values ('Compra ' || v_codigo || ' · ' || v_proveedor, 'Compras de materia prima', v_total, v_fecha, 'compra', v_compra_id);
  end if;

  return v_compra_id;
end;
$$;

-- ---------- Anular compra ----------
-- Retira del inventario la materia prima comprada (si aún hay stock) y elimina el gasto.
-- El costo unitario de la materia prima no se revierte.

create or replace function public.anular_compra(p_compra_id bigint, p_motivo text)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_compra compras%rowtype;
  v_linea record;
  v_mp materias_primas%rowtype;
  v_codigo text := 'C-' || lpad(p_compra_id::text, 5, '0');
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  select * into v_compra from compras where id = p_compra_id for update;
  if not found then
    raise exception 'La compra no existe.';
  end if;
  if v_compra.estado = 'anulada' then
    raise exception 'La compra ya está anulada.';
  end if;

  for v_linea in select materia_prima_id, cantidad from compra_detalle where compra_id = p_compra_id loop
    select * into v_mp from materias_primas where id = v_linea.materia_prima_id for update;
    if v_mp.stock_actual < v_linea.cantidad then
      raise exception 'No se puede anular: de % solo quedan % y la compra ingresó %. Ya se consumió en producción o ventas.',
        v_mp.nombre, v_mp.stock_actual, v_linea.cantidad;
    end if;
    update materias_primas set stock_actual = stock_actual - v_linea.cantidad where id = v_mp.id;
    insert into movimientos_inventario
      (tipo, materia_prima_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
    values
      ('salida', v_mp.id, v_linea.cantidad, 'compra', p_compra_id, current_date, 'Anulación de compra',
       v_mp.stock_actual, v_mp.stock_actual - v_linea.cantidad, 'Compra ' || v_codigo || coalesce(': ' || v_motivo, ''));
  end loop;

  delete from gastos where referencia_tipo = 'compra' and referencia_id = p_compra_id;

  update compras
  set estado = 'anulada', anulada_en = now(), motivo_anulacion = v_motivo
  where id = p_compra_id;
end;
$$;

revoke all on function public.registrar_venta(bigint, date, text, numeric, boolean, text, jsonb) from public, anon;
revoke all on function public.anular_venta(bigint, text) from public, anon;
revoke all on function public.registrar_compra(bigint, date, text, text, numeric, boolean, text, text, jsonb) from public, anon;
revoke all on function public.anular_compra(bigint, text) from public, anon;
grant execute on function public.registrar_venta(bigint, date, text, numeric, boolean, text, jsonb) to authenticated;
grant execute on function public.anular_venta(bigint, text) to authenticated;
grant execute on function public.registrar_compra(bigint, date, text, text, numeric, boolean, text, text, jsonb) to authenticated;
grant execute on function public.anular_compra(bigint, text) to authenticated;
