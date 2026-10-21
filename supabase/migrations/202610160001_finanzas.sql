-- Módulo de Finanzas de Neumopad ERP.
-- Ejecutar en Supabase SQL Editor después de 202610150001_ventas_compras.sql. Es idempotente.
--
-- ingresos y gastos son el flujo de caja del negocio:
--   · Ventas (referencia_tipo 'venta') y compras ('compra') los registran sus propios módulos.
--   · La nómina pagada ('nomina') se registra sola con el trigger de este archivo.
--   · Los movimientos manuales (alquiler, servicios, otros ingresos...) no tienen referencia.

-- ---------- Ingresos ----------

alter table public.ingresos
  add column if not exists categoria varchar(100),
  add column if not exists metodo_pago varchar(50),
  add column if not exists observaciones text,
  add column if not exists updated_at timestamptz not null default now();

update public.ingresos set categoria = 'Ventas' where categoria is null and referencia_tipo = 'venta';
update public.ingresos set categoria = 'Otros ingresos' where categoria is null or btrim(categoria) = '';

alter table public.ingresos alter column categoria set default 'Otros ingresos';
alter table public.ingresos alter column categoria set not null;

alter table public.ingresos drop constraint if exists ingresos_monto_chk;
alter table public.ingresos add constraint ingresos_monto_chk check (monto > 0) not valid;

create index if not exists ingresos_fecha_idx on public.ingresos (fecha desc, id desc);
create index if not exists ingresos_referencia_idx on public.ingresos (referencia_tipo, referencia_id);

-- ---------- Gastos ----------

alter table public.gastos
  add column if not exists metodo_pago varchar(50),
  add column if not exists observaciones text,
  add column if not exists updated_at timestamptz not null default now();

update public.gastos set categoria = 'Otros gastos' where categoria is null or btrim(categoria) = '';

alter table public.gastos alter column categoria set default 'Otros gastos';
alter table public.gastos alter column categoria set not null;

alter table public.gastos drop constraint if exists gastos_monto_chk;
alter table public.gastos add constraint gastos_monto_chk check (monto > 0) not valid;

create index if not exists gastos_fecha_idx on public.gastos (fecha desc, id desc);
create index if not exists gastos_referencia_idx on public.gastos (referencia_tipo, referencia_id);

-- Las políticas de ingresos y gastos (solo autenticados) se crearon en 202610150001_ventas_compras.sql.

-- ---------- Datos del documento de origen ----------
-- registrar_venta y registrar_compra solo guardan concepto y monto; aquí se completa
-- la categoría y el método de pago a partir de la venta o compra que los generó.

create or replace function public.finanzas_completar_ingreso()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.referencia_tipo = 'venta' then
    new.categoria := 'Ventas';
    if new.metodo_pago is null then
      select metodo_pago into new.metodo_pago from ventas where id = new.referencia_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists finanzas_completar_ingreso on public.ingresos;
create trigger finanzas_completar_ingreso
  before insert on public.ingresos
  for each row execute function public.finanzas_completar_ingreso();

create or replace function public.finanzas_completar_gasto()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.referencia_tipo = 'compra' and new.metodo_pago is null then
    select metodo_pago into new.metodo_pago from compras where id = new.referencia_id;
  end if;
  return new;
end;
$$;

drop trigger if exists finanzas_completar_gasto on public.gastos;
create trigger finanzas_completar_gasto
  before insert on public.gastos
  for each row execute function public.finanzas_completar_gasto();

update public.ingresos i set metodo_pago = v.metodo_pago
from public.ventas v
where i.referencia_tipo = 'venta' and i.referencia_id = v.id and i.metodo_pago is null;

update public.gastos g set metodo_pago = c.metodo_pago
from public.compras c
where g.referencia_tipo = 'compra' and g.referencia_id = c.id and g.metodo_pago is null;

-- ---------- Nómina pagada → gasto ----------
-- El costo de la planilla para la empresa es lo devengado más los aportes patronales (INSS patronal + INATEC).

create or replace function public.finanzas_gasto_nomina()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from gastos where referencia_tipo = 'nomina' and referencia_id = old.id;
    return null;
  end if;

  if new.estado <> 'pagada' then
    delete from gastos where referencia_tipo = 'nomina' and referencia_id = new.id;
  elsif old.estado is distinct from 'pagada' and new.total_devengado + new.total_aportes_patronales > 0 then
    insert into gastos (concepto, categoria, monto, fecha, referencia_tipo, referencia_id, metodo_pago)
    values (
      'Planilla ' || new.periodicidad || ' ' || to_char(new.periodo_inicio, 'DD/MM/YYYY') || ' – ' || to_char(new.periodo_fin, 'DD/MM/YYYY'),
      'Nómina',
      new.total_devengado + new.total_aportes_patronales,
      coalesce(new.fecha_pago, current_date),
      'nomina',
      new.id,
      'transferencia'
    );
  end if;

  return null;
end;
$$;

drop trigger if exists finanzas_gasto_nomina on public.nominas;
create trigger finanzas_gasto_nomina
  after update or delete on public.nominas
  for each row execute function public.finanzas_gasto_nomina();

-- Planillas que ya estaban pagadas antes de esta migración
insert into public.gastos (concepto, categoria, monto, fecha, referencia_tipo, referencia_id, metodo_pago)
select
  'Planilla ' || n.periodicidad || ' ' || to_char(n.periodo_inicio, 'DD/MM/YYYY') || ' – ' || to_char(n.periodo_fin, 'DD/MM/YYYY'),
  'Nómina',
  n.total_devengado + n.total_aportes_patronales,
  coalesce(n.fecha_pago, n.periodo_fin),
  'nomina',
  n.id,
  'transferencia'
from public.nominas n
where n.estado = 'pagada'
  and n.total_devengado + n.total_aportes_patronales > 0
  and not exists (select 1 from public.gastos g where g.referencia_tipo = 'nomina' and g.referencia_id = n.id);
