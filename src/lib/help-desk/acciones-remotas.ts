import { prisma } from "@/lib/prisma";
import type { HdTipoAccionRemota } from "@prisma/client";

/** Simula/ejecuta acción remota y registra auditoría completa. */
export async function ejecutarAccionRemota(opts: {
  conversacionId: string;
  usuarioId: string;
  tipo: HdTipoAccionRemota;
  configNueva?: string;
  motivo?: string;
  observaciones?: string;
  ipAgente?: string | null;
}) {
  const configAnterior = await obtenerConfigSimulada(opts.tipo);

  const resultado = simularResultadoAccion(opts.tipo, opts.configNueva);

  const accion = await prisma.hdAccionRemota.create({
    data: {
      conversacionId: opts.conversacionId,
      usuarioId: opts.usuarioId,
      tipo: opts.tipo,
      configAnterior: JSON.stringify(configAnterior),
      configNueva: opts.configNueva ?? null,
      motivo: opts.motivo,
      observaciones: opts.observaciones,
      ipAgente: opts.ipAgente ?? null,
      exito: resultado.exito,
      resultadoJson: JSON.stringify(resultado),
    },
  });

  await prisma.hdMensaje.create({
    data: {
      conversacionId: opts.conversacionId,
      autor: "SISTEMA",
      contenido: `Acción remota: ${opts.tipo} — ${resultado.mensaje}`,
    },
  });

  return { accion, resultado };
}

async function obtenerConfigSimulada(tipo: HdTipoAccionRemota) {
  return {
    tipo,
    nota: "Integración OLT/router pendiente — valor simulado para auditoría",
    timestamp: new Date().toISOString(),
  };
}

function simularResultadoAccion(tipo: HdTipoAccionRemota, configNueva?: string) {
  const map: Partial<Record<HdTipoAccionRemota, string>> = {
    SPEED_TEST: "Descarga 94 Mbps / Subida 48 Mbps",
    PING: "Latencia 12 ms — 0% pérdida",
    DIAG_POTENCIA: "RX -22.5 dBm — dentro de rango",
    DIAG_ONU: "ONU online — sin alarmas LOS",
    ROUTER_REINICIO: "Router reiniciado correctamente",
    WIFI_PASSWORD: "Contraseña WiFi actualizada",
    WIFI_SSID: "SSID actualizado",
  };

  return {
    exito: true,
    mensaje: map[tipo] ?? `Acción ${tipo} registrada`,
    configAplicada: configNueva ?? null,
  };
}
