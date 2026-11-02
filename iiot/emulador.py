#!/usr/bin/env python3
"""
Emulador IIoT de la planta NeumoPad ("planta conectada").

Hace de cuenta que cada centro de trabajo tiene una máquina con sensores conectada a internet.
Cada pocos segundos el emulador:

  1. Pregunta al ERP qué operaciones de órdenes están en proceso:   GET  /api/iiot/operaciones
  2. Cada máquina con trabajo lo simula (se calienta, produce pieza a pieza, a veces se detiene)
     y manda la lectura de sus sensores:                            POST /api/iiot/lecturas
       temperatura, presión, humedad, piezas contadas, potencia (kW) y energía gastada (kWh)
  3. Cuando la máquina contó todas las piezas, termina la operación: POST /api/iiot/operaciones
     El ERP arranca solo el siguiente paso de la ruta y, al terminar el último, cierra la orden y crea el lote.

También simula lo que pasa en una planta real:
  · Paros: atascos, ajustes, falta de operario (la máquina queda "Detenida").
  · Picos de temperatura fuera del rango del centro (el ERP los marca como "Alarma").
  · Apagones: una máquina se apaga y deja de reportar (el ERP la muestra "Sin señal"); al volver sigue su trabajo.
  · Cortes de red: las lecturas no se pueden enviar y se guardan en una cola; cuando vuelve la conexión
    se reenvían con su hora original. El ERP muestra cuánto esperaron en la cola.
  · Lámparas: el medidor LUCES-PL01 reporta el consumo de la iluminación de la planta.
  · Control de calidad (CT-07): rechaza algunas piezas al azar; esas abren una no conformidad.

Con --velocidad 20 (por defecto) un minuto de planta dura 3 segundos. El ERP guarda esa escala, así que
el OEE, los tiempos y la energía se calculan en minutos de planta. Use --velocidad 1 para tiempo real.

Solo usa la biblioteca estándar de Python (3.8+). Ejemplos:

    python iiot/emulador.py --api-key MI_CLAVE              # deja la planta conectada
    python iiot/emulador.py --api-key MI_CLAVE --prueba     # solo verifica la conexión
    python iiot/emulador.py --api-key MI_CLAVE --sin-fallas # sin paros, apagones ni cortes de red
    python iiot/emulador.py --api-key MI_CLAVE --velocidad 1 --intervalo 5

La clave también se puede dar con la variable de entorno NEUMOPAD_IIOT_API_KEY
(o NEUMOPAD_URL para la dirección del ERP).
"""

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

AMBIENTE = 30.0
MAXIMO_LOTE = 50
MAXIMO_COLA = 5000


@dataclass
class Trabajo:
    """Operación de una orden que la máquina está ejecutando."""
    operacion_id: int
    orden: str
    nombre: str
    entrada: int
    estandar_min: float
    preparacion_restante: float
    piezas: int = 0
    acumulado: float = 0.0
    paro_min: float = 0.0
    motivo_paro: Optional[str] = None


@dataclass
class Maquina:
    dispositivo: str
    centro: str
    nombre: str
    potencia_kw: float = 0.0
    espera_kw: float = 0.0
    temp_objetivo: Optional[float] = None
    temp_ruido: float = 1.5
    presion_objetivo: Optional[float] = None
    humedad_objetivo: Optional[float] = None
    inspeccion: bool = False
    temperatura: float = AMBIENTE
    paro_restante: int = 0
    apagada_restante: int = 0
    reencendida: bool = False
    trabajo: Optional[Trabajo] = None
    total_piezas: int = field(default=0)
    total_kwh: float = field(default=0.0)

    def avanzar(self, minutos: float, prob_paro: float, prob_falla: float, prob_apagado: float) -> Optional[dict]:
        """Avanza la simulación `minutos` de planta. Devuelve la lectura, o None si la máquina está apagada."""
        t = self.trabajo

        # Apagón: la máquina deja de reportar; si tenía trabajo, ese tiempo cuenta como paro
        if self.apagada_restante == 0 and random.random() < prob_apagado:
            self.apagada_restante = random.randint(8, 15)
            print(f"[{hora()}] ⚡ {self.dispositivo} se apagó (simulación de corte de energía)")
        if self.apagada_restante > 0:
            self.apagada_restante -= 1
            self.temperatura += (AMBIENTE - self.temperatura) * 0.2
            if t is not None:
                t.paro_min += minutos
                t.motivo_paro = "Máquina apagada (sin energía)"
            if self.apagada_restante == 0:
                print(f"[{hora()}] ⚡ {self.dispositivo} volvió a encender")
                self.reencendida = True
            return None

        lectura = {"dispositivo": self.dispositivo, "centro": self.centro, "estado": "inactivo", "piezas": 0}
        if self.reencendida:
            lectura["mensaje"] = "Volvió a encender después de un apagado"
            self.reencendida = False
        calentando = False

        if t is not None:
            lectura["estado"] = "operando"
            if self.paro_restante == 0 and t.preparacion_restante <= 0 and random.random() < prob_paro:
                self.paro_restante = random.randint(1, 3)
                t.motivo_paro = random.choice(["Atasco de material", "Ajuste de máquina", "Cambio de rollo de tela", "Falta de operario"])
            if self.paro_restante > 0:
                self.paro_restante -= 1
                t.paro_min += minutos
                lectura["estado"] = "paro"
                lectura["mensaje"] = t.motivo_paro
            elif t.preparacion_restante > 0:
                t.preparacion_restante -= minutos
                calentando = True
                lectura["estado"] = "preparacion"
                lectura["mensaje"] = "Calentando" if self.temp_objetivo else "Preparando la máquina"
            else:
                # Ritmo real algo menor que el estándar: el rendimiento no sale perfecto
                t.acumulado += minutos / t.estandar_min * random.uniform(0.75, 1.0)
                nuevas = min(int(t.acumulado), t.entrada - t.piezas)
                t.acumulado -= int(t.acumulado)
                t.piezas += nuevas
                self.total_piezas += nuevas
                lectura["piezas"] = nuevas

        # Sensores: la temperatura sube al trabajar y baja en reposo o en paro
        if self.temp_objetivo is not None:
            activa = t is not None and lectura["estado"] != "paro"
            objetivo = self.temp_objetivo if activa else AMBIENTE
            paso = 0.25 if calentando else 0.35
            self.temperatura += (objetivo - self.temperatura) * paso + random.gauss(0, self.temp_ruido)
            temperatura = self.temperatura
            if lectura["estado"] == "operando" and random.random() < prob_falla:
                temperatura += random.choice([-1, 1]) * random.uniform(18, 30)
                lectura["mensaje"] = "Variación de temperatura en el resistor"
            lectura["temperatura"] = round(temperatura, 1)
        if self.presion_objetivo is not None:
            activa = lectura["estado"] == "operando"
            lectura["presion"] = round(max(0.0, (self.presion_objetivo if activa else 0.2) + random.gauss(0, 0.15)), 2)
        if self.humedad_objetivo is not None:
            lectura["humedad"] = round(min(100.0, max(0.0, self.humedad_objetivo + random.gauss(0, 3))), 1)

        # Medidor de energía: trabajando consume su potencia; calentando, algo más; en espera o paro, poco
        if lectura["estado"] == "operando":
            potencia = self.potencia_kw * random.uniform(0.85, 1.05)
        elif lectura["estado"] == "preparacion":
            potencia = self.potencia_kw * 1.15
        else:
            potencia = self.espera_kw
        lectura["potencia_kw"] = round(potencia, 2)
        lectura["energia_kwh"] = round(potencia * minutos / 60, 4)
        self.total_kwh += lectura["energia_kwh"]
        return lectura


@dataclass
class Luces:
    """Medidor de la iluminación de la planta (lámparas encendidas durante el turno)."""
    dispositivo: str
    planta: str
    potencia_kw: float
    total_kwh: float = 0.0

    def avanzar(self, minutos: float) -> dict:
        energia = round(self.potencia_kw * minutos / 60, 4)
        self.total_kwh += energia
        return {"dispositivo": self.dispositivo, "centro": self.planta, "estado": "operando", "piezas": 0,
                "potencia_kw": self.potencia_kw, "energia_kwh": energia}


# Una máquina por centro de trabajo (códigos de la migración 202610280006; potencias de 202610300001)
MAQUINAS = {
    "LAVADORA-01": dict(centro="CT-01", nombre="Lavado y secado", potencia_kw=2.2, espera_kw=0.1, humedad_objetivo=65),
    "CORTE-01": dict(centro="CT-02", nombre="Corte", potencia_kw=1.5, espera_kw=0.1),
    "PRENSA-01": dict(centro="CT-03", nombre="Prensa térmica", potencia_kw=4.5, espera_kw=0.8, temp_objetivo=165, temp_ruido=1.8, presion_objetivo=5.0),
    "LAMINADO-01": dict(centro="CT-04", nombre="Laminado", potencia_kw=1.8, espera_kw=0.15, presion_objetivo=2.5),
    "OVERLOCK-01": dict(centro="CT-05", nombre="Bordes", potencia_kw=0.55, espera_kw=0.05),
    "SUBLI-01": dict(centro="CT-06", nombre="Sublimación", potencia_kw=3.0, espera_kw=0.5, temp_objetivo=198, temp_ruido=1.2, presion_objetivo=3.0),
    "INSPECCION-01": dict(centro="CT-07", nombre="Control de calidad", potencia_kw=0.3, espera_kw=0.05, inspeccion=True),
    "EMPAQUE-01": dict(centro="CT-08", nombre="Empaque", potencia_kw=0.4, espera_kw=0.05),
}


def peticion(url: str, clave: str, metodo: str = "GET", cuerpo: Optional[dict] = None, tiempo: float = 15):
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(url, data=datos, method=metodo)
    req.add_header("x-api-key", clave)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=tiempo) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read().decode("utf-8") or "{}")
        except ValueError:
            return err.code, {"error": err.reason}


def hora() -> str:
    return datetime.now().strftime("%H:%M:%S")


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ColaEnvio:
    """Lecturas pendientes de enviar. Si no hay red, esperan aquí y se reenvían con su hora original."""

    def __init__(self, url: str, clave: str):
        self.url = url
        self.clave = clave
        self.pendientes: deque = deque(maxlen=MAXIMO_COLA)

    def agregar(self, lecturas: list):
        self.pendientes.extend(lecturas)

    def enviar(self) -> bool:
        """Envía todo lo pendiente en lotes. Devuelve False si no hubo conexión (lo pendiente se queda)."""
        while self.pendientes:
            lote = [self.pendientes[i] for i in range(min(MAXIMO_LOTE, len(self.pendientes)))]
            try:
                estado, respuesta = peticion(self.url, self.clave, "POST", {"lecturas": lote})
            except urllib.error.URLError as err:
                print(f"[{hora()}] sin conexión con el ERP ({err.reason}): {len(self.pendientes)} lectura(s) esperan en la cola", file=sys.stderr)
                return False
            if estado >= 500:
                print(f"[{hora()}] el ERP respondió {estado}: {respuesta.get('error', respuesta)}; se reintenta después", file=sys.stderr)
                return False
            if estado == 201:
                quitar = len(lote)
            else:
                # Lectura rechazada: se descartan las que entraron y la que falló; el resto sigue en la cola
                quitar = min(len(lote), len(respuesta.get("registradas", [])) + 1)
                print(f"[{hora()}] lectura rechazada ({estado}): {respuesta.get('error', respuesta)}", file=sys.stderr)
            for _ in range(quitar):
                self.pendientes.popleft()
        return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Emulador de la planta NeumoPad (IIoT)")
    parser.add_argument("--url", default=os.environ.get("NEUMOPAD_URL", "http://localhost:3000"), help="URL base del ERP")
    parser.add_argument("--api-key", default=os.environ.get("NEUMOPAD_IIOT_API_KEY"), help="Clave IIOT_API_KEY configurada en el ERP")
    parser.add_argument("--intervalo", type=float, default=3.0, help="Segundos reales entre lecturas (por defecto 3)")
    parser.add_argument("--velocidad", type=float, default=20.0, help="Minutos de planta por minuto real (por defecto 20; 1 = tiempo real)")
    parser.add_argument("--dispositivos", nargs="+", choices=sorted(MAQUINAS), help="Máquinas a simular (por defecto todas)")
    parser.add_argument("--planta", default="PL-01", help="Código de la planta para el medidor de las lámparas (por defecto PL-01)")
    parser.add_argument("--luces-kw", type=float, default=1.6, help="Potencia de la iluminación de la planta en kW (0 = sin medidor)")
    parser.add_argument("--prob-paro", type=float, default=0.04, help="Probabilidad de un paro en cada lectura")
    parser.add_argument("--prob-falla", type=float, default=0.03, help="Probabilidad de un pico de temperatura fuera de rango")
    parser.add_argument("--prob-rechazo", type=float, default=0.08, help="Probabilidad de que una pieza no pase Control de calidad")
    parser.add_argument("--prob-apagado", type=float, default=0.004, help="Probabilidad de que una máquina se apague en cada lectura")
    parser.add_argument("--prob-corte-red", type=float, default=0.01, help="Probabilidad de que se caiga la red en cada ciclo")
    parser.add_argument("--sin-fallas", action="store_true", help="Sin paros, picos, apagones ni cortes de red")
    parser.add_argument("--semilla", type=int, help="Semilla aleatoria para repetir una simulación")
    parser.add_argument("--prueba", action="store_true", help="Solo verifica la conexión y la clave")
    args = parser.parse_args()

    if not args.api_key:
        print("Falta la clave: use --api-key o la variable NEUMOPAD_IIOT_API_KEY.", file=sys.stderr)
        return 2
    if args.intervalo <= 0 or not 1 <= args.velocidad <= 1000:
        print("--intervalo debe ser mayor que cero y --velocidad estar entre 1 y 1000.", file=sys.stderr)
        return 2
    if args.semilla is not None:
        random.seed(args.semilla)
    if args.sin_fallas:
        args.prob_paro = args.prob_falla = args.prob_apagado = args.prob_corte_red = 0.0

    base = args.url.rstrip("/")
    url_lecturas = base + "/api/iiot/lecturas"
    url_operaciones = base + "/api/iiot/operaciones"
    try:
        estado, respuesta = peticion(url_lecturas, args.api_key)
    except urllib.error.URLError as err:
        print(f"No se pudo conectar con {base}: {err.reason}. ¿Está corriendo el ERP (npm run dev)?", file=sys.stderr)
        return 1
    if estado != 200:
        print(f"El ERP respondió {estado}: {respuesta.get('error', respuesta)}", file=sys.stderr)
        return 1
    if not respuesta.get("configurado"):
        print("El ERP no tiene SUPABASE_SERVICE_ROLE_KEY en .env.local; no podrá guardar lecturas.", file=sys.stderr)
        return 1
    print(f"Conectado a {base}")
    if args.prueba:
        return 0

    maquinas = [Maquina(dispositivo=n, **MAQUINAS[n]) for n in (args.dispositivos or MAQUINAS)]
    luces = Luces(f"LUCES-{args.planta.replace('-', '')}", args.planta, args.luces_kw) if args.luces_kw > 0 else None
    cola = ColaEnvio(url_lecturas, args.api_key)
    minutos_por_lectura = args.intervalo / 60 * args.velocidad
    escala = "tiempo real" if args.velocidad == 1 else f"acelerada ×{args.velocidad:g} (1 min de planta = {60 / args.velocidad:g} s)"
    print()
    print("=" * 72)
    print(" PLANTA CONECTADA · NeumoPad")
    print("=" * 72)
    print(f" {len(maquinas)} máquina(s){' + medidor de lámparas ' + luces.dispositivo if luces else ''}")
    print(f" Cada {args.intervalo:g} s cada máquina envía una lectura de sus sensores al ERP.")
    print(f" Simulación {escala}.")
    print(" Véalo en el ERP: Producción → Monitoreo IIoT.")
    print(" Para que trabajen, cree una orden de producción. Ctrl+C para detener.")
    print("=" * 72 + "\n")

    red_caida = 0
    activas = {}
    try:
        while True:
            # Corte de red simulado: no se puede consultar ni enviar; las máquinas siguen trabajando
            if red_caida == 0 and random.random() < args.prob_corte_red:
                red_caida = random.randint(5, 12)
                print(f"[{hora()}] 📶 se cayó la red de la planta: las lecturas se guardan en la cola hasta que vuelva")
            hay_red = red_caida == 0
            if red_caida > 0:
                red_caida -= 1
                if red_caida == 0:
                    print(f"[{hora()}] 📶 volvió la red: se reenvían {len(cola.pendientes)} lectura(s) en cola con su hora original")

            # 1. Qué hay que fabricar
            if hay_red:
                try:
                    estado, respuesta = peticion(url_operaciones, args.api_key)
                    if estado == 200:
                        activas = {}
                        for op in respuesta.get("operaciones", []):
                            activas.setdefault(op["centro"], op)  # una operación a la vez por máquina
                    else:
                        print(f"[{hora()}] error {estado}: {respuesta.get('error', respuesta)}", file=sys.stderr)
                        hay_red = False
                except urllib.error.URLError as err:
                    print(f"[{hora()}] sin conexión: {err.reason}", file=sys.stderr)
                    hay_red = False

            if hay_red:
                for m in maquinas:
                    op = activas.get(m.centro)
                    if op is None:
                        m.trabajo = None
                    elif m.trabajo is None or m.trabajo.operacion_id != op["operacion_id"]:
                        m.trabajo = Trabajo(
                            operacion_id=op["operacion_id"],
                            orden=op["orden"],
                            nombre=op["operacion"],
                            entrada=int(op["entrada"]),
                            estandar_min=max(float(op["tiempo_estandar_min"]), 0.1),
                            preparacion_restante=float(op["tiempo_preparacion_min"] or 0),
                        )
                        print(f"[{hora()}] ▶ {m.dispositivo} ({m.nombre}) empieza «{op['operacion']}» de {op['orden']}: {op['entrada']} pieza(s)")

            # 2. Lecturas de los sensores (con la hora en que se tomaron)
            momento = ahora_iso()
            lecturas = [l for l in (m.avanzar(minutos_por_lectura, args.prob_paro, args.prob_falla, args.prob_apagado) for m in maquinas) if l]
            if luces:
                lecturas.append(luces.avanzar(minutos_por_lectura))
            for l in lecturas:
                l["registrado_en"] = momento
            cola.agregar(lecturas)
            if hay_red:
                hay_red = cola.enviar()

            # 3. Máquinas que completaron sus piezas terminan la operación (solo con red)
            for m in maquinas:
                t = m.trabajo
                if not hay_red or t is None or t.piezas < t.entrada or m.apagada_restante > 0:
                    continue
                rechazadas = sum(1 for _ in range(t.entrada) if random.random() < args.prob_rechazo) if m.inspeccion else 0
                cuerpo = {
                    "operacion_id": t.operacion_id,
                    "buenas": t.entrada - rechazadas,
                    "rechazadas": rechazadas,
                    "paro_min": round(t.paro_min, 2),
                    "escala": args.velocidad,
                    "motivo_paro": t.motivo_paro,
                }
                try:
                    estado, respuesta = peticion(url_operaciones, args.api_key, "POST", cuerpo)
                except urllib.error.URLError as err:
                    print(f"[{hora()}] sin conexión al terminar: {err.reason}", file=sys.stderr)
                    continue
                m.trabajo = None
                if estado != 200:
                    print(f"[{hora()}] {m.dispositivo}: no se pudo terminar «{t.nombre}»: {respuesta.get('error', respuesta)}", file=sys.stderr)
                    continue
                r = respuesta.get("resultado", {})
                detalle = f"{cuerpo['buenas']} buenas" + (f", {rechazadas} rechazadas" if rechazadas else "") + (f", paros {t.paro_min:.0f} min" if t.paro_min >= 0.5 else "")
                print(f"[{hora()}] ✓ {m.dispositivo} terminó «{t.nombre}» de {t.orden}: {detalle}")
                if r.get("siguiente"):
                    print(f"           → sigue «{r['siguiente']}»")
                if r.get("orden_cerrada"):
                    print(f"           ✔ {t.orden} cerrada automáticamente · lote {r.get('lote')} listo para Calidad")
                elif r.get("error_cierre"):
                    print(f"           ! {t.orden} terminó su ruta pero no se pudo cerrar: {r['error_cierre']}")

            time.sleep(args.intervalo)
    except KeyboardInterrupt:
        pass

    if cola.pendientes:
        print(f"\nQuedaron {len(cola.pendientes)} lectura(s) sin enviar en la cola.")
    print("\nResumen de la simulación:")
    for m in maquinas:
        print(f"  {m.dispositivo:<14} {m.centro}  {m.total_piezas:>5} pz  {m.total_kwh:>8.2f} kWh")
    if luces:
        print(f"  {luces.dispositivo:<14} {luces.planta}  {'':>5}     {luces.total_kwh:>8.2f} kWh")
    return 0


if __name__ == "__main__":
    sys.exit(main())
