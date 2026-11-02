-- Datos iniciales: centros de trabajo y rutas de fabricación de NeumoPad.
-- Ejecutar después de 202610280005_recepcion_despacho.sql. Es idempotente: no toca centros que ya
-- existen (por código) ni productos que ya tienen ruta. Los tiempos son estándar de referencia;
-- ajústelos en Producción → Centros de trabajo y Producción → Rutas.
--
-- Proceso estándar (mousepad liso):
--   1 Limpieza del caucho de llanta → 2 Corte → 3 Planchado en prensa térmica → 4 Adhesivo y tela
--   → 5 Prensado y curado → 6 Acabado de bordes → 7 Inspección → 8 Empaque
-- Proceso personalizado: después del curado se agrega
--   Colocación del papel de impresión → Estampado del diseño en la plancha de sublimación

insert into public.centros_trabajo (codigo, nombre, descripcion, capacidad_hora, horas_turno, costo_hora, temperatura_min, temperatura_max)
values
  ('CT-01', 'Lavado y secado', 'Limpieza del caucho de llanta reciclado: lavado, desengrase y secado.', 40, 8, 55, null, null),
  ('CT-02', 'Corte', 'Corte del caucho a la medida del mousepad (cuchilla / troquel).', 30, 8, 60, null, null),
  ('CT-03', 'Prensa térmica', 'Planchado en caliente para dejar el caucho recto y uniforme.', 20, 8, 75, 150, 180),
  ('CT-04', 'Laminado', 'Aplicación de adhesivo, colocación de la tela y prensado/curado.', 24, 8, 60, null, null),
  ('CT-05', 'Bordes', 'Refilado y costura overlock / sellado de bordes.', 20, 8, 65, null, null),
  ('CT-06', 'Sublimación', 'Papel de impresión y plancha de sublimación para el diseño personalizado.', 40, 8, 80, 190, 205),
  ('CT-07', 'Control de calidad', 'Inspección final: medidas, planitud, adhesión, bordes y diseño.', 120, 8, 55, null, null),
  ('CT-08', 'Empaque', 'Empaque, etiquetado y preparación para despacho.', 60, 8, 50, null, null)
on conflict (codigo) do nothing;

-- Pasos en orden por tipo de producto
with pasos (personalizado, secuencia, nombre, centro, preparacion, estandar, instrucciones) as (
  values
    (false, 1, 'Limpieza del caucho de llanta', 'CT-01', 5, 1.5, 'Lavar y desengrasar la llanta; secar antes de cortar.'),
    (false, 2, 'Corte del caucho a medida', 'CT-02', 10, 2.0, 'Cortar a la medida del modelo; descartar zonas con alambre o grietas.'),
    (false, 3, 'Planchado en prensa térmica', 'CT-03', 15, 3.0, 'Prensar en caliente (150–180 °C) hasta que la pieza quede recta.'),
    (false, 4, 'Aplicación de adhesivo y tela', 'CT-04', 5, 2.5, 'Aplicar adhesivo uniforme y colocar la tela sin arrugas ni burbujas.'),
    (false, 5, 'Prensado y curado del adhesivo', 'CT-04', 0, 1.0, 'Prensar en frío y dejar curar según la ficha del adhesivo.'),
    (false, 6, 'Acabado de bordes', 'CT-05', 5, 3.0, 'Refilar excedentes y coser/sellar el contorno.'),
    (false, 7, 'Inspección de calidad', 'CT-07', 0, 0.5, 'Verificar medidas, planitud, adhesión y bordes.'),
    (false, 8, 'Empaque y etiquetado', 'CT-08', 5, 1.0, 'Empacar y etiquetar con el código de lote.'),
    (true, 1, 'Limpieza del caucho de llanta', 'CT-01', 5, 1.5, 'Lavar y desengrasar la llanta; secar antes de cortar.'),
    (true, 2, 'Corte del caucho a medida', 'CT-02', 10, 2.0, 'Cortar a la medida del modelo; descartar zonas con alambre o grietas.'),
    (true, 3, 'Planchado en prensa térmica', 'CT-03', 15, 3.0, 'Prensar en caliente (150–180 °C) hasta que la pieza quede recta.'),
    (true, 4, 'Aplicación de adhesivo y tela', 'CT-04', 5, 2.5, 'Usar tela de poliéster blanca apta para sublimación.'),
    (true, 5, 'Prensado y curado del adhesivo', 'CT-04', 0, 1.0, 'Prensar en frío y dejar curar según la ficha del adhesivo.'),
    (true, 6, 'Colocación del papel de impresión', 'CT-06', 5, 1.0, 'Fijar el papel de sublimación impreso con el diseño del cliente, alineado y con cinta térmica.'),
    (true, 7, 'Estampado del diseño en plancha de sublimación', 'CT-06', 15, 1.5, 'Planchar a 190–205 °C durante 45–60 s; retirar el papel en caliente.'),
    (true, 8, 'Acabado de bordes', 'CT-05', 5, 3.0, 'Refilar excedentes y coser/sellar el contorno.'),
    (true, 9, 'Inspección de calidad', 'CT-07', 0, 0.5, 'Verificar medidas, planitud, adhesión, bordes y nitidez/alineación del diseño.'),
    (true, 10, 'Empaque y etiquetado', 'CT-08', 5, 1.0, 'Empacar y etiquetar con el código de lote y el nombre del cliente.')
)
insert into public.ruta_operaciones (producto_id, secuencia, nombre, centro_trabajo_id, tiempo_preparacion_min, tiempo_estandar_min, instrucciones)
select p.id, s.secuencia, s.nombre, c.id, s.preparacion, s.estandar, s.instrucciones
from public.productos p
join pasos s on s.personalizado = coalesce(p.es_personalizable, false)
join public.centros_trabajo c on c.codigo = s.centro
where p.activo
  and not exists (select 1 from public.ruta_operaciones r where r.producto_id = p.id);
