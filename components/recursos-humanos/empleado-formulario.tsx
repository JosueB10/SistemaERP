'use client'

import { useState } from 'react'

import { categoriasUnicas, fechaHoy, formatoCordobas, validarNumero } from '@/lib/inventario/utilidades'
import { guardarEmpleado, useRecursosHumanos } from '@/lib/recursos-humanos/store'
import type { Empleado, EstadoEmpleado, TipoContrato, TipoPago } from '@/lib/recursos-humanos/tipos'
import {
  ETIQUETAS_CONTRATO,
  ETIQUETAS_ESTADO_EMPLEADO,
  ETIQUETAS_TIPO_PAGO,
  salarioDiario,
  siguienteCodigo
} from '@/lib/recursos-humanos/utilidades'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'

type CampoFormulario =
  | 'codigo' | 'nombres' | 'apellidos' | 'cedula' | 'numeroInss' | 'cargo' | 'area'
  | 'telefono' | 'correo' | 'direccion' | 'fechaIngreso' | 'salarioMensual'

type Errores = Partial<Record<CampoFormulario, string>>

// Cédula nicaragüense: 000-000000-0000X
const PATRON_CEDULA = /^\d{3}-?\d{6}-?\d{4}[A-Z]$/
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function EmpleadoFormulario({
  empleado,
  onCancelar,
  onGuardado
}: {
  empleado?: Empleado
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { empleados } = useRecursosHumanos()
  const esEdicion = Boolean(empleado)

  const [valores, setValores] = useState({
    codigo: empleado?.codigo ?? siguienteCodigo(empleados),
    nombres: empleado?.nombres ?? '',
    apellidos: empleado?.apellidos ?? '',
    cedula: empleado?.cedula ?? '',
    numeroInss: empleado?.numeroInss ?? '',
    cargo: empleado?.cargo ?? '',
    area: empleado?.area ?? '',
    telefono: empleado?.telefono ?? '',
    correo: empleado?.correo ?? '',
    direccion: empleado?.direccion ?? '',
    fechaIngreso: empleado?.fechaIngreso ?? fechaHoy(),
    tipoContrato: empleado?.tipoContrato ?? ('indefinido' as TipoContrato),
    tipoPago: empleado?.tipoPago ?? ('fijo' as TipoPago),
    salarioMensual: empleado ? String(empleado.salarioMensual) : '',
    estado: empleado?.estado ?? ('activo' as EstadoEmpleado)
  })
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cambiar = (campo: keyof typeof valores, valor: string) => {
    setValores((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [campo]: undefined }))
  }

  const salario = Number(valores.salarioMensual)
  const esDestajo = valores.tipoPago === 'destajo'
  const ayudaSalario = esDestajo
    ? 'Si lo que produce en el período no alcanza, se le completa hasta este monto (nunca menos del salario mínimo de su sector).'
    : valores.salarioMensual !== '' && salario > 0
      ? `Salario diario: ${formatoCordobas(salarioDiario(salario))}`
      : 'Salario bruto mensual, antes de deducciones.'

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Errores = {}

    if (!valores.codigo.trim()) nuevosErrores.codigo = 'El código es obligatorio.'
    else if (valores.codigo.trim().length > 20) nuevosErrores.codigo = 'Máximo 20 caracteres.'
    if (!valores.nombres.trim()) nuevosErrores.nombres = 'Los nombres son obligatorios.'
    if (!valores.apellidos.trim()) nuevosErrores.apellidos = 'Los apellidos son obligatorios.'
    if (valores.cedula.trim() && !PATRON_CEDULA.test(valores.cedula.trim())) {
      nuevosErrores.cedula = 'Formato esperado: 001-010190-0001A.'
    }
    if (!valores.cargo.trim()) nuevosErrores.cargo = 'El cargo es obligatorio.'
    if (valores.correo.trim() && !PATRON_CORREO.test(valores.correo.trim())) {
      nuevosErrores.correo = 'Ingrese un correo válido.'
    }
    if (!valores.fechaIngreso) nuevosErrores.fechaIngreso = 'La fecha de ingreso es obligatoria.'

    const salarioMensual = validarNumero(valores.salarioMensual, { etiqueta: esDestajo ? 'El salario mínimo garantizado' : 'El salario mensual', mayorQueCero: true })
    if (salarioMensual.error) nuevosErrores.salarioMensual = salarioMensual.error

    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setEnviando(true)
    const resultado = await guardarEmpleado(
      {
        codigo: valores.codigo,
        nombres: valores.nombres,
        apellidos: valores.apellidos,
        cedula: valores.cedula,
        numeroInss: valores.numeroInss,
        cargo: valores.cargo,
        area: valores.area,
        telefono: valores.telefono,
        correo: valores.correo,
        direccion: valores.direccion,
        fechaIngreso: valores.fechaIngreso,
        fechaBaja: empleado?.fechaBaja,
        tipoContrato: valores.tipoContrato,
        tipoPago: valores.tipoPago,
        salarioMensual: salarioMensual.valor!,
        estado: valores.estado
      },
      empleado?.id
    )
    setEnviando(false)

    if (!resultado.ok) {
      setErrorGeneral(resultado.error)
      return
    }
    onGuardado(esEdicion ? 'Empleado actualizado' : 'Empleado registrado')
  }

  const texto = (campo: CampoFormulario, etiqueta: string, opciones: { requerido?: boolean; placeholder?: string; tipo?: string; ayuda?: string; ancho?: boolean; mayusculas?: boolean; lista?: string } = {}) => (
    <Campo
      etiqueta={etiqueta}
      htmlFor={`empleado-${campo}`}
      error={errores[campo]}
      ayuda={opciones.ayuda}
      requerido={opciones.requerido}
      className={opciones.ancho ? 'sm:col-span-2' : ''}
    >
      <input
        id={`empleado-${campo}`}
        type={opciones.tipo ?? 'text'}
        list={opciones.lista}
        value={valores[campo]}
        onChange={(e) => cambiar(campo, opciones.mayusculas ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={opciones.placeholder}
        className={claseInput}
      />
    </Campo>
  )

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Datos personales</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {texto('codigo', 'Código', { requerido: true, mayusculas: true, placeholder: 'EMP-001' })}
        {texto('cedula', 'Cédula', { mayusculas: true, placeholder: '001-010190-0001A' })}
        {texto('nombres', 'Nombres', { requerido: true })}
        {texto('apellidos', 'Apellidos', { requerido: true })}
        {texto('telefono', 'Teléfono', { tipo: 'tel', placeholder: '8888-8888' })}
        {texto('correo', 'Correo', { tipo: 'email' })}
        {texto('direccion', 'Dirección', { ancho: true })}
        </div>
      </section>

      <section className="border-t border-zinc-100 pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Datos laborales</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {texto('cargo', 'Cargo', { requerido: true, lista: 'rrhh-cargos', placeholder: 'Operario de producción' })}
        {texto('area', 'Área', { lista: 'rrhh-areas', placeholder: 'Producción' })}
        <datalist id="rrhh-cargos">
          {categoriasUnicas(empleados.map((e) => ({ categoria: e.cargo }))).map((cargo) => <option key={cargo} value={cargo} />)}
        </datalist>
        <datalist id="rrhh-areas">
          {categoriasUnicas(empleados.filter((e) => e.area).map((e) => ({ categoria: e.area }))).map((area) => <option key={area} value={area} />)}
        </datalist>
        {texto('fechaIngreso', 'Fecha de ingreso', { requerido: true, tipo: 'date' })}
        {texto('numeroInss', 'Número de INSS')}

        <Campo etiqueta="Tipo de contrato" htmlFor="empleado-contrato" requerido>
          <select id="empleado-contrato" value={valores.tipoContrato} onChange={(e) => cambiar('tipoContrato', e.target.value)} className={claseInput}>
            {(Object.keys(ETIQUETAS_CONTRATO) as TipoContrato[]).map((tipo) => (
              <option key={tipo} value={tipo}>{ETIQUETAS_CONTRATO[tipo]}</option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Forma de pago" htmlFor="empleado-tipoPago" requerido
          ayuda={esDestajo ? 'Cobra por cada pieza buena que produce, según la tarifa de cada centro de trabajo.' : undefined}>
          <select id="empleado-tipoPago" value={valores.tipoPago} onChange={(e) => cambiar('tipoPago', e.target.value)} className={claseInput}>
            {(Object.keys(ETIQUETAS_TIPO_PAGO) as TipoPago[]).map((tipo) => (
              <option key={tipo} value={tipo}>{ETIQUETAS_TIPO_PAGO[tipo]}</option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta={esDestajo ? 'Mínimo garantizado mensual (C$)' : 'Salario mensual (C$)'} htmlFor="empleado-salarioMensual" error={errores.salarioMensual} ayuda={ayudaSalario} requerido>
          <input
            id="empleado-salarioMensual"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={valores.salarioMensual}
            onChange={(e) => cambiar('salarioMensual', e.target.value)}
            className={claseInput}
          />
        </Campo>

        {esEdicion && (
          <Campo etiqueta="Estado" htmlFor="empleado-estado" requerido>
            <select id="empleado-estado" value={valores.estado} onChange={(e) => cambiar('estado', e.target.value)} className={claseInput}>
              {(Object.keys(ETIQUETAS_ESTADO_EMPLEADO) as EstadoEmpleado[]).map((item) => (
                <option key={item} value={item}>{ETIQUETAS_ESTADO_EMPLEADO[item]}</option>
              ))}
            </select>
          </Campo>
        )}
        </div>
      </section>

      <PieFormulario
        onCancelar={onCancelar}
        textoGuardar={esEdicion ? 'Guardar cambios' : 'Registrar empleado'}
        enviando={enviando}
      />
    </form>
  )
}
