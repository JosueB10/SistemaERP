-- Inicio automático de órdenes de producción. Ejecutar después de 202610280006_datos_rutas_neumopad.sql.
-- Es idempotente.
--
-- Cada encargado trabaja una orden a la vez:
-- · Al crear una orden, se inicia sola si su encargado no tiene otra orden en proceso
--   (las órdenes "sin asignar" cuentan como un mismo encargado).
-- · Si el encargado está ocupado, la orden queda pendiente (en cola).
-- · Cuando el encargado cierra o cancela su orden, se inicia sola su siguiente orden en cola
--   (la de fecha programada más próxima). Si a esa orden no le alcanza la materia prima, se salta.
-- El botón "Iniciar" sigue disponible para adelantar una orden manualmente.

create or replace function public.encargado_ocupado(p_empleado_id bigint, p_excluir_orden bigint default null)
returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from ordenes_produccion
    where estado = 'en_proceso'
      and empleado_id is not distinct from p_empleado_id
      and id is distinct from p_excluir_orden
  )
$$;

-- Al crear (o al pasar una orden en cola a otro encargado): si el encargado está libre, entra "en proceso"
create or replace function public.ordenes_produccion_auto_iniciar()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (old.estado <> 'pendiente' or new.empleado_id is not distinct from old.empleado_id) then
    return new;
  end if;
  if new.estado = 'pendiente' and not encargado_ocupado(new.empleado_id, new.id) then
    new.estado := 'en_proceso';
    new.fecha_inicio := coalesce(new.fecha_inicio, fecha_hoy_nicaragua());
  end if;
  return new;
end;
$$;

-- "auto_iniciar" va antes que "validar_..." en orden alfabético (así corren los triggers BEFORE),
-- de modo que la validación de materia prima revisa la orden ya iniciada
drop trigger if exists ordenes_produccion_auto_iniciar on public.ordenes_produccion;
create trigger ordenes_produccion_auto_iniciar
  before insert or update of empleado_id on public.ordenes_produccion
  for each row execute function public.ordenes_produccion_auto_iniciar();

-- Al cerrar o cancelar: se inicia la siguiente orden en cola del mismo encargado
create or replace function public.iniciar_siguiente_orden(p_empleado_id bigint)
returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_id bigint;
begin
  if encargado_ocupado(p_empleado_id) then
    return null;
  end if;
  for v_id in
    select id from ordenes_produccion
    where estado = 'pendiente' and empleado_id is not distinct from p_empleado_id
    order by fecha_programada nulls last, id
  loop
    begin
      update ordenes_produccion
      set estado = 'en_proceso', fecha_inicio = fecha_hoy_nicaragua(), updated_at = now()
      where id = v_id and estado = 'pendiente';
      return v_id;
    exception when others then
      -- No alcanza la materia prima para esta orden: se prueba con la siguiente
      null;
    end;
  end loop;
  return null;
end;
$$;

create or replace function public.ordenes_produccion_iniciar_siguiente()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if old.estado = 'en_proceso' and new.estado in ('completada', 'cancelada') then
    perform iniciar_siguiente_orden(new.empleado_id);
  end if;
  return new;
end;
$$;

drop trigger if exists ordenes_produccion_iniciar_siguiente on public.ordenes_produccion;
create trigger ordenes_produccion_iniciar_siguiente
  after update on public.ordenes_produccion
  for each row execute function public.ordenes_produccion_iniciar_siguiente();

revoke all on function public.encargado_ocupado(bigint, bigint) from public, anon;
revoke all on function public.iniciar_siguiente_orden(bigint) from public, anon;
grant execute on function public.encargado_ocupado(bigint, bigint) to authenticated;
grant execute on function public.iniciar_siguiente_orden(bigint) to authenticated;

-- Órdenes que ya estaban en cola: se inicia la primera de cada encargado libre
select public.iniciar_siguiente_orden(e.empleado_id)
from (select distinct empleado_id from public.ordenes_produccion where estado = 'pendiente') e;
