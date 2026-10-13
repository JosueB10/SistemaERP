
do $$
declare
  columna record;
begin
  
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'empleados' and column_name = 'nombre'
  ) then
  
    update public.empleados
    set nombres = coalesce(nullif(btrim(nombres), ''), nombre)
    where coalesce(btrim(nombres), '') = '' and nombre is not null;

    create or replace function public.empleados_sincronizar_nombre()
    returns trigger language plpgsql as $f$
    begin
      new.nombre := btrim(coalesce(new.nombres, '') || ' ' || coalesce(new.apellidos, ''));
      return new;
    end;
    $f$;

    drop trigger if exists empleados_sincronizar_nombre on public.empleados;
    create trigger empleados_sincronizar_nombre
      before insert or update on public.empleados
      for each row execute function public.empleados_sincronizar_nombre();
  end if;

  
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'empleados'
      and is_nullable = 'NO' and column_default is null and is_identity = 'NO'
      and column_name not in ('id', 'nombre', 'codigo', 'nombres', 'apellidos', 'cargo', 'fecha_ingreso')
  loop
    execute format('alter table public.empleados alter column %I drop not null', columna.column_name);
    raise notice 'Columna % ya no es obligatoria', columna.column_name;
  end loop;
end $$;
