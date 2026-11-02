-- Recepción de compras y despacho de ventas. Ejecutar después de 202610280004_iiot.sql. Es idempotente.
--
-- Compras: una compra puede registrarse como orden de compra "pendiente" de recepción. Mientras no se
-- recibe no mueve inventario ni registra gasto; al recibirla entra la materia prima, se actualiza su costo
-- y se registra el gasto. Las compras recibidas al momento funcionan igual que antes.
-- Ventas: una venta completada queda "por despachar"; se registra el despacho (guía, transportista,
-- lotes enviados) y luego la entrega al cliente.

-- ---------- Compras ----------

alter table public.compras
  add column if not exists modo_costo varchar(10) not null default 'promedio',
  add column if not exists fecha_entrega_esperada date,
  add column if not exists fecha_recepcion date,
  add column if not exists recibida_en timestamptz,
  add column if not exists observaciones_recepcion text;

alter table public.compras drop constraint if exists compras_estado_chk;
alter table public.compras add constraint compras_estado_chk
  check (estado in ('pendiente', 'completada', 'anulada')) not valid;

update public.compras set fecha_recepcion = fecha where estado = 'completada' and fecha_recepcion is null;

-- Recibe una compra pendiente: entra la materia prima, se actualiza el costo y se registra el gasto
create or replace function public.recibir_compra(p_compra_id bigint, p_fecha date default null, p_observaciones text default null)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_compra compras%rowtype;
  v_codigo text := 'C-' || lpad(p_compra_id::text, 5, '0');
  v_proveedor text;
  v_linea record;
  v_mp materias_primas%rowtype;
  v_nuevo_costo numeric;
  v_fecha date := coalesce(p_fecha, fecha_hoy_nicaragua());
begin
  select * into v_compra from compras where id = p_compra_id for update;
  if not found then
    raise exception 'La compra no existe.';
  end if;
  if v_compra.estado <> 'pendiente' then
    raise exception 'Solo se pueden recibir compras pendientes de recepción.';
  end if;
  if v_fecha < v_compra.fecha then
    raise exception 'La fecha de recepción no puede ser anterior a la de la compra.';
  end if;
  select nombre into v_proveedor from proveedores where id = v_compra.proveedor_id;

  for v_linea in select materia_prima_id, cantidad, costo_unitario from compra_detalle where compra_id = p_compra_id loop
    select * into v_mp from materias_primas where id = v_linea.materia_prima_id for update;

    v_nuevo_costo := case v_compra.modo_costo
      when 'ultimo' then v_linea.costo_unitario
      when 'promedio' then
        case when greatest(v_mp.stock_actual, 0) + v_linea.cantidad > 0
          then round((greatest(v_mp.stock_actual, 0) * v_mp.costo_unitario + v_linea.cantidad * v_linea.costo_unitario)
                     / (greatest(v_mp.stock_actual, 0) + v_linea.cantidad), 2)
          else v_linea.costo_unitario end
      else v_mp.costo_unitario
    end;

    update materias_primas
    set stock_actual = stock_actual + v_linea.cantidad, costo_unitario = v_nuevo_costo
    where id = v_mp.id;

    insert into movimientos_inventario
      (tipo, materia_prima_id, cantidad, referencia_tipo, referencia_id, fecha, motivo, stock_anterior, stock_resultante, observaciones)
    values
      ('entrada', v_mp.id, v_linea.cantidad, 'compra', p_compra_id, v_fecha, 'Recepción de compra',
       v_mp.stock_actual, v_mp.stock_actual + v_linea.cantidad, 'Compra ' || v_codigo || ' · ' || coalesce(v_proveedor, 'proveedor'));
  end loop;

  update compras
  set estado = 'completada', fecha_recepcion = v_fecha, recibida_en = now(),
      observaciones_recepcion = nullif(btrim(coalesce(p_observaciones, '')), '')
  where id = p_compra_id;

  if v_compra.total > 0 then
    insert into gastos (concepto, categoria, monto, fecha, referencia_tipo, referencia_id)
    values ('Compra ' || v_codigo || ' · ' || coalesce(v_proveedor, 'proveedor'), 'Compras de materia prima',
            v_compra.total, v_fecha, 'compra', p_compra_id);
  end if;
end;
$$;

-- p_detalles: [{ "materia_prima_id": 1, "cantidad": 10.5, "costo_unitario": 120 }]
-- p_recibir: true = la mercadería llegó (entra al inventario ya); false = orden de compra pendiente
drop function if exists public.registrar_compra(bigint, date, text, text, numeric, boolean, text, text, jsonb);

create or replace function public.registrar_compra(
  p_proveedor_id bigint,
  p_fecha date,
  p_numero_factura text,
  p_metodo_pago text,
  p_descuento numeric,
  p_aplica_iva boolean,
  p_actualizar_costo text,
  p_observaciones text,
  p_detalles jsonb,
  p_recibir boolean default true,
  p_fecha_entrega_esperada date default null
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_compra_id bigint;
  v_linea record;
  v_subtotal numeric := 0;
  v_descuento numeric := round(coalesce(p_descuento, 0), 2);
  v_impuesto numeric := 0;
  v_total numeric;
  v_fecha date := coalesce(p_fecha, fecha_hoy_nicaragua());
  v_modo text := coalesce(p_actualizar_costo, 'promedio');
begin
  if jsonb_typeof(coalesce(p_detalles, 'null'::jsonb)) is distinct from 'array' or p_detalles = '[]'::jsonb then
    raise exception 'La compra debe tener al menos una materia prima.';
  end if;
  if (select count(*) from jsonb_array_elements(p_detalles))
     <> (select count(distinct d->>'materia_prima_id') from jsonb_array_elements(p_detalles) d) then
    raise exception 'Una materia prima aparece más de una vez en la compra.';
  end if;
  if not exists (select 1 from proveedores where id = p_proveedor_id) then
    raise exception 'Seleccione un proveedor válido.';
  end if;
  if v_modo not in ('promedio', 'ultimo', 'ninguno') then
    raise exception 'Modo de actualización de costo no válido.';
  end if;
  if v_descuento < 0 then
    raise exception 'El descuento no puede ser negativo.';
  end if;

  insert into compras (proveedor_id, fecha, numero_factura, metodo_pago, observaciones, estado, modo_costo, fecha_entrega_esperada)
  values (p_proveedor_id, v_fecha, nullif(btrim(coalesce(p_numero_factura, '')), ''),
          nullif(btrim(coalesce(p_metodo_pago, '')), ''), nullif(btrim(coalesce(p_observaciones, '')), ''),
          'pendiente', v_modo, case when coalesce(p_recibir, true) then null else p_fecha_entrega_esperada end)
  returning id into v_compra_id;

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
    if not exists (select 1 from materias_primas where id = v_linea.materia_prima_id) then
      raise exception 'Una de las materias primas de la compra no existe.';
    end if;

    insert into compra_detalle (compra_id, materia_prima_id, cantidad, costo_unitario, subtotal)
    values (v_compra_id, v_linea.materia_prima_id, v_linea.cantidad, v_linea.costo, round(v_linea.cantidad * v_linea.costo, 2));

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

  if coalesce(p_recibir, true) then
    perform recibir_compra(v_compra_id, v_fecha, null);
  end if;

  return v_compra_id;
end;
$$;

-- Una compra pendiente no movió inventario ni dinero: solo se anula.
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

  if v_compra.estado = 'completada' then
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
        ('salida', v_mp.id, v_linea.cantidad, 'compra', p_compra_id, fecha_hoy_nicaragua(), 'Anulación de compra',
         v_mp.stock_actual, v_mp.stock_actual - v_linea.cantidad, 'Compra ' || v_codigo || coalesce(': ' || v_motivo, ''));
    end loop;

    delete from gastos where referencia_tipo = 'compra' and referencia_id = p_compra_id;
  end if;

  update compras
  set estado = 'anulada', anulada_en = now(), motivo_anulacion = v_motivo
  where id = p_compra_id;
end;
$$;

-- ---------- Ventas: despacho y entrega ----------

alter table public.ventas
  add column if not exists estado_despacho varchar(20) not null default 'por_despachar',
  add column if not exists fecha_despacho date,
  add column if not exists guia_despacho varchar(50),
  add column if not exists transportista varchar(120),
  add column if not exists direccion_entrega text,
  add column if not exists lotes_despacho text,
  add column if not exists fecha_entrega date,
  add column if not exists recibido_por varchar(120);

alter table public.ventas drop constraint if exists ventas_estado_despacho_chk;
alter table public.ventas add constraint ventas_estado_despacho_chk
  check (estado_despacho in ('por_despachar', 'despachada', 'entregada')) not valid;

create or replace function public.registrar_despacho(
  p_venta_id bigint,
  p_fecha date,
  p_guia text,
  p_transportista text,
  p_direccion text,
  p_lotes text
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_venta ventas%rowtype;
begin
  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if v_venta.estado <> 'completada' then
    raise exception 'Solo se despachan ventas completadas (con el producto ya descontado del inventario).';
  end if;
  if v_venta.estado_despacho <> 'por_despachar' then
    raise exception 'La venta ya fue despachada.';
  end if;
  if coalesce(p_fecha, fecha_hoy_nicaragua()) < v_venta.fecha::date then
    raise exception 'La fecha de despacho no puede ser anterior a la venta.';
  end if;

  update ventas
  set estado_despacho = 'despachada',
      fecha_despacho = coalesce(p_fecha, fecha_hoy_nicaragua()),
      guia_despacho = nullif(btrim(coalesce(p_guia, '')), ''),
      transportista = nullif(btrim(coalesce(p_transportista, '')), ''),
      direccion_entrega = nullif(btrim(coalesce(p_direccion, '')), ''),
      lotes_despacho = nullif(btrim(coalesce(p_lotes, '')), '')
  where id = p_venta_id;
end;
$$;

create or replace function public.confirmar_entrega(p_venta_id bigint, p_fecha date, p_recibido_por text)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_venta ventas%rowtype;
begin
  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if v_venta.estado <> 'completada' or v_venta.estado_despacho <> 'despachada' then
    raise exception 'Solo se confirma la entrega de ventas despachadas.';
  end if;
  if coalesce(p_fecha, fecha_hoy_nicaragua()) < v_venta.fecha_despacho then
    raise exception 'La fecha de entrega no puede ser anterior al despacho.';
  end if;

  update ventas
  set estado_despacho = 'entregada',
      fecha_entrega = coalesce(p_fecha, fecha_hoy_nicaragua()),
      recibido_por = nullif(btrim(coalesce(p_recibido_por, '')), '')
  where id = p_venta_id;
end;
$$;

revoke all on function public.recibir_compra(bigint, date, text) from public, anon;
revoke all on function public.registrar_compra(bigint, date, text, text, numeric, boolean, text, text, jsonb, boolean, date) from public, anon;
revoke all on function public.anular_compra(bigint, text) from public, anon;
revoke all on function public.registrar_despacho(bigint, date, text, text, text, text) from public, anon;
revoke all on function public.confirmar_entrega(bigint, date, text) from public, anon;
grant execute on function public.recibir_compra(bigint, date, text) to authenticated;
grant execute on function public.registrar_compra(bigint, date, text, text, numeric, boolean, text, text, jsonb, boolean, date) to authenticated;
grant execute on function public.anular_compra(bigint, text) to authenticated;
grant execute on function public.registrar_despacho(bigint, date, text, text, text, text) to authenticated;
grant execute on function public.confirmar_entrega(bigint, date, text) to authenticated;
