-- Validación de materia prima en órdenes de producción y estado de lectura de notificaciones.
-- Idempotente: se puede ejecutar más de una vez en el SQL Editor de Supabase.

-- ---------- Órdenes de producción: no se crean sin materia prima ----------
-- La materia prima disponible para una orden es el stock actual menos lo que ya reservaron
-- las demás órdenes abiertas (pendientes o en proceso) según la receta activa de su producto.

create or replace function public.validar_materia_orden_produccion()
returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  v_linea record;
  v_receta_id bigint;
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

  select id into v_receta_id from recetas where producto_id = new.producto_id and activo;
  if v_receta_id is null then
    return new;
  end if;

  for v_linea in
    select rd.materia_prima_id, rd.cantidad, mp.nombre, mp.stock_actual
    from receta_detalle rd
    join materias_primas mp on mp.id = rd.materia_prima_id
    where rd.receta_id = v_receta_id
    for update of mp
  loop
    select coalesce(sum(round(d.cantidad * o.cantidad_planificada, 3)), 0) into v_comprometido
    from ordenes_produccion o
    join recetas r on r.producto_id = o.producto_id and r.activo
    join receta_detalle d on d.receta_id = r.id and d.materia_prima_id = v_linea.materia_prima_id
    where o.estado in ('pendiente', 'en_proceso')
      and o.id is distinct from new.id;

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

drop trigger if exists ordenes_produccion_validar_materia on public.ordenes_produccion;
create trigger ordenes_produccion_validar_materia
  before insert or update on public.ordenes_produccion
  for each row execute function public.validar_materia_orden_produccion();

-- ---------- Notificaciones leídas por usuario ----------
-- Las notificaciones se calculan a partir de ventas, compras, producción, inventario y finanzas;
-- aquí solo se guarda cuáles ya leyó cada usuario.

create table if not exists public.notificaciones_leidas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null,
  leida_en timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.notificaciones_leidas enable row level security;

drop policy if exists "notificaciones leidas propias" on public.notificaciones_leidas;
create policy "notificaciones leidas propias" on public.notificaciones_leidas
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.notificaciones_leidas from anon;
grant select, insert, update, delete on public.notificaciones_leidas to authenticated;
