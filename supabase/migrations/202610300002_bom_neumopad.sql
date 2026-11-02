-- BOM de dos niveles de NeumoPad. Ejecutar después de 202610300001_plantas_energia_destajo.sql. Es idempotente.
--
-- NIVEL 0  Mousepad NeumoPad (estándar y personalizado)
-- NIVEL 1  SE-01 Base laminada          → NIVEL 2: caucho de llanta reciclada, tela de poliéster, adhesivo industrial
-- NIVEL 1  SE-02 Acabado de bordes      → NIVEL 2: cinta para bordes, hilo de poliéster
-- NIVEL 1  SE-03 Empaque final          → NIVEL 2: caja de cartón, etiqueta, bolsa protectora
-- NIVEL 1  SE-04 Superficie personalizada (solo el mousepad personalizado)
--                                       → NIVEL 2: tela sublimable, tinta de sublimación, papel de sublimación
--
-- · La materia prima que ya existía se renombra para que coincida con la estructura (mismo código, stock y costo).
-- · Se crean las que faltaban (MP-008 a MP-011) con un inventario inicial registrado en el kardex.
-- · Las recetas activas pasan a tener los subensambles (nueva versión de la receta). Las cantidades por unidad
--   son las que ya usaba la receta; las nuevas son de referencia y se ajustan en Producción → Subensambles.

do $$
declare
  v_mp record;
  v_id bigint;
  v_se record;
  v_producto record;
  v_detalles jsonb;
begin
  -- ---------- Materia prima existente: nombres de la estructura ----------
  update materias_primas m
  set nombre = v.nombre
  from (values
    ('MP-001', 'Caucho de llanta reciclada'),
    ('MP-002', 'Cinta para bordes'),
    ('MP-003', 'Caja de cartón'),
    ('MP-004', 'Tela de poliéster'),
    ('MP-005', 'Adhesivo industrial'),
    ('MP-006', 'Tinta de sublimación'),
    ('MP-007', 'Papel de sublimación')
  ) as v (codigo, nombre)
  where m.codigo = v.codigo and m.nombre is distinct from v.nombre;

  -- ---------- Materia prima nueva ----------
  for v_mp in
    select * from (values
      ('MP-008', 'Hilo de poliéster', 'BORDES', 'm', 500::numeric, 50::numeric, 0.10::numeric),
      ('MP-009', 'Etiqueta', 'EMPAQUE', 'und', 200, 20, 1.50),
      ('MP-010', 'Bolsa protectora', 'EMPAQUE', 'und', 200, 20, 2.00),
      ('MP-011', 'Tela sublimable', 'PERSONALIZADO', 'm2', 20, 2, 12.00)
    ) as t (codigo, nombre, categoria, unidad, stock, minimo, costo)
  loop
    if not exists (select 1 from materias_primas where codigo = v_mp.codigo) then
      insert into materias_primas (codigo, nombre, categoria, unidad_medida_id, stock_actual, stock_minimo, costo_unitario, activo)
      values (v_mp.codigo, v_mp.nombre, v_mp.categoria,
              (select id from unidades_medida where abreviatura = v_mp.unidad limit 1),
              v_mp.stock, v_mp.minimo, v_mp.costo, true)
      returning id into v_id;
      insert into movimientos_inventario (tipo, materia_prima_id, cantidad, referencia_tipo, fecha, motivo, stock_anterior, stock_resultante, observaciones)
      values ('entrada', v_id, v_mp.stock, 'Inventario inicial', fecha_hoy_nicaragua(), 'Inventario inicial', 0, v_mp.stock,
              'Materia prima creada para la BOM de dos niveles');
    end if;
  end loop;

  -- ---------- Subensambles (nivel 1) y su materia prima (nivel 2) ----------
  for v_se in
    select * from (values
      ('SE-01', 'Base laminada', 'Caucho de llanta, tela de poliéster y adhesivo prensados en una sola pieza.',
       '[["MP-001", 0.350], ["MP-004", 0.400], ["MP-005", 1.000]]'::jsonb),
      ('SE-02', 'Acabado de bordes', 'Cinta y costura overlock del contorno.',
       '[["MP-002", 4.000], ["MP-008", 2.500]]'::jsonb),
      ('SE-03', 'Empaque final', 'Caja, etiqueta con el lote y bolsa protectora.',
       '[["MP-003", 1.000], ["MP-009", 1.000], ["MP-010", 1.000]]'::jsonb),
      ('SE-04', 'Superficie personalizada', 'Solo para el mousepad personalizado: diseño sublimado sobre tela.',
       '[["MP-011", 0.400], ["MP-006", 0.600], ["MP-007", 1.000]]'::jsonb)
    ) as t (codigo, nombre, descripcion, materiales)
  loop
    select coalesce(jsonb_agg(jsonb_build_object('materia_prima_id', m.id, 'cantidad', (x.valor->>1)::numeric)), '[]'::jsonb)
      into v_detalles
    from jsonb_array_elements(v_se.materiales) as x (valor)
    join materias_primas m on m.codigo = x.valor->>0;

    perform guardar_subensamble((select id from subensambles where codigo = v_se.codigo), v_se.codigo, v_se.nombre,
                                v_se.descripcion, v_detalles);
    update subensambles set activo = true where codigo = v_se.codigo;
  end loop;

  -- ---------- Recetas (nivel 0): solo subensambles ----------
  for v_producto in select id, nombre, coalesce(es_personalizable, false) as personalizado from productos where activo
  loop
    select jsonb_agg(jsonb_build_object('subensamble_id', s.id, 'cantidad', 1) order by s.codigo)
      into v_detalles
    from subensambles s
    where s.codigo in ('SE-01', 'SE-02', 'SE-03') or (v_producto.personalizado and s.codigo = 'SE-04');

    -- Solo si la receta activa todavía no tiene exactamente esos subensambles (no crea versiones de más)
    if not exists (
      select 1 from recetas r
      where r.producto_id = v_producto.id and r.activo
        and (select count(*) from receta_detalle d where d.receta_id = r.id) = jsonb_array_length(v_detalles)
        and not exists (
          select 1 from jsonb_array_elements(v_detalles) x
          where not exists (select 1 from receta_detalle d where d.receta_id = r.id and d.subensamble_id = (x->>'subensamble_id')::bigint)
        )
    ) then
      perform guardar_receta(v_producto.id, 'Receta ' || v_producto.nombre,
                             'BOM de dos niveles: base laminada, acabado de bordes, empaque' ||
                             case when v_producto.personalizado then ' y superficie personalizada.' else '.' end,
                             v_detalles);
    end if;
  end loop;
end;
$$;
