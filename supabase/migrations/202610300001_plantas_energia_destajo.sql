-- Plantas, energía y huella de carbono, salario por destajo y análisis de los sensores IIoT.
-- Ejecutar después de 202610290001_avance_automatico_ruta.sql. Es idempotente.
--
-- · Plantas: cada centro de trabajo pertenece a una planta (para crecer a más de una nave/sede).
--   La planta guarda la potencia de su iluminación, la tarifa eléctrica y el factor de emisión de CO₂.
-- · Energía: cada máquina reporta su potencia (kW) y la energía que gastó desde la lectura anterior (kWh).
--   Las lámparas de la planta tienen su propio medidor (dispositivo LUCES-PL01, sin centro de trabajo).
--   Huella de carbono = kWh × factor de emisión de la planta.
-- · Cola de envío: el dispositivo puede mandar la hora en que tomó la lectura (registrado_en). Si estuvo
--   sin conexión, la reenvía después; recibido_en guarda cuándo llegó, y la diferencia es su espera en cola.
-- · Estado "preparacion": la máquina se está calentando; no es alarma aunque esté bajo el rango.
-- · Destajo: el empleado puede cobrar por pieza buena producida; la tarifa es por operación (centro).
-- · Datos de ejemplo: generar_historico_iiot(30) crea 30 días de lecturas para el análisis histórico.

-- ---------- Plantas ----------

create table if not exists public.plantas (
  id bigint generated always as identity primary key,
  codigo varchar(20) not null,
  nombre varchar(120) not null,
  ubicacion text,
  -- Potencia de las lámparas encendidas durante el turno
  iluminacion_kw numeric(8,2) not null default 0 check (iluminacion_kw >= 0),
  -- kg de CO₂ que emite la red eléctrica por cada kWh consumido (valor de referencia, ajustable)
  factor_emision_kg_kwh numeric(6,3) not null default 0.35 check (factor_emision_kg_kwh >= 0),
  -- Precio del kWh en córdobas
  tarifa_kwh numeric(8,2) not null default 0 check (tarifa_kwh >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists plantas_codigo_uidx on public.plantas (codigo);

insert into public.plantas (codigo, nombre, ubicacion, iluminacion_kw, factor_emision_kg_kwh, tarifa_kwh)
values ('PL-01', 'Planta Managua', 'Nave de producción principal', 1.6, 0.35, 8.00)
on conflict (codigo) do nothing;

alter table public.plantas enable row level security;
drop policy if exists "produccion plantas autenticado" on public.plantas;
create policy "produccion plantas autenticado" on public.plantas
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.plantas to authenticated;
grant select on public.plantas to service_role;

-- ---------- Centros de trabajo: planta, potencia y tarifa de destajo ----------

alter table public.centros_trabajo
  add column if not exists planta_id bigint references public.plantas (id) on delete set null,
  -- Potencia de la máquina trabajando y en espera (encendida sin producir)
  add column if not exists potencia_kw numeric(8,2) not null default 0 check (potencia_kw >= 0),
  add column if not exists potencia_espera_kw numeric(8,2) not null default 0 check (potencia_espera_kw >= 0),
  -- Córdobas por pieza buena para los empleados pagados por destajo
  add column if not exists tarifa_destajo numeric(10,2) not null default 0 check (tarifa_destajo >= 0);

create index if not exists centros_trabajo_planta_idx on public.centros_trabajo (planta_id);

update public.centros_trabajo
set planta_id = (select id from public.plantas where codigo = 'PL-01')
where planta_id is null;

-- Valores de referencia para los centros de NeumoPad (solo si aún no se configuraron)
update public.centros_trabajo c
set potencia_kw = v.potencia, potencia_espera_kw = v.espera, tarifa_destajo = case when c.tarifa_destajo = 0 then v.tarifa else c.tarifa_destajo end
from (values
  ('CT-01', 2.20, 0.10, 1.00),
  ('CT-02', 1.50, 0.10, 1.50),
  ('CT-03', 4.50, 0.80, 2.00),
  ('CT-04', 1.80, 0.15, 2.00),
  ('CT-05', 0.55, 0.05, 2.50),
  ('CT-06', 3.00, 0.50, 2.50),
  ('CT-07', 0.30, 0.05, 0.50),
  ('CT-08', 0.40, 0.05, 0.50)
) as v (codigo, potencia, espera, tarifa)
where c.codigo = v.codigo and c.potencia_kw = 0;

-- ---------- Empleados por destajo ----------

alter table public.empleados
  add column if not exists tipo_pago varchar(10) not null default 'fijo';

alter table public.empleados drop constraint if exists empleados_tipo_pago_chk;
alter table public.empleados add constraint empleados_tipo_pago_chk check (tipo_pago in ('fijo', 'destajo'));

-- En la planilla: piezas pagadas, monto por piezas, séptimo día y complemento al salario mínimo
alter table public.nomina_detalles
  add column if not exists tipo_pago varchar(10) not null default 'fijo',
  add column if not exists piezas integer not null default 0,
  add column if not exists monto_destajo numeric(12,2) not null default 0,
  add column if not exists septimo_dia numeric(12,2) not null default 0,
  add column if not exists ajuste_minimo numeric(12,2) not null default 0;

-- ---------- Lecturas: energía, planta, cola de envío ----------

alter table public.lecturas_iiot
  add column if not exists planta_id bigint references public.plantas (id) on delete set null,
  add column if not exists potencia_kw numeric(8,2),
  -- Energía consumida desde la lectura anterior del mismo dispositivo
  add column if not exists energia_kwh numeric(12,4) not null default 0 check (energia_kwh >= 0),
  -- 'planta' = enviada por un dispositivo; 'demo' = histórico de ejemplo generado en la base
  add column if not exists origen varchar(10) not null default 'planta',
  add column if not exists recibido_en timestamptz not null default now();

alter table public.lecturas_iiot drop constraint if exists lecturas_iiot_estado_check;
alter table public.lecturas_iiot drop constraint if exists lecturas_iiot_estado_chk;
alter table public.lecturas_iiot add constraint lecturas_iiot_estado_chk
  check (estado in ('operando', 'preparacion', 'inactivo', 'paro', 'alarma'));
alter table public.lecturas_iiot drop constraint if exists lecturas_iiot_origen_chk;
alter table public.lecturas_iiot add constraint lecturas_iiot_origen_chk check (origen in ('planta', 'demo'));

update public.lecturas_iiot l
set planta_id = c.planta_id
from public.centros_trabajo c
where l.centro_trabajo_id = c.id and l.planta_id is null;

create index if not exists lecturas_iiot_planta_idx on public.lecturas_iiot (planta_id, registrado_en desc);
create index if not exists lecturas_iiot_dispositivo_idx on public.lecturas_iiot (dispositivo, registrado_en desc);

-- ---------- Registro de lecturas ----------
-- p_centro_codigo puede ser un centro (CT-03) o una planta (PL-01, para el medidor de las lámparas).
-- p_registrado_en: hora en que el dispositivo tomó la lectura (si la tuvo en cola); por defecto, ahora.

drop function if exists public.registrar_lectura_iiot(text, text, numeric, numeric, numeric, integer, text, text);

create or replace function public.registrar_lectura_iiot(
  p_dispositivo text,
  p_centro_codigo text,
  p_temperatura numeric,
  p_presion numeric,
  p_humedad numeric,
  p_piezas integer,
  p_estado text,
  p_mensaje text,
  p_potencia_kw numeric default null,
  p_energia_kwh numeric default null,
  p_registrado_en timestamptz default null
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_centro centros_trabajo%rowtype;
  v_planta_id bigint;
  v_operacion_id bigint;
  v_orden_id bigint;
  v_estado text := coalesce(nullif(btrim(coalesce(p_estado, '')), ''), 'operando');
  v_mensaje text := nullif(btrim(coalesce(p_mensaje, '')), '');
  v_registrado timestamptz := coalesce(p_registrado_en, now());
  v_id bigint;
begin
  if btrim(coalesce(p_dispositivo, '')) = '' then
    raise exception 'Falta el identificador del dispositivo.';
  end if;
  if v_estado not in ('operando', 'preparacion', 'inactivo', 'paro', 'alarma') then
    raise exception 'Estado no válido: %.', v_estado;
  end if;
  if v_registrado > now() + interval '1 minute' then
    raise exception 'La hora de la lectura está en el futuro.';
  end if;
  if v_registrado < now() - interval '7 days' then
    raise exception 'La lectura tiene más de 7 días en cola; se descarta.';
  end if;

  select * into v_centro from centros_trabajo where upper(codigo) = upper(btrim(coalesce(p_centro_codigo, '')));
  if found then
    v_planta_id := v_centro.planta_id;
  else
    select id into v_planta_id from plantas where upper(codigo) = upper(btrim(coalesce(p_centro_codigo, '')));
    if not found then
      raise exception 'No existe el centro de trabajo ni la planta %.', p_centro_codigo;
    end if;
  end if;

  if v_centro.id is not null then
    -- Operación que se estaba ejecutando en ese centro cuando se tomó la lectura
    select op.id, op.orden_id into v_operacion_id, v_orden_id
    from orden_operaciones op
    where op.centro_trabajo_id = v_centro.id and op.estado = 'en_proceso' and op.inicio <= v_registrado
    order by op.inicio desc nulls last
    limit 1;

    -- Solo es alarma si la máquina está produciendo: calentando o en reposo puede estar bajo el rango
    if v_estado = 'operando' and p_temperatura is not null and (
         (v_centro.temperatura_min is not null and p_temperatura < v_centro.temperatura_min)
      or (v_centro.temperatura_max is not null and p_temperatura > v_centro.temperatura_max)
    ) then
      v_estado := 'alarma';
      v_mensaje := coalesce(v_mensaje, format('Temperatura %s °C fuera del rango %s–%s °C',
        p_temperatura, coalesce(v_centro.temperatura_min::text, '—'), coalesce(v_centro.temperatura_max::text, '—')));
    end if;
  end if;

  insert into lecturas_iiot (dispositivo, centro_trabajo_id, planta_id, orden_operacion_id, temperatura, presion, humedad,
                             piezas, estado, mensaje, potencia_kw, energia_kwh, registrado_en)
  values (btrim(p_dispositivo), v_centro.id, v_planta_id, v_operacion_id, round(p_temperatura, 1), round(p_presion, 2),
          round(p_humedad, 1), greatest(coalesce(p_piezas, 0), 0), v_estado, v_mensaje,
          case when p_potencia_kw is null then null else round(greatest(p_potencia_kw, 0), 2) end,
          round(greatest(coalesce(p_energia_kwh, 0), 0), 4), v_registrado)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'centro', coalesce(v_centro.codigo, upper(btrim(p_centro_codigo))),
    'estado', v_estado,
    'orden', case when v_orden_id is null then null else 'OP-' || lpad(v_orden_id::text, 5, '0') end,
    'operacion_id', v_operacion_id
  );
end;
$$;

revoke all on function public.registrar_lectura_iiot(text, text, numeric, numeric, numeric, integer, text, text, numeric, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_lectura_iiot(text, text, numeric, numeric, numeric, integer, text, text, numeric, numeric, timestamptz) to service_role;

-- ---------- Resumen diario por dispositivo (análisis histórico y energía) ----------

create or replace function public.resumen_iiot_diario(p_desde date, p_hasta date)
returns table (
  dia date,
  dispositivo text,
  centro_trabajo_id bigint,
  planta_id bigint,
  lecturas bigint,
  operando bigint,
  temp_prom numeric,
  temp_min numeric,
  temp_max numeric,
  alarmas bigint,
  paros bigint,
  piezas bigint,
  energia_kwh numeric,
  potencia_max numeric,
  espera_prom_s numeric,
  espera_max_s numeric
)
language sql stable security invoker set search_path = public as $$
  select (l.registrado_en at time zone 'America/Managua')::date,
         l.dispositivo::text,
         max(l.centro_trabajo_id),
         max(l.planta_id),
         count(*),
         count(*) filter (where l.estado in ('operando', 'alarma')),
         -- La temperatura de trabajo: sin calentamiento ni reposo
         round(avg(l.temperatura) filter (where l.estado in ('operando', 'alarma')), 1),
         min(l.temperatura) filter (where l.estado in ('operando', 'alarma')),
         max(l.temperatura) filter (where l.estado in ('operando', 'alarma')),
         count(*) filter (where l.estado = 'alarma'),
         count(*) filter (where l.estado = 'paro'),
         coalesce(sum(l.piezas), 0),
         round(coalesce(sum(l.energia_kwh), 0), 3),
         max(l.potencia_kw),
         round(avg(extract(epoch from (l.recibido_en - l.registrado_en)))::numeric, 1),
         round(max(extract(epoch from (l.recibido_en - l.registrado_en)))::numeric, 1)
  from lecturas_iiot l
  where l.registrado_en >= (p_desde::timestamp at time zone 'America/Managua')
    and l.registrado_en < ((p_hasta + 1)::timestamp at time zone 'America/Managua')
  group by 1, 2
  order by 1, 2
$$;

revoke all on function public.resumen_iiot_diario(date, date) from public, anon;
grant execute on function public.resumen_iiot_diario(date, date) to authenticated;

-- ---------- Datos históricos de ejemplo ----------
-- Simula p_dias días hábiles (sin domingos ni el día de hoy) de un turno de 07:00 a 15:00 con una lectura
-- cada 10 minutos por máquina y por planta (lámparas). Del día 8 al 10 hacia atrás la prensa térmica trabajó
-- más caliente de lo normal (resistor descalibrado), para que el análisis muestre fechas con alarmas.
-- Reemplaza el histórico de ejemplo anterior; nunca toca las lecturas reales (origen = 'planta').

create or replace function public.generar_historico_iiot(p_dias integer default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dias integer := least(greatest(coalesce(p_dias, 30), 1), 90);
  v_total bigint;
begin
  if auth.uid() is null then
    raise exception 'Inicie sesión para generar datos de ejemplo.';
  end if;

  delete from lecturas_iiot where origen = 'demo';

  with dias as (
    select d, fecha_hoy_nicaragua() - d as fecha
    from generate_series(1, v_dias) d
    where extract(isodow from fecha_hoy_nicaragua() - d) <> 7
  ),
  equipos as (
    select c.id, c.codigo, c.planta_id, c.temperatura_min, c.temperatura_max, c.capacidad_hora, c.potencia_kw,
           c.potencia_espera_kw, coalesce(m.dispositivo, c.codigo || '-SIM') as dispositivo, m.presion, m.humedad
    from centros_trabajo c
    left join (values
      ('CT-01', 'LAVADORA-01', null::numeric, 65::numeric),
      ('CT-02', 'CORTE-01', null, null),
      ('CT-03', 'PRENSA-01', 5.0, null),
      ('CT-04', 'LAMINADO-01', 2.5, null),
      ('CT-05', 'OVERLOCK-01', null, null),
      ('CT-06', 'SUBLI-01', 3.0, null),
      ('CT-07', 'INSPECCION-01', null, null),
      ('CT-08', 'EMPAQUE-01', null, null)
    ) as m (codigo, dispositivo, presion, humedad) on m.codigo = c.codigo
    where c.activo
  ),
  base as (
    select e.*, dd.d, i.i,
           ((dd.fecha + time '07:00') + i.i * interval '10 minutes') at time zone 'America/Managua' as momento,
           random()::numeric as r1, random()::numeric as r2, random()::numeric as r3, random()::numeric as r4,
           case when e.temperatura_min is null or e.temperatura_max is null then null
                else (e.temperatura_min + e.temperatura_max) / 2
                     + case when e.codigo = 'CT-03' and dd.d between 8 and 10 then 13 else 0 end
           end as objetivo
    from equipos e
    cross join dias dd
    cross join generate_series(0, 47) as i (i)
  ),
  calculo as (
    select b.*,
           b.i < 3 as calentando,
           b.i >= 3 and b.r4 < 0.03 as en_paro,
           case
             when b.objetivo is null then null
             when b.i < 3 then round(30 + (b.objetivo - 30) * (b.i + 1) / 4.0 + (b.r3 - 0.5) * 3, 1)
             else round(b.objetivo + (b.r3 - 0.5) * 5
                        + case when b.r1 < 0.03 then (case when b.r2 < 0.5 then -1 else 1 end) * (18 + b.r2 * 10) else 0 end, 1)
           end as temperatura
    from base b
  ),
  final as (
    select c.*,
           case
             when c.en_paro then 'paro'
             when c.calentando and c.objetivo is not null then 'preparacion'
             when c.temperatura is not null and (c.temperatura < c.temperatura_min or c.temperatura > c.temperatura_max) then 'alarma'
             else 'operando'
           end as estado,
           round(case
             when c.en_paro then c.potencia_espera_kw
             when c.calentando and c.objetivo is not null then c.potencia_kw * 1.15
             else c.potencia_kw * (0.85 + c.r2 * 0.2)
           end, 2) as potencia
    from calculo c
  )
  insert into lecturas_iiot (dispositivo, centro_trabajo_id, planta_id, temperatura, presion, humedad, piezas, estado,
                             mensaje, potencia_kw, energia_kwh, origen, registrado_en, recibido_en)
  select f.dispositivo, f.id, f.planta_id, f.temperatura,
         case when f.presion is null then null when f.estado = 'paro' then 0.2 else round(f.presion + (f.r2 - 0.5) * 0.3, 2) end,
         case when f.humedad is null then null else round(f.humedad + (f.r3 - 0.5) * 6, 1) end,
         case when f.estado in ('operando', 'alarma') then floor(f.capacidad_hora / 6 * (0.75 + f.r2 * 0.25))::integer else 0 end,
         f.estado,
         case
           when f.estado = 'paro' then (array['Atasco de material', 'Ajuste de máquina', 'Cambio de rollo de tela', 'Falta de operario'])[1 + floor(f.r1 * 4)::integer]
           when f.estado = 'preparacion' then 'Calentando'
           when f.estado = 'alarma' then format('Temperatura %s °C fuera del rango %s–%s °C', f.temperatura, f.temperatura_min, f.temperatura_max)
         end,
         f.potencia, round(f.potencia * 10 / 60.0, 4), 'demo', f.momento, f.momento
  from final f;

  -- Medidor de la iluminación de cada planta
  insert into lecturas_iiot (dispositivo, planta_id, piezas, estado, potencia_kw, energia_kwh, origen, registrado_en, recibido_en)
  select 'LUCES-' || replace(p.codigo, '-', ''), p.id, 0, 'operando', p.iluminacion_kw, round(p.iluminacion_kw * 10 / 60.0, 4), 'demo',
         ((fecha_hoy_nicaragua() - d) + time '07:00' + i * interval '10 minutes') at time zone 'America/Managua',
         ((fecha_hoy_nicaragua() - d) + time '07:00' + i * interval '10 minutes') at time zone 'America/Managua'
  from plantas p
  cross join generate_series(1, v_dias) d
  cross join generate_series(0, 47) i
  where p.activo and p.iluminacion_kw > 0 and extract(isodow from fecha_hoy_nicaragua() - d) <> 7;

  select count(*) into v_total from lecturas_iiot where origen = 'demo';
  return jsonb_build_object('lecturas', v_total, 'dias', v_dias);
end;
$$;

create or replace function public.borrar_historico_iiot()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_total integer;
begin
  if auth.uid() is null then
    raise exception 'Inicie sesión para borrar los datos de ejemplo.';
  end if;
  delete from lecturas_iiot where origen = 'demo';
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.generar_historico_iiot(integer) from public, anon;
revoke all on function public.borrar_historico_iiot() from public, anon;
grant execute on function public.generar_historico_iiot(integer) to authenticated;
grant execute on function public.borrar_historico_iiot() to authenticated;

-- El endpoint IIoT (llave de servicio) lee y escribe las columnas nuevas
grant select, insert, update on all tables in schema public to service_role;
