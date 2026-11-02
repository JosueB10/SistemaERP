// Tipos compartidos del módulo de producción.

export type EstadoOrden = 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'

// Cantidad de una materia prima que lleva UNA unidad del producto
export interface LineaReceta {
  materiaPrimaId: string
  cantidad: number
}

// Componente directo de la receta (nivel 1 de la BOM): materia prima o subensamble
export type TipoComponente = 'materia_prima' | 'subensamble'

export interface LineaEstructura {
  tipo: TipoComponente
  componenteId: string
  cantidad: number
}

export interface Receta {
  id: string
  productoId: string
  nombre: string
  version: number
  notas?: string
  actualizadoEn: string
  // Componentes tal como se definieron (materia prima y subensambles)
  estructura: LineaEstructura[]
  // BOM explotada: materia prima total por unidad, sumando la de los subensambles
  lineas: LineaReceta[]
}

// Subensamble intermedio (nivel 1): se fabrica dentro de la orden con su propia materia prima (nivel 2)
export interface Subensamble {
  id: string
  codigo: string
  nombre: string
  descripcion?: string
  activo: boolean
  lineas: LineaReceta[]
}

// Planta o nave de producción: agrupa centros de trabajo y define el costo y la huella de su energía
export interface Planta {
  id: string
  codigo: string
  nombre: string
  ubicacion?: string
  // Potencia de las lámparas encendidas durante el turno
  iluminacionKw: number
  // kg de CO₂ por kWh de la red eléctrica
  factorEmisionKgKwh: number
  // Córdobas por kWh
  tarifaKwh: number
  activo: boolean
}

export interface CentroTrabajo {
  id: string
  codigo: string
  nombre: string
  descripcion?: string
  plantaId?: string
  // Unidades por hora
  capacidadHora: number
  horasTurno: number
  costoHora: number
  temperaturaMin?: number
  temperaturaMax?: number
  // Potencia trabajando y en espera (encendida sin producir)
  potenciaKw: number
  potenciaEsperaKw: number
  // Córdobas por pieza buena para el personal pagado por destajo
  tarifaDestajo: number
  activo: boolean
}

// Paso de la ruta de fabricación de un producto
export interface OperacionRuta {
  id: string
  productoId: string
  secuencia: number
  nombre: string
  centroTrabajoId: string
  tiempoPreparacionMin: number
  // Minutos por unidad (tiempo de ciclo ideal)
  tiempoEstandarMin: number
  instrucciones?: string
}

export type EstadoOperacion = 'pendiente' | 'en_proceso' | 'completada'

// Operación de la ruta ejecutada en una orden
export interface OperacionOrden {
  id: string
  ordenId: string
  secuencia: number
  nombre: string
  centroTrabajoId?: string
  tiempoPreparacionMin: number
  tiempoEstandarMin: number
  estado: EstadoOperacion
  inicio?: string
  fin?: string
  tiempoParoMin: number
  motivoParo?: string
  cantidadBuena: number
  cantidadRechazada: number
  empleadoId?: string
  observaciones?: string
  // Minutos de planta por minuto real (simulación IIoT acelerada); 1 = tiempo real
  escalaTiempo: number
  registradoPor: 'manual' | 'iiot'
}

export interface ConsumoOrden {
  materiaPrimaId: string
  cantidadTeorica: number
  cantidadReal: number
  costoUnitario: number
  subtotal: number
}

export interface OrdenProduccion {
  id: string
  codigo: string
  productoId: string
  recetaId?: string
  empleadoId?: string
  // Venta pendiente que esta orden surte
  ventaId?: string
  fechaProgramada?: string
  fechaInicio?: string
  fechaFin?: string
  cantidadPlanificada: number
  cantidadProducida: number
  estado: EstadoOrden
  observaciones?: string
  costoMateriales: number
  creadoEn: string
  consumos: ConsumoOrden[]
  operaciones: OperacionOrden[]
}

export interface Responsable {
  id: string
  codigo: string
  nombre: string
  activo: boolean
}

export interface DatosProduccion {
  recetas: Receta[]
  ordenes: OrdenProduccion[]
  responsables: Responsable[]
  subensambles: Subensamble[]
  centros: CentroTrabajo[]
  rutas: OperacionRuta[]
  plantas: Planta[]
}

export interface RecetaEntrada {
  productoId: string
  nombre: string
  notas: string
  estructura: LineaEstructura[]
}

export interface SubensambleEntrada {
  codigo: string
  nombre: string
  descripcion: string
  lineas: LineaReceta[]
}

export type CentroTrabajoEntrada = Omit<CentroTrabajo, 'id' | 'activo'>

export type PlantaEntrada = Omit<Planta, 'id' | 'activo'>

export type OperacionRutaEntrada = Omit<OperacionRuta, 'id' | 'productoId' | 'secuencia'>

export interface TerminarOperacionEntrada {
  inicio: string
  fin: string
  cantidadBuena: number
  cantidadRechazada: number
  tiempoParoMin: number
  motivoParo: string
  empleadoId?: string
  observaciones: string
}

export interface OrdenEntrada {
  productoId: string
  cantidadPlanificada: number
  fechaProgramada: string
  empleadoId?: string
  ventaId?: string
  observaciones: string
}

export interface CompletarOrdenEntrada {
  cantidadProducida: number
  fechaFin: string
  consumos: { materiaPrimaId: string; cantidadTeorica: number; cantidadReal: number }[]
  observaciones: string
}

// Materia prima necesaria para fabricar cierta cantidad de un producto
export interface Requerimiento {
  materiaPrimaId: string
  codigo: string
  nombre: string
  unidad: string
  porUnidad: number
  requerido: number
  disponible: number
  faltante: number
  costoUnitario: number
  costo: number
}
