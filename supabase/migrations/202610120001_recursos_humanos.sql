

-- ---------- Empleados ----------

create table if not exists public.empleados (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

alter table public.empleados
  add column if not exists codigo varchar(20),
  add column if not exists nombres varchar(100),
  add column if not exists apellidos varchar(100),
  add column if not exists cedula varchar(20),
  add column if not exists numero_inss varchar(20),
  add column if not exists cargo varchar(100),
  add column if not exists area varchar(100),
  add column if not exists telefono varchar(30),
  add column if not exists correo varchar(150),
  add column if not exists direccion varchar(250),
  add column if not exists fecha_ingreso date,
  add column if not exists fecha_baja date,
  add column if not exists tipo_contrato varchar(20) not null default 'indefinido',
  add column if not exists salario_mensual numeric(12,2) not null default 0,
  add column if not exists estado varchar(20) not null default 'activo',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();


update public.empleados set codigo = 'EMP-' || lpad(id::text, 3, '0') where codigo is null or btrim(codigo) = '';
update public.empleados set nombres = coalesce(nombres, ''), apellidos = coalesce(apellidos, ''),
  cargo = coalesce(cargo, 'Sin cargo'), fecha_ingreso = coalesce(fecha_ingreso, created_at::date)
where nombres is null or apellidos is null or cargo is null or fecha_ingreso is null;

alter table public.empleados
  alter column codigo set not null,
  alter column nombres set not null,
  alter column apellidos set not null,
  alter column cargo set not null,
  alter column fecha_ingreso set not null;

alter table public.empleados drop constraint if exists empleados_tipo_contrato_chk;
alter table public.empleados add constraint empleados_tipo_contrato_chk
  check (tipo_contrato in ('indefinido', 'determinado', 'temporal'));
alter table public.empleados drop constraint if exists empleados_estado_chk;
alter table public.empleados add constraint empleados_estado_chk
  check (estado in ('activo', 'vacaciones', 'suspendido', 'inactivo'));
alter table public.empleados drop constraint if exists empleados_salario_chk;
alter table public.empleados add constraint empleados_salario_chk check (salario_mensual >= 0);

create unique index if not exists empleados_codigo_uidx on public.empleados (codigo);
create unique index if not exists empleados_cedula_uidx on public.empleados (cedula) where cedula is not null;

-- ---------- Asistencia ----------

create table if not exists public.asistencias (
  id bigint generated always as identity primary key,
  empleado_id bigint not null references public.empleados (id) on delete cascade,
  fecha date not null,
  estado varchar(20) not null default 'presente',
  horas_extra numeric(5,2) not null default 0,
  observaciones varchar(250),
  created_at timestamptz not null default now(),
  constraint asistencias_estado_chk
    check (estado in ('presente', 'tardanza', 'ausente', 'permiso', 'vacaciones', 'subsidio')),
  constraint asistencias_horas_chk check (horas_extra >= 0 and horas_extra <= 24)
);

create unique index if not exists asistencias_empleado_fecha_uidx
  on public.asistencias (empleado_id, fecha);
create index if not exists asistencias_fecha_idx on public.asistencias (fecha desc);

-- ---------- Nómina (planillas) ----------

create table if not exists public.nominas (
  id bigint generated always as identity primary key,
  periodicidad varchar(20) not null,
  periodo_inicio date not null,
  periodo_fin date not null,
  estado varchar(20) not null default 'borrador',
  fecha_pago date,
  total_devengado numeric(14,2) not null default 0,
  total_deducciones numeric(14,2) not null default 0,
  total_neto numeric(14,2) not null default 0,
  total_aportes_patronales numeric(14,2) not null default 0,
  observaciones varchar(250),
  created_at timestamptz not null default now(),
  constraint nominas_periodicidad_chk check (periodicidad in ('quincenal', 'mensual')),
  constraint nominas_estado_chk check (estado in ('borrador', 'pagada')),
  constraint nominas_periodo_chk check (periodo_fin >= periodo_inicio)
);

create index if not exists nominas_periodo_idx on public.nominas (periodo_inicio desc);

create table if not exists public.nomina_detalles (
  id bigint generated always as identity primary key,
  nomina_id bigint not null references public.nominas (id) on delete cascade,
  empleado_id bigint not null references public.empleados (id),
  salario_base numeric(12,2) not null default 0,
  dias_ausencia numeric(5,2) not null default 0,
  descuento_ausencias numeric(12,2) not null default 0,
  horas_extra numeric(6,2) not null default 0,
  monto_horas_extra numeric(12,2) not null default 0,
  bonificaciones numeric(12,2) not null default 0,
  total_devengado numeric(12,2) not null default 0,
  inss_laboral numeric(12,2) not null default 0,
  ir numeric(12,2) not null default 0,
  otras_deducciones numeric(12,2) not null default 0,
  total_deducciones numeric(12,2) not null default 0,
  neto_pagar numeric(12,2) not null default 0,
  inss_patronal numeric(12,2) not null default 0,
  inatec numeric(12,2) not null default 0
);

create unique index if not exists nomina_detalles_nomina_empleado_uidx
  on public.nomina_detalles (nomina_id, empleado_id);

-- ---------- Seguridad: solo usuarios autenticados ----------

alter table public.empleados enable row level security;
alter table public.asistencias enable row level security;
alter table public.nominas enable row level security;
alter table public.nomina_detalles enable row level security;

drop policy if exists "rrhh empleados autenticado" on public.empleados;
create policy "rrhh empleados autenticado" on public.empleados
  for all to authenticated using (true) with check (true);

drop policy if exists "rrhh asistencias autenticado" on public.asistencias;
create policy "rrhh asistencias autenticado" on public.asistencias
  for all to authenticated using (true) with check (true);

drop policy if exists "rrhh nominas autenticado" on public.nominas;
create policy "rrhh nominas autenticado" on public.nominas
  for all to authenticated using (true) with check (true);

drop policy if exists "rrhh nomina detalles autenticado" on public.nomina_detalles;
create policy "rrhh nomina detalles autenticado" on public.nomina_detalles
  for all to authenticated using (true) with check (true);
