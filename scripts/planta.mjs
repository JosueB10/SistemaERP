// npm run dev:planta → levanta el ERP (next dev) y, cuando responde, conecta el emulador IIoT de la planta.
// Si el ERP ya está corriendo en el puerto, solo conecta la planta. Ctrl+C detiene todo.
// La clave se toma de IIOT_API_KEY en .env.local.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const PUERTO = process.env.PORT ?? '3000'
const URL_ERP = `http://localhost:${PUERTO}`
const aviso = (texto) => console.log(`\n[planta] ${texto}\n`)

function leerEnv(nombre) {
  if (process.env[nombre]) return process.env[nombre]
  if (!existsSync('.env.local')) return undefined
  const linea = readFileSync('.env.local', 'utf8').split(/\r?\n/).find((l) => l.trim().startsWith(`${nombre}=`))
  return linea?.slice(linea.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') || undefined
}

// "python" o, en Windows, el lanzador "py -3"
function comandoPython() {
  for (const cmd of ['python', 'py -3', 'python3']) {
    const prueba = spawnSync(`${cmd} --version`, { shell: true, encoding: 'utf8' })
    if (prueba.status === 0 && /Python 3/.test(`${prueba.stdout}${prueba.stderr}`)) return cmd
  }
  return null
}

// Estado del ERP en el puerto: 'apagado', 'sin-clave' (responde pero no reconoce la clave) o el JSON de /api/iiot/lecturas
async function estadoErp(clave) {
  try {
    const r = await fetch(`${URL_ERP}/api/iiot/lecturas`, { headers: { 'x-api-key': clave ?? '' } })
    if (r.status === 401) return 'sin-clave'
    return r.ok ? await r.json() : 'apagado'
  } catch {
    return 'apagado'
  }
}

const procesos = []
const detener = (codigo = 0) => { procesos.forEach((p) => p.kill()); process.exit(codigo) }
process.on('SIGINT', () => detener())
process.on('SIGTERM', () => detener())

const clave = leerEnv('IIOT_API_KEY')

// 1. ERP: se reutiliza si ya está corriendo
let estado = await estadoErp(clave)
if (estado === 'apagado') {
  const erp = spawn(`npx next dev -p ${PUERTO}`, { stdio: 'inherit', shell: true })
  procesos.push(erp)
  erp.on('exit', (codigo) => detener(codigo ?? 0))
  for (let i = 0; i < 90 && estado === 'apagado'; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    estado = await estadoErp(clave)
  }
} else {
  aviso(`El ERP ya está corriendo en ${URL_ERP}: se usa ese y solo se conecta la planta.`)
}

// 2. Planta: solo si todo está configurado
const python = comandoPython()
if (!clave) {
  aviso('Falta IIOT_API_KEY en .env.local: el ERP corre sin la planta conectada.')
} else if (!python) {
  aviso('No se encontró Python 3. Instálelo desde python.org (marque "Add python.exe to PATH") y abra una terminal nueva.')
} else if (estado === 'apagado') {
  aviso('El ERP no respondió a tiempo; conecte la planta a mano con: python iiot/emulador.py')
} else if (estado === 'sin-clave') {
  aviso('El ERP que está corriendo no tiene la IIOT_API_KEY actual (se agregó después de iniciarlo).\n' +
    '         Detenga ese "npm run dev" (Ctrl+C en su terminal) y vuelva a ejecutar: npm run dev:planta')
  if (!procesos.length) process.exit(1)
} else if (!estado.configurado) {
  aviso('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local (Supabase → Project Settings → API → service_role).\n' +
    '         Péguela, detenga el ERP y vuelva a ejecutar: npm run dev:planta')
  if (!procesos.length) process.exit(1)
} else {
  const argumentos = process.argv.slice(2).join(' ')
  const emulador = spawn(`${python} iiot/emulador.py --url ${URL_ERP} ${argumentos}`, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NEUMOPAD_IIOT_API_KEY: clave, PYTHONIOENCODING: 'utf-8' }
  })
  procesos.push(emulador)
  // Si el ERP ya corría aparte, al cerrarse el emulador termina este comando
  emulador.on('exit', (codigo) => { if (procesos.length === 1) detener(codigo ?? 0) })
}
