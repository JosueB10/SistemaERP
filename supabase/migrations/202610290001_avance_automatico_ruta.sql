-- Avance automático de la ruta y planta conectada por IIoT.
-- Ejecutar después de 202610280007_inicio_automatico_ordenes.sql. Es idempotente.
--
-- · Al iniciar la orden arranca sola su primera operación; al terminar una operación arranca la siguiente
--   (su inicio es el fin de la anterior). Ya no hay que pulsar "Iniciar" en cada paso.
-- · Las máquinas (el emulador iiot/emulador.py) consultan qué operación tienen en proceso, la trabajan y
--   la terminan solas por el endpoint /api/iiot/operaciones. Al terminar la última operación la orden se
--   cierra sola: se explota la BOM, se descuenta la materia prima y se crea el lote para Calidad.
-- · En modo acelerado (--velocidad 20) el emulador registra la escala de tiempo, para que el OEE se
--   calcule en minutos de planta y no en los segundos reales de la demostración.

alter table public.orden_operaciones
  add column if not exists escala_tiempo numeric(8,2) not null default 1,
  add column if not exists registrado_por varchar(10) not null default 'manual';

alter table public.orden_operaciones drop constraint if exists orden_operaciones_escala_chk;
alter table public.orden_operaciones add constraint orden_operaciones_escala_chk
  check (escala_tiempo >= 1 and escala_tiempo <= 1000 and registrado_por in ('manual', 'iiot'));

-- ---------- Arranque de la primera operación al iniciar la orden ----------

create or replace function public.ordenes_produccion_generar_operaciones()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.estado = 'en_proceso' and (tg_op = 'INSERT' or old.estado is distinct from 'en_proceso') then
    perform generar_operaciones_orden(new.id);
    update orden_operaciones
    set estado = 'en_proceso', inicio = now(), empleado_id = coalesce(empleado_id, new.empleado_id)
    where orden_id = new.id
      and estado = 'pendiente'
      and secuencia = (select min(secuencia) from orden_operaciones where orden_id = new.id)
      and not exists (select 1 from orden_operaciones where orden_id = new.id and estado <> 'pendiente');
  end if;
  return new;
end;
$$;

-- ---------- Al terminar una operación arranca la siguiente ----------

create or replace function public.orden_operaciones_iniciar_siguiente()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.estado = 'completada' and old.estado is distinct from 'completada' then
    update orden_operaciones op
    set estado = 'en_proceso', inicio = coalesce(new.fin, now()), empleado_id = coalesce(op.empleado_id, new.empleado_id)
    where op.orden_id = new.orden_id
      and op.estado = 'pendiente'
      and op.secuencia = (select min(secuencia) from orden_operaciones where orden_id = new.orden_id and secuencia > new.secuencia)
      and exists (select 1 from ordenes_produccion o where o.id = new.orden_id and o.estado = 'en_proceso');
  end if;
  return new;
end;
$$;

drop trigger if exists orden_operaciones_iniciar_siguiente on public.orden_operaciones;
create trigger orden_operaciones_iniciar_siguiente
  after update on public.orden_operaciones
  for each row execute function public.orden_operaciones_iniciar_siguiente();

-- Órdenes en proceso que tenían su siguiente paso sin iniciar
update public.orden_operaciones op
set estado = 'en_proceso',
    inicio = coalesce((select max(a.fin) from public.orden_operaciones a where a.orden_id = op.orden_id and a.estado = 'completada'), now())
where op.estado = 'pendiente'
  and exists (select 1 from public.ordenes_produccion o where o.id = op.orden_id and o.estado = 'en_proceso')
  and not exists (select 1 from public.orden_operaciones a where a.orden_id = op.orden_id and a.estado = 'en_proceso')
  and op.secuencia = (select min(a.secuencia) from public.orden_operaciones a where a.orden_id = op.orden_id and a.estado = 'pendiente');

-- ---------- Consulta de las máquinas: qué operaciones hay en proceso ----------

create or replace function public.operaciones_activas_iiot()
returns table (
  operacion_id bigint,
  orden_id bigint,
  orden text,
  producto text,
  secuencia integer,
  operacion text,
  centro text,
  inicio timestamptz,
  tiempo_preparacion_min numeric,
  tiempo_estandar_min numeric,
  entrada integer,
  ultima boolean
)
language sql stable security invoker set search_path = public as $$
  select op.id, o.id, 'OP-' || lpad(o.id::text, 5, '0'), p.nombre, op.secuencia, op.nombre, c.codigo, op.inicio,
         op.tiempo_preparacion_min, op.tiempo_estandar_min, cantidad_entrada_operacion(op.id),
         not exists (select 1 from orden_operaciones x where x.orden_id = op.orden_id and x.secuencia > op.secuencia)
  from orden_operaciones op
  join ordenes_produccion o on o.id = op.orden_id
  join centros_trabajo c on c.id = op.centro_trabajo_id
  left join productos p on p.id = o.producto_id
  where op.estado = 'en_proceso' and o.estado = 'en_proceso'
  order by op.inicio
$$;

-- ---------- Una máquina termina su operación ----------
-- p_paro_min y la duración se interpretan en minutos de planta (tiempo real × p_escala).
-- Si era la última operación, cierra la orden con el consumo teórico de la BOM explotada.

create or replace function public.terminar_operacion_iiot(
  p_operacion_id bigint,
  p_cantidad_buena integer,
  p_cantidad_rechazada integer,
  p_paro_min numeric,
  p_escala numeric,
  p_motivo_paro text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_op orden_operaciones%rowtype;
  v_orden ordenes_produccion%rowtype;
  v_escala numeric := least(greatest(coalesce(p_escala, 1), 1), 1000);
  v_planta_min numeric;
  v_paro numeric;
  v_entrada integer;
  v_siguiente text;
  v_cerrada boolean := false;
  v_lote text;
  v_error text;
  v_consumos jsonb;
begin
  select * into v_op from orden_operaciones where id = p_operacion_id for update;
  if not found then
    raise exception 'La operación no existe.';
  end if;
  if v_op.estado <> 'en_proceso' then
    raise exception 'La operación % no está en proceso.', v_op.nombre;
  end if;
  if coalesce(p_cantidad_buena, -1) < 0 or coalesce(p_cantidad_rechazada, -1) < 0 or p_cantidad_buena + p_cantidad_rechazada = 0 then
    raise exception 'Cantidades no válidas.';
  end if;
  v_entrada := cantidad_entrada_operacion(p_operacion_id);
  if p_cantidad_buena + p_cantidad_rechazada > v_entrada then
    raise exception 'A esta operación solo llegaron % pieza(s).', v_entrada;
  end if;

  v_planta_min := extract(epoch from (now() - v_op.inicio)) / 60 * v_escala;
  if v_planta_min <= 0 then
    raise exception 'La operación aún no tiene duración.';
  end if;
  -- El paro nunca puede ocupar toda la operación
  v_paro := round(least(greatest(coalesce(p_paro_min, 0), 0), v_planta_min * 0.9), 2);

  update orden_operaciones
  set estado = 'completada',
      fin = now(),
      cantidad_buena = p_cantidad_buena,
      cantidad_rechazada = p_cantidad_rechazada,
      tiempo_paro_min = v_paro,
      motivo_paro = nullif(btrim(coalesce(p_motivo_paro, '')), ''),
      escala_tiempo = v_escala,
      registrado_por = 'iiot',
      observaciones = case when p_cantidad_rechazada > 0 then 'No pasaron la inspección de la estación ' || nombre end
  where id = p_operacion_id;

  select nombre into v_siguiente from orden_operaciones where orden_id = v_op.orden_id and estado = 'en_proceso';

  -- Última operación: se cierra la orden y se crea el lote
  if v_siguiente is null and not exists (select 1 from orden_operaciones where orden_id = v_op.orden_id and estado <> 'completada') then
    select * into v_orden from ordenes_produccion where id = v_op.orden_id;
    if p_cantidad_buena > 0 and v_orden.estado = 'en_proceso' then
      select coalesce(jsonb_agg(jsonb_build_object(
               'materia_prima_id', e.materia_prima_id,
               'cantidad_teorica', round(e.cantidad * v_orden.cantidad_planificada, 3),
               'cantidad_real', round(e.cantidad * v_orden.cantidad_planificada, 3))), '[]'::jsonb)
        into v_consumos
      from explosion_bom(v_orden.producto_id) e;
      begin
        perform completar_orden_produccion(v_orden.id, p_cantidad_buena, fecha_hoy_nicaragua(), v_consumos,
                                           'Cerrada automáticamente al terminar la ruta (IIoT)');
        v_cerrada := true;
        select codigo into v_lote from lotes where orden_id = v_orden.id;
      exception when others then
        -- Queda abierta para cerrarla a mano (por ejemplo, si falta materia prima)
        v_error := sqlerrm;
      end;
    end if;
  end if;

  return jsonb_build_object(
    'operacion', v_op.nombre,
    'siguiente', v_siguiente,
    'orden_cerrada', v_cerrada,
    'lote', v_lote,
    'error_cierre', v_error
  );
end;
$$;

revoke all on function public.operaciones_activas_iiot() from public, anon, authenticated;
revoke all on function public.terminar_operacion_iiot(bigint, integer, integer, numeric, numeric, text) from public, anon, authenticated;
-- La llave de servicio (endpoint IIoT) ejecuta estas funciones y las que llaman por dentro al cerrar la orden
grant execute on all functions in schema public to service_role;
grant select, insert, update on all tables in schema public to service_role;
