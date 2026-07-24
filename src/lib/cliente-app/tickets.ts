import { prisma } from "@/lib/prisma";
import { generarCodigoTicket, slaHorasPorPrioridad } from "@/lib/tickets";
import type { ClienteSession } from "./auth";

export const CATEGORIAS_SOPORTE_CLIENTE = [
  { id: "SIN_INTERNET", label: "Sin internet" },
  { id: "INTERMITENCIA", label: "Servicio intermitente" },
  { id: "LENTITUD", label: "Internet lento" },
  { id: "EQUIPO", label: "Problema con router/ONU" },
  { id: "FACTURACION", label: "Consulta de facturación" },
  { id: "OTRO", label: "Otro" },
] as const;

export type CategoriaSoporteCliente = (typeof CATEGORIAS_SOPORTE_CLIENTE)[number]["id"];

export function labelCategoria(id: string): string {
  return CATEGORIAS_SOPORTE_CLIENTE.find((c) => c.id === id)?.label ?? id;
}

export async function listarTicketsCliente(clienteId: string) {
  return prisma.ticket.findMany({
    where: { clienteId, tipo: { in: ["SOPORTE", "RECONEXION"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      codigo: true,
      tipo: true,
      estado: true,
      prioridad: true,
      motivo: true,
      descripcion: true,
      createdAt: true,
      updatedAt: true,
      programadoEn: true,
    },
  });
}

export async function obtenerTicketCliente(clienteId: string, ticketId: string) {
  return prisma.ticket.findFirst({
    where: { id: ticketId, clienteId },
    select: {
      id: true,
      codigo: true,
      tipo: true,
      estado: true,
      prioridad: true,
      motivo: true,
      descripcion: true,
      createdAt: true,
      updatedAt: true,
      programadoEn: true,
      eventos: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { accion: true, createdAt: true, metadata: true },
      },
    },
  });
}

export async function crearTicketCliente(opts: {
  session: ClienteSession;
  categoria: CategoriaSoporteCliente;
  descripcion: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const cat = CATEGORIAS_SOPORTE_CLIENTE.find((c) => c.id === opts.categoria);
  if (!cat) throw new Error("Categoría inválida");

  const desc = opts.descripcion.trim();
  if (desc.length < 10) throw new Error("Describa el problema (mínimo 10 caracteres)");

  const codigo = await generarCodigoTicket("SOPORTE");
  const slaHoras = slaHorasPorPrioridad("MEDIA");
  const slaVenceEn = new Date(Date.now() + slaHoras * 60 * 60 * 1000);

  const ticket = await prisma.ticket.create({
    data: {
      codigo,
      clienteId: opts.session.clienteId,
      tipo: "SOPORTE",
      prioridad: "MEDIA",
      estado: "PENDIENTE",
      motivo: cat.label,
      descripcion: desc,
      slaHoras,
      slaVenceEn,
    },
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId: ticket.id,
      usuarioId: opts.session.id,
      accion: "TICKET_CREADO_APP_CLIENTE",
      metadata: JSON.stringify({
        origen: "infinity_connect",
        categoria: opts.categoria,
        lat: opts.lat ?? null,
        lng: opts.lng ?? null,
      }),
    },
  });

  return ticket;
}
