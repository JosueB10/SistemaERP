-- Integración IIoT: lecturas de sensores de las máquinas de planta.
-- Ejecutar después de 202610280003_lotes_calidad.sql. Es idempotente.
--
-- El emulador (iiot/emulador.py) envía lecturas por HTTP a POST /api/iiot/lecturas de Next.js.
-- Ese endpoint valida su clave (IIOT_API_KEY) y llama a registrar_lectura_iiot con la llave de servicio
-- de Supabase. La lectura se asocia al centro de trabajo y a la operación que está en proceso en ese
-- centro; si la temperatura sale del rango del centro queda como alarma.

create table if not exists public.lecturas_iiot (
  id bigint generated always as identity primary key,
  dispositivo varchar(50) not null,
  centro_trabajo_id bigint references public.centros_trabajo (id) on delete set null,
  orden_operacion_id bigint references public.orden_operaciones (id) on delete set null,
  temperatura numeric(6,1),
  presion numeric(6,2),
  humedad numeric(5,1),
  -- Piezas que la máquina contó desde la lectura anterior
  piezas integer not null default 0 check (piezas >= 0),
  estado varchar(15) not null default 'operando' check (estado in ('operando', 'inactivo', 'paro', 'alarma')),
  mensaje text,
  registrado_en timestamptz not null default now()
);

create index if not exists lecturas_iiot_fecha_idx on public.lecturas_iiot (registrado_en desc);
create index if not exists lecturas_iiot_centro_idx on public.lecturas_iiot (centro_trabajo_id, registrado_en desc);
create index if not exists lecturas_iiot_operacion_idx on public.lecturas_iiot (orden_operacion_id);

alter table public.lecturas_iiot enable row level security;

-- Desde la aplicación solo se consultan; las inserta el endpoint con la llave de servicio
drop policy if exists "iiot lecturas lectura autenticado" on public.lecturas_iiot;
create policy "iiot lecturas lectura autenticado" on public.lecturas_iiot
  for select to authenticated using (true);

revoke insert, update, delete on public.lecturas_iiot from anon, authenticated;
grant select on public.lecturas_iiot to authenticated;

create or replace function public.registrar_lectura_iiot(
  p_dispositivo text,
  p_centro_codigo text,
  p_temperatura numeric,
  p_presion numeric,
  p_humedad numeric,
  p_piezas integer,
  p_estado text,
  p_mensaje text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_centro centros_trabajo%rowtype;
  v_operacion_id bigint;
  v_orden_id bigint;
  v_estado text := coalesce(nullif(btrim(coalesce(p_estado, '')), ''), 'operando');
  v_mensaje text := nullif(btrim(coalesce(p_mensaje, '')), '');
  v_id bigint;
begin
  if btrim(coalesce(p_dispositivo, '')) = '' then
    raise exception 'Falta el identificador del dispositivo.';
  end if;
  if v_estado not in ('operando', 'inactivo', 'paro', 'alarma') then
    raise exception 'Estado no válido: %.', v_estado;
  end if;

  select * into v_centro from centros_trabajo where upper(codigo) = upper(btrim(coalesce(p_centro_codigo, '')));
  if not found then
    raise exception 'No existe el centro de trabajo %.', p_centro_codigo;
  end if;

  -- Operación que se está ejecutando en ese centro (la más reciente)
  select op.id, op.orden_id into v_operacion_id, v_orden_id
  from orden_operaciones op
  where op.centro_trabajo_id = v_centro.id and op.estado = 'en_proceso'
  order by op.inicio desc nulls last
  limit 1;

  if p_temperatura is not null and (
       (v_centro.temperatura_min is not null and p_temperatura < v_centro.temperatura_min)
    or (v_centro.temperatura_max is not null and p_temperatura > v_centro.temperatura_max)
  ) then
    v_estado := 'alarma';
    v_mensaje := coalesce(v_mensaje, format('Temperatura %s °C fuera del rango %s–%s °C',
      p_temperatura, coalesce(v_centro.temperatura_min::text, '—'), coalesce(v_centro.temperatura_max::text, '—')));
  end if;

  insert into lecturas_iiot (dispositivo, centro_trabajo_id, orden_operacion_id, temperatura, presion, humedad, piezas, estado, mensaje)
  values (btrim(p_dispositivo), v_centro.id, v_operacion_id, round(p_temperatura, 1), round(p_presion, 2), round(p_humedad, 1),
          greatest(coalesce(p_piezas, 0), 0), v_estado, v_mensaje)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'centro', v_centro.codigo,
    'estado', v_estado,
    'orden', case when v_orden_id is null then null else 'OP-' || lpad(v_orden_id::text, 5, '0') end,
    'operacion_id', v_operacion_id
  );
end;
$$;

-- Solo el endpoint (llave de servicio) registra lecturas
revoke all on function public.registrar_lectura_iiot(text, text, numeric, numeric, numeric, integer, text, text) from public, anon, authenticated;
grant execute on function public.registrar_lectura_iiot(text, text, numeric, numeric, numeric, integer, text, text) to service_role;
grant select on public.centros_trabajo, public.orden_operaciones to service_role;
grant insert, select on public.lecturas_iiot to service_role;
