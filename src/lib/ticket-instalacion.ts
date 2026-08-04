import type { TipoConexionInstalacion, TipoFoto } from "@prisma/client";
import {
  FOTOS_ANTES_DEFAULT,
  FOTOS_DURANTE_DEFAULT,
  FOTOS_FINAL_DEFAULT,
  FOTOS_OBLIGATORIAS_DEFAULT,
} from "./fotos-ticket";
import {
  FOTOS_ANTES_INFRA,
  FOTOS_DURANTE_INFRA,
  FOTOS_FINAL_INFRA,
  FOTOS_OBLIGATORIAS_INFRA,
  esTicketInfraestructura,
} from "./ticket-infraestructura";

export function esTicketInstalacion(tipo: string): boolean {
  return tipo === "INSTALACION";
}

/** Fotos para instalación nueva (mismas 4 que Soporte Completo). */
export const FOTOS_ANTES_INSTALACION: TipoFoto[] = ["NAP"];
export const FOTOS_DURANTE_INSTALACION: TipoFoto[] = ["ONU"];
export const FOTOS_FINAL_INSTALACION: TipoFoto[] = ["CLIENTE_CONFORME", "SPEEDTEST"];

export const FOTOS_OBLIGATORIAS_INSTALACION: TipoFoto[] = [
  "NAP",
  "ONU",
  "CLIENTE_CONFORME",
  "SPEEDTEST",
];

export const CLAUSULAS_POLITICA_INSTALACION = [
  "Tiempo de permanencia mínimo: 18 meses.",
  "Pagos: del 1 al 10 de cada mes.",
  "Corte de servicio por mora: a partir del día 11 de cada mes.",
  "Soporte técnico: 0995870168.",
] as const;

export interface DatosInstalacionInput {
  tipoConexion?: TipoConexionInstalacion | string | null;
  direccionIp?: string | null;
  pppoeUsuario?: string | null;
  pppoeClave?: string | null;
  nombreRedWifi?: string | null;
  claveRedWifi?: string | null;
}

export function validarDatosInstalacion(
  datos: DatosInstalacionInput | null | undefined
): string[] {
  const errores: string[] = [];
  if (!datos?.tipoConexion) {
    errores.push("Indique si la conexión es por IP o PPPoE");
    return errores;
  }

  if (datos.tipoConexion === "IP") {
    if (!datos.direccionIp?.trim()) {
      errores.push("Indique la dirección IP del cliente");
    }
  } else if (datos.tipoConexion === "PPPOE") {
    if (!datos.pppoeUsuario?.trim()) errores.push("Indique el usuario PPPoE");
    if (!datos.pppoeClave?.trim()) errores.push("Indique la clave PPPoE");
  }

  if (!datos.nombreRedWifi?.trim()) {
    errores.push("Indique el nombre de la red WiFi entregada al cliente");
  }
  if (!datos.claveRedWifi?.trim()) {
    errores.push("Indique la clave de la red WiFi entregada al cliente");
  }

  return errores;
}

export function normalizarDatosInstalacion(datos: DatosInstalacionInput) {
  const tipo = datos.tipoConexion as TipoConexionInstalacion | undefined;
  return {
    ...(tipo ? { tipoConexionInstalacion: tipo } : {}),
    ...(tipo === "IP"
      ? {
          direccionIp: datos.direccionIp?.trim() || null,
          pppoeUsuario: null,
          pppoeClave: null,
        }
      : tipo === "PPPOE"
        ? {
            direccionIp: null,
            pppoeUsuario: datos.pppoeUsuario?.trim() || null,
            pppoeClave: datos.pppoeClave?.trim() || null,
          }
        : {}),
    ...(datos.nombreRedWifi !== undefined
      ? { nombreRedWifi: datos.nombreRedWifi?.trim() || null }
      : {}),
    ...(datos.claveRedWifi !== undefined
      ? { claveRedWifi: datos.claveRedWifi?.trim() || null }
      : {}),
  };
}

/** Guardado parcial desde la app (validación completa solo al cerrar). */
export function datosInstalacionParaGuardar(datos: DatosInstalacionInput) {
  return normalizarDatosInstalacion(datos);
}

export function gruposFotosPorTipo(tipo: string): {
  antes: TipoFoto[];
  durante: TipoFoto[];
  final: TipoFoto[];
} {
  if (esTicketInfraestructura(tipo)) {
    return {
      antes: FOTOS_ANTES_INFRA,
      durante: FOTOS_DURANTE_INFRA,
      final: FOTOS_FINAL_INFRA,
    };
  }
  if (esTicketInstalacion(tipo)) {
    return {
      antes: FOTOS_ANTES_INSTALACION,
      durante: FOTOS_DURANTE_INSTALACION,
      final: FOTOS_FINAL_INSTALACION,
    };
  }
  return {
    antes: FOTOS_ANTES_DEFAULT,
    durante: FOTOS_DURANTE_DEFAULT,
    final: FOTOS_FINAL_DEFAULT,
  };
}

export function fotosObligatoriasPorTipo(tipo: string): TipoFoto[] {
  if (esTicketInfraestructura(tipo)) return FOTOS_OBLIGATORIAS_INFRA;
  if (esTicketInstalacion(tipo)) return FOTOS_OBLIGATORIAS_INSTALACION;
  return FOTOS_OBLIGATORIAS_DEFAULT;
}
