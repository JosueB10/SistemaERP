import type { DisposicionNc, EstadoLote, EstadoNc, OrigenNc, SeveridadNc } from './tipos'

export const ETIQUETAS_ESTADO_LOTE: Record<EstadoLote, string> = {
  en_inspeccion: 'En inspección',
  aprobado: 'Aprobado',
  aprobado_parcial: 'Aprobado parcial',
  rechazado: 'Rechazado'
}

export const ETIQUETAS_ORIGEN_NC: Record<OrigenNc, string> = {
  produccion: 'Inspección de lote',
  proceso: 'Rechazo en proceso',
  materia_prima: 'Materia prima / proveedor',
  cliente: 'Reclamo de cliente'
}

export const ETIQUETAS_SEVERIDAD: Record<SeveridadNc, string> = {
  menor: 'Menor',
  mayor: 'Mayor',
  critica: 'Crítica'
}

export const ETIQUETAS_DISPOSICION: Record<DisposicionNc, string> = {
  reproceso: 'Reproceso',
  desecho: 'Desecho',
  concesion: 'Aceptar con concesión',
  devolucion: 'Devolución al proveedor'
}

export const ETIQUETAS_ESTADO_NC: Record<EstadoNc, string> = {
  abierta: 'Abierta',
  en_analisis: 'En análisis',
  cerrada: 'Cerrada'
}

// Lista de verificación de la inspección final de un mousepad
export const CRITERIOS_INSPECCION: { clave: string; etiqueta: string; soloPersonalizado?: boolean }[] = [
  { clave: 'medidas', etiqueta: 'Medidas dentro de tolerancia' },
  { clave: 'planitud', etiqueta: 'Superficie plana, sin alabeo' },
  { clave: 'adhesion', etiqueta: 'Tela bien adherida, sin burbujas' },
  { clave: 'bordes', etiqueta: 'Bordes cosidos/sellados sin hilos sueltos' },
  { clave: 'limpieza', etiqueta: 'Sin manchas ni olor fuerte a caucho' },
  { clave: 'diseno', etiqueta: 'Diseño nítido y alineado', soloPersonalizado: true }
]

// Defectos típicos del proceso de NeumoPad
export const DEFECTOS_COMUNES = [
  'Corte fuera de medida',
  'Caucho ondulado (planchado insuficiente)',
  'Burbujas o arrugas en la tela',
  'Tela despegada',
  'Borde mal cosido o deshilachado',
  'Diseño borroso o desalineado',
  'Manchas o contaminación',
  'Grietas o alambre en el caucho'
]

export function codigoNc(id: string) {
  return `NC-${id.padStart(4, '0')}`
}

export function porcentajeAprobacion(aprobadas: number, total: number) {
  return total > 0 ? aprobadas / total : 0
}
