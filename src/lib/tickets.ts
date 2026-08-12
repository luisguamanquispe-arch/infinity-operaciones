import { prisma } from "./prisma";
import type { TipoFoto, TipoTrabajo } from "@prisma/client";
import { FOTOS_OBLIGATORIAS_DEFAULT } from "./fotos-ticket";
import { FOTOS_OBLIGATORIAS_INFRA } from "./ticket-infraestructura";
import {
  FOTOS_OBLIGATORIAS_INSTALACION,
  validarDatosInstalacion,
  type DatosInstalacionInput,
} from "./ticket-instalacion";
import { FOTO_LABELS } from "./utils";
import { enviarWhatsAppTicketCerrado } from "./whatsapp";
import {
  FOTOS_OBLIGATORIAS_EXPRESS,
  FOTO_LABELS_EXPRESS,
} from "./soporte-express";
import {
  materialEsEquipoActivo,
  tipoInventarioEfectivo,
} from "./material-detalle";
export async function getOrCreateOrden(ticketId: string) {
  const fotoLite = {
    select: { id: true, tipo: true, url: true, lat: true, lng: true },
  } as const;

  const firmaLite = {
    select: {
      nombreCliente: true,
      cedula: true,
      imagenUrl: true,
      aceptacionCondiciones: true,
      textoAceptacion: true,
      aceptadoEn: true,
    },
  } as const;

  let orden = await prisma.ordenServicio.findUnique({
    where: { ticketId },
    include: {
      cronometro: true,
      medicion: true,
      fotografias: fotoLite,
      firma: firmaLite,
      materiales: { include: { inventario: true } },
    },
  });

  if (!orden) {
    orden = await prisma.ordenServicio.create({
      data: {
        ticketId,
        cronometro: { create: {} },
      },
      include: {
        cronometro: true,
        medicion: true,
        fotografias: fotoLite,
        firma: firmaLite,
        materiales: { include: { inventario: true } },
      },
    });
  }

  return orden;
}

export function calcularDuracionCronometro(
  inicio: Date | null,
  fin: Date | null,
  pausasJson: string
): number {
  if (!inicio) return 0;
  const pausas: { inicio: string; fin?: string }[] = JSON.parse(pausasJson || "[]");
  const end = fin || new Date();
  let totalMs = end.getTime() - inicio.getTime();

  for (const pausa of pausas) {
    if (pausa.fin) {
      totalMs -= new Date(pausa.fin).getTime() - new Date(pausa.inicio).getTime();
    } else if (!fin) {
      totalMs -= Date.now() - new Date(pausa.inicio).getTime();
    }
  }

  return Math.max(0, Math.floor(totalMs / 1000));
}

export function validarCierreOrden(
  orden: {
    servicioOk: boolean;
    potenciaOk: boolean;
    fotosOk: boolean;
    clienteConforme: boolean;
    firmaOk: boolean;
    cronometro: { fin: Date | null } | null;
    medicion: unknown;
    firma: {
      aceptacionCondiciones?: boolean;
    } | null;
    fotografias: { tipo: TipoFoto }[];
    tipoConexionInstalacion?: string | null;
    direccionIp?: string | null;
    pppoeUsuario?: string | null;
    pppoeClave?: string | null;
    nombreRedWifi?: string | null;
    claveRedWifi?: string | null;
    resumenTrabajo?: string | null;
    materiales?: {
      serie?: string | null;
      modelo?: string | null;
      marca?: string | null;
      inventario?: { nombre: string; tipo?: string } | null;
    }[];
  },
  options?: {
    esInfraestructura?: boolean;
    esInstalacion?: boolean;
    esExpress?: boolean;
  }
): { valido: boolean; errores: string[] } {
  const errores: string[] = [];
  const esInfra = options?.esInfraestructura ?? false;
  const esInstalacion = options?.esInstalacion ?? false;
  const esExpress = options?.esExpress ?? false;

  if (!orden.cronometro?.fin) errores.push("El cronómetro debe estar finalizado");

  if (esExpress) {
    const resumen = orden.resumenTrabajo?.trim() ?? "";
    if (resumen.length < 10) {
      errores.push("Indique el trabajo realizado (mínimo 10 caracteres)");
    }
    for (const tipo of FOTOS_OBLIGATORIAS_EXPRESS) {
      if (!orden.fotografias.some((f) => f.tipo === tipo)) {
        errores.push(
          `Falta foto: ${FOTO_LABELS_EXPRESS[tipo] || FOTO_LABELS[tipo] || tipo}`
        );
      }
    }
    for (const m of orden.materiales ?? []) {
      const nombre = m.inventario?.nombre ?? "";
      const tipoInv = tipoInventarioEfectivo(
        (m.inventario?.tipo as "CONSUMIBLE" | "PATCHCORD" | "EQUIPO" | undefined) ??
          "CONSUMIBLE",
        nombre
      );
      const esEquipo = tipoInv === "EQUIPO" || materialEsEquipoActivo(nombre);
      if (!esEquipo) continue;
      if (!m.serie?.trim() || !m.modelo?.trim() || !m.marca?.trim()) {
        errores.push(
          `Equipo ${nombre || "entregado"}: indique marca, modelo y serie`
        );
      }
    }
    return { valido: errores.length === 0, errores };
  }

  if (esInfra) {
    for (const tipo of FOTOS_OBLIGATORIAS_INFRA) {
      if (!orden.fotografias.some((f) => f.tipo === tipo)) {
        errores.push(`Falta foto: ${tipo}`);
      }
    }
    if (!orden.servicioOk) errores.push("Checklist: Infraestructura restablecida");
    if (!orden.potenciaOk) errores.push("Checklist: Enlaces/nodo validados");
    if (!orden.fotosOk) errores.push("Checklist: Fotos cargadas");
    const resumenInfra = orden.resumenTrabajo?.trim() ?? "";
    if (resumenInfra.length < 10) {
      errores.push("Ingrese el resumen del trabajo efectuado (mínimo 10 caracteres)");
    }
  } else {
    if (!orden.medicion) errores.push("Debe registrar mediciones técnicas");
    if (!orden.firma) errores.push("Debe registrar la firma del cliente");
    else if (!orden.firma.aceptacionCondiciones) {
      errores.push("El cliente debe aceptar las condiciones del soporte técnico al firmar");
    }

    const resumen = orden.resumenTrabajo?.trim() ?? "";
    if (resumen.length < 10) {
      errores.push("Ingrese el resumen del soporte / trabajo efectuado (mínimo 10 caracteres)");
    }

    const fotosReq = esInstalacion ? FOTOS_OBLIGATORIAS_INSTALACION : FOTOS_OBLIGATORIAS_DEFAULT;
    for (const tipo of fotosReq) {
      if (!orden.fotografias.some((f) => f.tipo === tipo)) {
        errores.push(`Falta foto: ${FOTO_LABELS[tipo] || tipo}`);
      }
    }

    if (esInstalacion) {
      const datosInstalacion: DatosInstalacionInput = {
        tipoConexion: orden.tipoConexionInstalacion,
        direccionIp: orden.direccionIp,
        pppoeUsuario: orden.pppoeUsuario,
        pppoeClave: orden.pppoeClave,
        nombreRedWifi: orden.nombreRedWifi,
        claveRedWifi: orden.claveRedWifi,
      };
      errores.push(...validarDatosInstalacion(datosInstalacion));
    }

    if (!orden.servicioOk) errores.push("Checklist: Servicio funcionando");
    if (!orden.potenciaOk) errores.push("Checklist: Potencia validada");
    if (!orden.fotosOk) errores.push("Checklist: Fotos cargadas");
    if (!orden.clienteConforme) errores.push("Checklist: Cliente conforme");
    if (!orden.firmaOk) errores.push("Checklist: Firma registrada");
  }

  return { valido: errores.length === 0, errores };
}

export async function enviarWhatsApp(ticketCodigo: string, telefono: string) {
  return enviarWhatsAppTicketCerrado(ticketCodigo, telefono);
}
export function slaHorasPorPrioridad(prioridad: string): number {
  switch (prioridad) {
    case "ALTA":
      return 4;
    case "MEDIA":
      return 8;
    default:
      return 24;
  }
}

export async function generarCodigoTicket(tipo?: TipoTrabajo): Promise<string> {
  const prefix = tipo === "INFRAESTRUCTURA" ? "INF" : "ST";
  const tickets = await prisma.ticket.findMany({ select: { codigo: true } });
  let max = tipo === "INFRAESTRUCTURA" ? 100 : 1000;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const t of tickets) {
    const match = t.codigo.match(re);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}-${max + 1}`;
}
