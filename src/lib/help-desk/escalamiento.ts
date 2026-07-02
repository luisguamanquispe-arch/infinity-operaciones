import { prisma } from "@/lib/prisma";
import { generarCodigoTicket, slaHorasPorPrioridad } from "@/lib/tickets";
import { generarResumenConversacion } from "./ia-copiloto";
import type { HdMotivoEscalamiento, Prioridad } from "@prisma/client";

export async function escalarConversacionACampo(opts: {
  conversacionId: string;
  usuarioId: string;
  motivo: HdMotivoEscalamiento;
  prioridad?: Prioridad;
  materialSugerido?: string;
  tiempoEstimadoMin?: number;
  diagnostico?: string;
}) {
  const conv = await prisma.hdConversacion.findUnique({
    where: { id: opts.conversacionId },
    include: {
      cliente: true,
      mensajes: { orderBy: { createdAt: "asc" } },
      acciones: true,
    },
  });

  if (!conv) throw new Error("Conversación no encontrada");
  if (!conv.clienteId || !conv.cliente) {
    throw new Error("No se puede escalar sin cliente identificado en el CRM");
  }
  if (conv.estado === "ESCALADO") {
    throw new Error("Esta conversación ya fue escalada");
  }

  const resumenIa = await generarResumenConversacion(conv.mensajes);
  const slaHoras = slaHorasPorPrioridad(opts.prioridad ?? conv.prioridad);
  const codigo = await generarCodigoTicket("SOPORTE");

  const ticket = await prisma.ticket.create({
    data: {
      codigo,
      clienteId: conv.clienteId,
      tipo: "SOPORTE",
      prioridad: opts.prioridad ?? conv.prioridad,
      estado: "PENDIENTE",
      motivo: `Escalado Help Desk: ${opts.motivo}`,
      descripcion: resumenIa,
      slaHoras,
      slaVenceEn: new Date(Date.now() + slaHoras * 60 * 60 * 1000),
    },
  });

  await prisma.$transaction([
    prisma.hdEscalamiento.create({
      data: {
        conversacionId: conv.id,
        motivo: opts.motivo,
        ticketEscaladoId: ticket.id,
        resumenIa,
        diagnostico: opts.diagnostico ?? conv.diagnosticoIa,
        accionesJson: JSON.stringify(conv.acciones),
        materialSugerido: opts.materialSugerido,
        tiempoEstimadoMin: opts.tiempoEstimadoMin,
        prioridad: opts.prioridad ?? conv.prioridad,
      },
    }),
    prisma.hdConversacion.update({
      where: { id: conv.id },
      data: {
        estado: "ESCALADO",
        ticketId: ticket.id,
        resumenIa,
        cerradoEn: new Date(),
      },
    }),
    prisma.hdMensaje.create({
      data: {
        conversacionId: conv.id,
        autor: "SISTEMA",
        contenido: `Orden de trabajo ${ticket.codigo} generada para técnico de campo.`,
      },
    }),
    prisma.eventoTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: opts.usuarioId,
        accion: "ESCALADO_DESDE_HELP_DESK",
        metadata: JSON.stringify({ conversacionId: conv.id, motivo: opts.motivo }),
      },
    }),
  ]);

  return { ticket, codigo: ticket.codigo };
}
