import { prisma } from "./prisma";
import type { TipoFoto } from "@prisma/client";
import { FOTOS_OBLIGATORIAS } from "./utils";
import { enviarWhatsAppTicketCerrado } from "./whatsapp";
export async function getOrCreateOrden(ticketId: string) {
  const fotoLite = {
    select: { id: true, tipo: true, url: true, lat: true, lng: true },
  } as const;

  const firmaLite = {
    select: {
      nombreCliente: true,
      cedula: true,
      imagenUrl: true,
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

export function validarCierreOrden(orden: {
  servicioOk: boolean;
  potenciaOk: boolean;
  fotosOk: boolean;
  clienteConforme: boolean;
  firmaOk: boolean;
  cronometro: { fin: Date | null } | null;
  medicion: unknown;
  firma: unknown;
  fotografias: { tipo: TipoFoto }[];
}): { valido: boolean; errores: string[] } {
  const errores: string[] = [];

  if (!orden.cronometro?.fin) errores.push("El cronómetro debe estar finalizado");
  if (!orden.medicion) errores.push("Debe registrar mediciones técnicas");
  if (!orden.firma) errores.push("Debe registrar la firma del cliente");

  for (const tipo of FOTOS_OBLIGATORIAS) {
    if (!orden.fotografias.some((f) => f.tipo === tipo)) {
      errores.push(`Falta foto: ${tipo}`);
    }
  }

  if (!orden.servicioOk) errores.push("Checklist: Servicio funcionando");
  if (!orden.potenciaOk) errores.push("Checklist: Potencia validada");
  if (!orden.fotosOk) errores.push("Checklist: Fotos cargadas");
  if (!orden.clienteConforme) errores.push("Checklist: Cliente conforme");
  if (!orden.firmaOk) errores.push("Checklist: Firma registrada");

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

export async function generarCodigoTicket(): Promise<string> {
  const tickets = await prisma.ticket.findMany({ select: { codigo: true } });
  let max = 1000;
  for (const t of tickets) {
    const match = t.codigo.match(/^ST-(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `ST-${max + 1}`;
}
