# Planta conectada (IIoT de NeumoPad)

## ¿Qué es esto, en palabras simples?

**IIoT** (Internet Industrial de las Cosas) significa que las máquinas de la fábrica tienen sensores y
**reportan solas por internet** lo que están haciendo: a qué temperatura está la plancha, cuántas piezas
hicieron, cuánta electricidad gastan, si se detuvieron.

NeumoPad no tiene máquinas reales conectadas, así que `emulador.py` **hace de cuenta que es cada máquina**
y manda al ERP datos realistas, igual que lo haría un sensor de verdad.

```
 ┌──────────────┐  cada 3 s   ┌───────────────────────┐   guarda   ┌──────────────┐   cada 5 s   ┌──────────────────┐
 │  Máquina     │ ──────────▶ │  API del ERP           │ ─────────▶ │  Base de     │ ───────────▶ │  Pantalla        │
 │  (sensores)  │  lectura    │  /api/iiot/lecturas    │  revisa    │  datos       │   consulta   │  Monitoreo IIoT  │
 └──────────────┘             └───────────────────────┘  alarmas   └──────────────┘              └──────────────────┘
        ▲                                                                   │
        │   «¿qué fabrico?» / «terminé»   /api/iiot/operaciones             │
        └───────────────────────────────────────────────────────────────────┘
```

1. La máquina pregunta al ERP qué operación de qué orden le toca (`GET /api/iiot/operaciones`).
2. La trabaja: se calienta, produce pieza a pieza y cada 3 segundos manda una **lectura** (`POST /api/iiot/lecturas`).
3. El ERP guarda la lectura, la une a la orden que se está fabricando y, si la temperatura está fuera del rango
   del centro mientras produce, la marca como **alarma**.
4. Cuando contó todas las piezas, la máquina avisa que terminó (`POST /api/iiot/operaciones`). El ERP arranca el
   siguiente paso de la ruta y, al terminar el último, **cierra la orden** (descuenta materia prima) y **crea el lote** para Calidad.

## Qué mide cada máquina

| Máquina | Centro | Sensores | Potencia (trabajando / en espera) |
|---|---|---|---|
| LAVADORA-01 | CT-01 Lavado y secado | humedad, piezas, energía | 2.2 / 0.1 kW |
| CORTE-01 | CT-02 Corte | piezas, energía | 1.5 / 0.1 kW |
| PRENSA-01 | CT-03 Prensa térmica | **temperatura (150–180 °C)**, presión, piezas, energía | 4.5 / 0.8 kW |
| LAMINADO-01 | CT-04 Laminado | presión, piezas, energía | 1.8 / 0.15 kW |
| OVERLOCK-01 | CT-05 Bordes | piezas, energía | 0.55 / 0.05 kW |
| SUBLI-01 | CT-06 Sublimación | **temperatura (190–205 °C)**, presión, piezas, energía | 3.0 / 0.5 kW |
| INSPECCION-01 | CT-07 Control de calidad | piezas, rechazos, energía | 0.3 / 0.05 kW |
| EMPAQUE-01 | CT-08 Empaque | piezas, energía | 0.4 / 0.05 kW |
| LUCES-PL01 | Planta PL-01 (lámparas) | energía | 1.6 kW |

## Estados de una máquina

| Estado | Qué significa |
|---|---|
| **Produciendo** | Fabrica piezas y todo está en rango. |
| **Calentando** | Se alista antes de producir; estar bajo el rango aquí es normal (no es alarma). |
| **Esperando trabajo** | Encendida y conectada, sin operación asignada. |
| **Detenida** | Tenía trabajo y paró (atasco, ajuste, falta de operario, apagón). Ese tiempo baja el OEE. |
| **Alarma** | Produce con la temperatura fuera de rango: hay que revisarla. |
| **Sin señal** | Hace más de 20 s que no reporta: está apagada o sin red. |

## Qué fallas simula (para la demostración)

- **Paros** al azar (`--prob-paro`, 4 % por lectura).
- **Picos de temperatura** fuera de rango (`--prob-falla`, 3 %): salta una alarma.
- **Apagones** (`--prob-apagado`, 0.4 %): la máquina deja de reportar 8–15 lecturas («Sin señal») y luego sigue donde quedó.
- **Cortes de red** (`--prob-corte-red`, 1 % por ciclo): las lecturas se guardan en una **cola** dentro del emulador
  y se reenvían al volver la red **con la hora en que se tomaron** (`registrado_en`). El ERP guarda también cuándo
  llegaron (`recibido_en`); la diferencia es el **tiempo de espera en cola**, visible en el monitoreo y en el análisis.
- **Rechazos** en Control de calidad (`--prob-rechazo`, 8 %): abren una no conformidad.
- `--sin-fallas` apaga todo lo anterior (salvo los rechazos).

## Energía y huella de carbono

Cada lectura trae `potencia_kw` (lo que consume en ese momento) y `energia_kwh` (lo que gastó desde la lectura
anterior). Con eso, **Producción → Energía y CO₂** calcula:

- kWh por día, por máquina, por planta y de la iluminación.
- Costo = kWh × tarifa de la planta.
- Huella de carbono = kWh × factor de emisión de la red (kg CO₂/kWh), configurable en **Producción → Plantas**.
- CO₂ por mousepad producido.

## Análisis histórico

**Producción → Análisis IIoT** muestra, día por día, la temperatura promedio, mínima y máxima de cada máquina,
sus alarmas, paros, piezas y energía (función `resumen_iiot_diario`). Haga clic en un día para ver su curva completa.
El botón **Datos de ejemplo** genera 30 días de lecturas simuladas (`generar_historico_iiot`), con unos días en que
la prensa trabajó demasiado caliente, para practicar el análisis sin tener la planta encendida.

## Configuración (una vez)

1. Ejecute en Supabase, en orden, las migraciones `202610280004_iiot.sql`, `202610290001_avance_automatico_ruta.sql`
   y `202610300001_plantas_energia_destajo.sql`.
2. En `.env.local`:
   ```
   IIOT_API_KEY=una-clave-para-las-maquinas
   SUPABASE_SERVICE_ROLE_KEY=<Supabase → Project Settings → API → service_role>
   ```
3. Tenga Python 3 instalado (python.org, marque **Add python.exe to PATH**).

## Uso

```bash
npm run dev:planta          # levanta el ERP y conecta la planta (recomendado)
```

o por separado, con el ERP ya corriendo:

```bash
python iiot/emulador.py --api-key una-clave-para-las-maquinas --prueba       # verifica la conexión
python iiot/emulador.py --api-key una-clave-para-las-maquinas                # planta conectada
python iiot/emulador.py --api-key ... --sin-fallas                           # sin paros ni apagones
python iiot/emulador.py --api-key ... --velocidad 1 --intervalo 5            # tiempo real
```

**Tiempo:** con `--velocidad 20` (por defecto) un minuto de planta dura 3 segundos. El ERP guarda esa escala
(verá «IIoT ×20»), así que el OEE, el tiempo de ciclo y la energía se calculan en minutos de planta.

Mantenga la planta conectada **antes** de crear la orden: si una operación lleva mucho rato en proceso cuando la
máquina la toma, ese tiempo cuenta como tiempo real de la operación y baja su OEE.

Sin la planta conectada todo sigue funcionando: cada paso arranca solo y se termina con el botón **Terminar** de la orden.

## Ejemplo de lectura (lo que envía una máquina)

```json
POST /api/iiot/lecturas        (cabecera x-api-key: IIOT_API_KEY)
{
  "lecturas": [
    { "dispositivo": "PRENSA-01", "centro": "CT-03", "estado": "operando",
      "temperatura": 166.4, "presion": 5.02, "piezas": 1,
      "potencia_kw": 4.41, "energia_kwh": 0.0735, "registrado_en": "2026-10-30T14:05:03+00:00" },
    { "dispositivo": "LUCES-PL01", "centro": "PL-01", "estado": "operando",
      "potencia_kw": 1.6, "energia_kwh": 0.0267, "registrado_en": "2026-10-30T14:05:03+00:00" }
  ]
}
```
